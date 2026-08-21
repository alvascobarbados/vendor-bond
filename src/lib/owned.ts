type Loose = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, b: string) => { maybeSingle: () => PromiseLike<{ data: unknown }> };
    };
  };
};

/** Throws unless the signed-in owner's RLS-scoped client can see this vendor. */
export async function assertOwned(supabase: unknown, vendorId: string) {
  const { data } = await (supabase as Loose).from("vendors").select("id").eq("id", vendorId).maybeSingle();
  if (!data) throw new Error("FORBIDDEN");
}
