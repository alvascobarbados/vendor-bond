/** Throws unless the signed-in owner's RLS-scoped client can see this vendor. */
export async function assertOwned(
  supabase: { from: (t: "vendors") => { select: (c: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } },
  vendorId: string,
) {
  const { data } = await supabase.from("vendors").select("id").eq("id", vendorId).maybeSingle();
  if (!data) throw new Error("FORBIDDEN");
}
