import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "@/lib/owner-guard";

/** An owner adopts any vendor that has no creator yet. */
export const claimVendors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .update({ owner_id: context.userId })
      .is("owner_id", null)
      .select("id");
    if (error) throw error;
    return { claimed: data?.length ?? 0 };
  });

/** Deletes a vendor and everything hanging off it, including its stored files. */
export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vendor_id: z.string().uuid(), confirm: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vendor } = await supabaseAdmin.from("vendors").select("id, name").eq("id", data.vendor_id).single();
    if (!vendor) throw new Error("NOT_FOUND");
    if (data.confirm.trim() !== vendor.name) throw new Error("NAME_MISMATCH");

    const { data: atts } = await supabaseAdmin
      .from("attachments")
      .select("storage_path")
      .eq("vendor_id", vendor.id);
    const paths = (atts ?? []).map((a) => a.storage_path);
    if (paths.length) await supabaseAdmin.storage.from("proof").remove(paths);

    const { data: payments } = await supabaseAdmin.from("payments").select("id").eq("vendor_id", vendor.id);
    const paymentIds = (payments ?? []).map((p) => p.id);
    const { data: jobs } = await supabaseAdmin.from("jobs").select("id").eq("vendor_id", vendor.id);
    const jobIds = (jobs ?? []).map((j) => j.id);

    if (paymentIds.length) await supabaseAdmin.from("payment_allocations").delete().in("payment_id", paymentIds);
    if (jobIds.length) await supabaseAdmin.from("job_revisions").delete().in("job_id", jobIds);
    await supabaseAdmin.from("attachments").delete().eq("vendor_id", vendor.id);
    await supabaseAdmin.from("items").delete().eq("vendor_id", vendor.id);
    await supabaseAdmin.from("payments").delete().eq("vendor_id", vendor.id);
    await supabaseAdmin.from("jobs").delete().eq("vendor_id", vendor.id);
    await supabaseAdmin.from("vendor_sessions").delete().eq("vendor_id", vendor.id);
    await supabaseAdmin.from("vendor_login_events").delete().eq("vendor_id", vendor.id);
    await supabaseAdmin.from("vendor_access").delete().eq("vendor_id", vendor.id);
    const { error } = await supabaseAdmin.from("vendors").delete().eq("id", vendor.id);
    if (error) throw error;
    return { ok: true };
  });
