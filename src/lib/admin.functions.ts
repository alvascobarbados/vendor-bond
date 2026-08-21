import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "@/lib/owner-guard";

export const whoAmI = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const owner = await requireOwner(context);
      return { owner };
    } catch {
      return { owner: null };
    }
  });

/* ── Team ─────────────────────────────────────────────── */

export const listOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("owners").select("*").order("created_at");
    if (error) throw error;
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    return (rows ?? []).map((o) => {
      const u = users?.users.find((x) => x.id === o.user_id);
      return {
        user_id: o.user_id,
        email: o.email,
        display_name: o.display_name,
        created_at: o.created_at,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        is_me: o.user_id === context.userId,
      };
    });
  });

export const inviteOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { appSettings } = await import("@/lib/settings.server");
    const s = await appSettings();
    const email = data.email.trim().toLowerCase();

    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let userId = users?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;

    if (!userId) {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${s.public_base_url}/owner`,
      });
      if (error) throw new Error(error.message);
      userId = invited.user.id;
    }

    const { error: insErr } = await supabaseAdmin
      .from("owners")
      .upsert({ user_id: userId, email, invited_by: context.userId }, { onConflict: "user_id" });
    if (insErr) throw insErr;
    return { ok: true, email };
  });

export const removeOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("owners").select("user_id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) throw new Error("LAST_OWNER");
    const { error } = await supabaseAdmin.from("owners").delete().eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const setDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ display_name: z.string().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("owners")
      .update({ display_name: data.display_name.trim() || null })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ── Settings ─────────────────────────────────────────── */

const settingsInput = z.object({
  owner_first_name: z.string().min(1).max(40),
  site_name: z.string().min(1).max(80),
  public_base_url: z.string().url(),
  currency_code: z.string().min(3).max(3),
});

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { appSettings } = await import("@/lib/settings.server");
    return appSettings();
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ id: true, ...data, currency_code: data.currency_code.toUpperCase() }, { onConflict: "id" });
    if (error) throw error;
    return { ok: true };
  });

/* ── Data ─────────────────────────────────────────────── */

export const exportEverything = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [vendors, jobs, payments, allocations, items, attachments] = await Promise.all([
      supabaseAdmin.from("vendors").select("*"),
      supabaseAdmin.from("jobs").select("*"),
      supabaseAdmin.from("payments").select("*"),
      supabaseAdmin.from("payment_allocations").select("*"),
      supabaseAdmin.from("items").select("*"),
      supabaseAdmin.from("attachments").select("*"),
    ]);
    return {
      exported_at: new Date().toISOString(),
      vendors: vendors.data ?? [],
      jobs: jobs.data ?? [],
      payments: payments.data ?? [],
      payment_allocations: allocations.data ?? [],
      items: items.data ?? [],
      attachments: attachments.data ?? [],
    };
  });

export const dataOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: atts }, { data: events }, { data: vendors }] = await Promise.all([
      supabaseAdmin.from("attachments").select("storage_path"),
      supabaseAdmin
        .from("vendor_login_events")
        .select("vendor_id, kind, at, user_agent")
        .order("at", { ascending: false })
        .limit(100),
      supabaseAdmin.from("vendors").select("id, name"),
    ]);

    let bytes = 0;
    const byFolder = new Map<string, string[]>();
    for (const a of atts ?? []) {
      const i = a.storage_path.lastIndexOf("/");
      const dir = a.storage_path.slice(0, i);
      const file = a.storage_path.slice(i + 1);
      byFolder.set(dir, [...(byFolder.get(dir) ?? []), file]);
    }
    for (const [dir, files] of byFolder) {
      const { data: listed } = await supabaseAdmin.storage.from("proof").list(dir, { limit: 1000 });
      for (const f of listed ?? []) {
        if (!files.includes(f.name)) continue;
        const size = (f.metadata as { size?: number } | null)?.size;
        bytes += typeof size === "number" ? size : 0;
      }
    }

    const name = (id: string) => (vendors ?? []).find((v) => v.id === id)?.name ?? "—";
    return {
      attachments: (atts ?? []).length,
      bytes,
      activity: (events ?? []).map((e) => ({ vendor: name(e.vendor_id), kind: e.kind, at: e.at, device: e.user_agent })),
    };
  });
