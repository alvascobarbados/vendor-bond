/** Single-row app settings, read with the service-role client (server only). */
export async function appSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_settings").select("*").limit(1).maybeSingle();
  return {
    owner_first_name: data?.owner_first_name || "Av",
    site_name: data?.site_name || "Starpoint RenoTracker",
    public_base_url: data?.public_base_url || process.env["PUBLIC_BASE_URL"] || "https://starpointreno.com",
    currency_code: data?.currency_code || "BBD",
  };
}
