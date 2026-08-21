import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "@/lib/owner-guard";
import { vendorIdInput, vendorSaveInput, enabledInput } from "@/lib/vendor-schemas-admin";

export const adminListVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { appSettings } = await import("@/lib/settings.server");
    const settings = await appSettings();
    const { data: vendors, error } = await context.supabase.from("vendors").select("*").order("name");
    if (error) throw error;
    const ids = (vendors ?? []).map((v) => v.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: access }, { data: events }] = await Promise.all([
      supabaseAdmin.from("vendor_access").select("*").in("vendor_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("vendor_login_events")
        .select("vendor_id, kind, at")
        .in("vendor_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .order("at", { ascending: false })
        .limit(400),
    ]);
    return {
      baseUrl: settings.public_base_url,
      vendors: (vendors ?? []).map((v) => {
        const a = (access ?? []).find((x) => x.vendor_id === v.id) ?? null;
        return {
          ...v,
          access: a
            ? {
                enabled: a.enabled,
                pin_set_at: a.pin_set_at,
                setup_code_expires_at: a.setup_code_expires_at,
                has_setup_code: !!a.setup_code_hash,
                has_pin: !!a.pin_hash,
                failed_attempts: a.failed_attempts,
                locked_until: a.locked_until,
                last_seen_at: a.last_seen_at,
                last_device: a.last_device,
              }
            : null,
          events: (events ?? []).filter((e) => e.vendor_id === v.id).slice(0, 8),
        };
      }),
    };
  });

export const adminSaveVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vendorSaveInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const row = {
      name: data.name.trim(),
      contact_first_name: data.contact_first_name?.trim() || null,
      slug: data.slug.trim().toLowerCase(),
      trade: data.trade?.trim() || null,
      initials: data.initials?.trim() || null,
      legal_name: data.legal_name?.trim() || null,
      address: data.address?.trim() || null,
      bank: data.bank,
    };
    if (data.id) {
      const { error } = await context.supabase.from("vendors").update(row).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("vendors")
      .insert({ ...row, owner_id: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("vendor_access").insert({ vendor_id: created.id });
    return { id: created.id };
  });

export const adminSetAccessEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => enabledInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("vendor_access")
      .select("vendor_id")
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    if (!existing) await supabaseAdmin.from("vendor_access").insert({ vendor_id: data.vendor_id });
    await supabaseAdmin.from("vendor_access").update({ enabled: data.enabled }).eq("vendor_id", data.vendor_id);
    if (!data.enabled) {
      await supabaseAdmin.from("vendor_sessions").delete().eq("vendor_id", data.vendor_id);
      await supabaseAdmin.from("vendor_login_events").insert({ vendor_id: data.vendor_id, kind: "disabled" });
    }
    return { ok: true };
  });

export const adminNewSetupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vendorIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const h = await import("@/lib/vendor-auth.server");
    const { appSettings } = await import("@/lib/settings.server");
    const settings = await appSettings();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");
    const { data: existing } = await supabaseAdmin
      .from("vendor_access")
      .select("vendor_id")
      .eq("vendor_id", data.vendor_id)
      .maybeSingle();
    if (!existing) await supabaseAdmin.from("vendor_access").insert({ vendor_id: data.vendor_id });
    await supabaseAdmin
      .from("vendor_access")
      .update({
        setup_code_hash: await h.hash(code),
        setup_code_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("vendor_id", data.vendor_id);
    await supabaseAdmin.from("vendor_login_events").insert({ vendor_id: data.vendor_id, kind: "setup_code" });

    const { data: vendor } = await supabaseAdmin
      .from("vendors")
      .select("slug, name, contact_first_name")
      .eq("id", data.vendor_id)
      .single();
    const first = vendor?.contact_first_name ?? vendor?.name ?? "there";
    const host = settings.public_base_url.replace(/^https?:\/\//, "");
    const pretty = `${code.slice(0, 3)} ${code.slice(3)}`;
    return {
      code,
      message: `Hi ${first} — your ${settings.site_name.replace(/ RenoTracker$/, "")} tracker is at ${host}. Tap Contractor → ${first} → enter code ${pretty}, then choose your own 6-digit PIN. Link: ${host}/c/${vendor?.slug}`,
    };
  });

export const adminResetPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vendorIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("vendor_access")
      .update({ pin_hash: null, pin_set_at: null, failed_attempts: 0, locked_until: null })
      .eq("vendor_id", data.vendor_id);
    await supabaseAdmin.from("vendor_sessions").delete().eq("vendor_id", data.vendor_id);
    await supabaseAdmin.from("vendor_login_events").insert({ vendor_id: data.vendor_id, kind: "reset" });
    return { ok: true };
  });
