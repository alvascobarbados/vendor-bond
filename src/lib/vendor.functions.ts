import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const accessInput = z.object({ token: z.string().min(4), pin: z.string().optional() });

const noteInput = accessInput.extend({
  target_type: z.enum(["job", "payment", "general"]),
  target_id: z.string().uuid().nullable(),
  text: z.string().min(1).max(600),
});

const idInput = accessInput.extend({ id: z.string().uuid() });
const pathInput = accessInput.extend({ path: z.string().min(1) });

/** Resolves a read-only contractor link. Throws when the token or PIN is wrong. */
async function open(token: string, pin?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: access, error } = await supabaseAdmin
    .from("vendor_access")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!access) throw new Error("NOT_FOUND");
  if (access.pin && access.pin !== pin) throw new Error("PIN_REQUIRED");
  return { db: supabaseAdmin, vendorId: access.vendor_id };
}

export const getVendorTracker = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => accessInput.parse(d))
  .handler(async ({ data }) => {
    const { db, vendorId } = await open(data.token, data.pin);
    void db.from("vendor_access").update({ last_seen_at: new Date().toISOString() }).eq("token", data.token);

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
    const { db, vendorId } = await open(data.token, data.pin);
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
    const { db, vendorId } = await open(data.token, data.pin);
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
    const { db, vendorId } = await open(data.token, data.pin);
    if (!data.path.startsWith(`${vendorId}/`)) throw new Error("FORBIDDEN");
    const { data: signed, error } = await db.storage.from("proof").createSignedUrl(data.path, 3600);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
