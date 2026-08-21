import { createServerFn } from "@tanstack/react-start";
import {
  noteInput,
  pinInput,
  setupInput,
  slugInput,
  idInput,
  pathInput,
} from "@/lib/vendor-schemas";

export const listContractors = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("@/lib/vendor-auth.server");
  const client = await db();
  const { data } = await client
    .from("vendors")
    .select("slug, name, contact_first_name, initials, vendor_access!inner(enabled)")
    .eq("vendor_access.enabled", true)
    .order("name");
  return (data ?? []).map((v) => ({
    slug: v.slug,
    firstName: v.contact_first_name ?? v.name,
    company: v.name,
    initials: v.initials ?? v.name.slice(0, 2).toUpperCase(),
  }));
});

export const vendorState = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => slugInput.parse(d))
  .handler(async ({ data }) => {
    const h = await import("@/lib/vendor-auth.server");
    const { appSettings } = await import("@/lib/settings.server");
    const ownerName = (await appSettings()).owner_first_name;
    const vendor = await h.vendorBySlug(data.slug);
    if (!vendor) return { state: "not_found" as const, firstName: "", company: "", ownerName };
    const firstName = vendor.contact_first_name ?? vendor.name;
    const company = vendor.name;
    const access = await h.accessFor(vendor.id);
    if (!access || !access.enabled) return { state: "disabled" as const, firstName, company, ownerName };

    try {
      await h.requireVendorSession(data.slug);
      return { state: "remembered" as const, firstName, company, ownerName };
    } catch {
      /* fall through to the PIN screens */
    }

    if (access.locked_until && new Date(access.locked_until) > new Date())
      return { state: "locked" as const, firstName, company, ownerName, lockedUntil: access.locked_until };
    if (access.pin_hash) return { state: "needs_pin" as const, firstName, company, ownerName };
    if (access.setup_code_hash && access.setup_code_expires_at && new Date(access.setup_code_expires_at) > new Date())
      return { state: "needs_setup" as const, firstName, company, ownerName };
    return { state: "no_code" as const, firstName, company, ownerName };
  });

export const vendorSetup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setupInput.parse(d))
  .handler(async ({ data }) => {
    const h = await import("@/lib/vendor-auth.server");
    const vendor = await h.vendorBySlug(data.slug);
    if (!vendor) throw new Error("NOT_FOUND");
    const client = await h.db();
    const access = await h.accessFor(vendor.id);
    if (!access || !access.enabled) throw new Error("DISABLED");
    if (access.locked_until && new Date(access.locked_until) > new Date()) throw new Error("LOCKED");
    if (access.pin_hash) throw new Error("PIN_ALREADY_SET");
    if (!access.setup_code_hash || !access.setup_code_expires_at || new Date(access.setup_code_expires_at) < new Date())
      throw new Error("NO_CODE");
    if (h.weakPin(data.pin)) throw new Error("WEAK_PIN");

    if (!(await h.compare(data.code, access.setup_code_hash))) {
      const failed = access.failed_attempts + 1;
      const locked = failed >= 5;
      await client
        .from("vendor_access")
        .update({
          failed_attempts: locked ? 0 : failed,
          locked_until: locked ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
        })
        .eq("vendor_id", vendor.id);
      await h.log(vendor.id, locked ? "locked" : "fail");
      throw new Error(locked ? "LOCKED" : `BAD_CODE:${5 - failed}`);
    }

    await client
      .from("vendor_access")
      .update({
        pin_hash: await h.hash(data.pin),
        pin_set_at: new Date().toISOString(),
        setup_code_hash: null,
        setup_code_expires_at: null,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("vendor_id", vendor.id);
    await h.log(vendor.id, "set_pin");
    await h.openSession(vendor.id);
    return { ok: true };
  });

export const vendorVerifyPin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pinInput.parse(d))
  .handler(async ({ data }) => {
    const h = await import("@/lib/vendor-auth.server");
    const vendor = await h.vendorBySlug(data.slug);
    if (!vendor) throw new Error("NOT_FOUND");
    const client = await h.db();
    const access = await h.accessFor(vendor.id);
    if (!access || !access.enabled) throw new Error("DISABLED");
    if (access.locked_until && new Date(access.locked_until) > new Date()) throw new Error("LOCKED");
    if (!access.pin_hash) throw new Error("NO_PIN");

    if (!(await h.compare(data.pin, access.pin_hash))) {
      const failed = access.failed_attempts + 1;
      const locked = failed >= 5;
      await client
        .from("vendor_access")
        .update({
          failed_attempts: locked ? 0 : failed,
          locked_until: locked ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
        })
        .eq("vendor_id", vendor.id);
      await h.log(vendor.id, locked ? "locked" : "fail");
      throw new Error(locked ? "LOCKED" : `BAD_PIN:${5 - failed}`);
    }

    await client.from("vendor_access").update({ failed_attempts: 0, locked_until: null }).eq("vendor_id", vendor.id);
    await h.log(vendor.id, "ok");
    await h.openSession(vendor.id);
    return { ok: true };
  });

export const vendorLogout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugInput.parse(d))
  .handler(async () => {
    const h = await import("@/lib/vendor-auth.server");
    const token = h.readCookie();
    if (token) {
      const client = await h.db();
      await client.from("vendor_sessions").delete().eq("token_hash", await h.sha256(token));
    }
    h.clearCookie();
    return { ok: true };
  });

export const getVendorTracker = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => slugInput.parse(d))
  .handler(async ({ data }) => {
    const { requireVendorSession } = await import("@/lib/vendor-auth.server");
    const { db, vendorId } = await requireVendorSession(data.slug);

    const [v, j, p, a, at, it] = await Promise.all([
      db.from("vendors").select("*").eq("id", vendorId).single(),
      db.from("jobs").select("*").eq("vendor_id", vendorId),
      db.from("payments").select("*").eq("vendor_id", vendorId),
      db.from("payment_allocations").select("*, payments!inner(vendor_id)").eq("payments.vendor_id", vendorId),
      db.from("attachments").select("*").eq("vendor_id", vendorId),
      db.from("items").select("*").eq("vendor_id", vendorId).order("created_at"),
    ]);
    for (const r of [v, j, p, a, at, it]) if (r.error) throw r.error;

    const allocs = (a.data ?? []) as Array<{ payment_id: string; amount: number }>;
    return {
      vendor: v.data,
      jobs: (j.data ?? []).map((row) => ({ ...row, contract_amount: Number(row.contract_amount) })),
      payments: (p.data ?? []).map((row) => ({
        ...row,
        amount: Number(row.amount),
        allocations: allocs.filter((x) => x.payment_id === row.id).map((x) => ({ ...x, amount: Number(x.amount) })),
      })),
      attachments: at.data ?? [],
      items: it.data ?? [],
    };
  });

export const vendorAddNote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => noteInput.parse(d))
  .handler(async ({ data }) => {
    const { requireVendorSession } = await import("@/lib/vendor-auth.server");
    const { db, vendorId } = await requireVendorSession(data.slug);
    const { data: vendor } = await db.from("vendors").select("name").eq("id", vendorId).single();
    const { error } = await db.from("items").insert({
      vendor_id: vendorId,
      target_type: data.target_type,
      target_id: data.target_id,
      text: data.text,
      author_label: vendor?.name ?? "Contractor",
    });
    if (error) throw error;
    return { ok: true };
  });

export const vendorResolveItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data }) => {
    const { requireVendorSession } = await import("@/lib/vendor-auth.server");
    const { db, vendorId } = await requireVendorSession(data.slug);
    const { error } = await db
      .from("items")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("vendor_id", vendorId);
    if (error) throw error;
    return { ok: true };
  });

export const vendorSignUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pathInput.parse(d))
  .handler(async ({ data }) => {
    const { requireVendorSession } = await import("@/lib/vendor-auth.server");
    const { db, vendorId } = await requireVendorSession(data.slug);
    if (!data.path.startsWith(`${vendorId}/`)) throw new Error("FORBIDDEN");
    const { data: signed, error } = await db.storage.from("proof").createSignedUrl(data.path, 3600);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

/** Front door: which contractor (if any) this browser is already signed in as. */
export const currentContractor = createServerFn({ method: "GET" }).handler(async () => {
  const h = await import("@/lib/vendor-auth.server");
  const token = h.readCookie();
  if (!token) return { slug: null as string | null };
  const client = await h.db();
  const { data: session } = await client
    .from("vendor_sessions")
    .select("vendor_id, expires_at")
    .eq("token_hash", await h.sha256(token))
    .maybeSingle();
  if (!session || new Date(session.expires_at) < new Date()) return { slug: null as string | null };
  const { data: vendor } = await client.from("vendors").select("slug").eq("id", session.vendor_id).maybeSingle();
  return { slug: vendor?.slug ?? null };
});
