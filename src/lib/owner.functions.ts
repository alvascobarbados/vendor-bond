import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** First owner to sign in adopts any vendor that has no owner yet. */
export const claimVendors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .update({ owner_id: context.userId })
      .is("owner_id", null)
      .select("id");
    if (error) throw error;
    return { claimed: data?.length ?? 0 };
  });
