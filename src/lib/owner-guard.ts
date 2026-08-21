type OwnerRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
};

type Ctx = { supabase: unknown; userId: string };

type Loose = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, b: string) => { maybeSingle: () => PromiseLike<{ data: OwnerRow | null }> };
    };
  };
};

/** Throws unless the signed-in user is on the owners allowlist. */
export async function requireOwner(context: Ctx): Promise<OwnerRow> {
  const { data } = await (context.supabase as Loose)
    .from("owners")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) throw new Error("FORBIDDEN");
  return data;
}
