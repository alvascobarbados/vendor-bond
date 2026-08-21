import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

export const Route = createFileRoute("/owner/")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Trackers,
});

type Card = {
  id: string;
  slug: string;
  name: string;
  trade: string | null;
  initials: string | null;
  balance: number;
  open: number;
  lastSeen: string | null;
};

async function loadCards(): Promise<Card[]> {
  const [{ data: vendors }, { data: jobs }, { data: allocs }, { data: items }, { data: access }] = await Promise.all([
    supabase.from("vendors").select("*").order("name"),
    supabase.from("jobs").select("id, vendor_id, contract_amount, status"),
    supabase.from("payment_allocations").select("job_id, amount"),
    supabase.from("items").select("vendor_id, status"),
    supabase.from("vendor_access").select("vendor_id, last_seen_at"),
  ]);
  return (vendors ?? []).map((v) => {
    const mine = (jobs ?? []).filter((j) => j.vendor_id === v.id && j.status !== "pending");
    const contract = mine.reduce((s, j) => s + Number(j.contract_amount), 0);
    const paid = (allocs ?? [])
      .filter((a) => mine.some((j) => j.id === a.job_id))
      .reduce((s, a) => s + Number(a.amount), 0);
    return {
      id: v.id,
      slug: v.slug,
      name: v.name,
      trade: v.trade,
      initials: v.initials,
      balance: contract - paid,
      open: (items ?? []).filter((i) => i.vendor_id === v.id && i.status === "open").length,
      lastSeen: (access ?? []).find((a) => a.vendor_id === v.id)?.last_seen_at ?? null,
    };
  });
}

function ago(iso: string | null) {
  if (!iso) return "never opened";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `seen ${Math.max(mins, 1)} min ago`;
  if (mins < 60 * 24) return `seen ${Math.round(mins / 60)} h ago`;
  return `seen ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function Trackers() {
  const q = useQuery({ queryKey: ["owner-cards"], queryFn: loadCards });
  const cards = q.data ?? [];

  return (
    <div className="ownerpage">
      <div className="ownerhead">
        <h2>Trackers</h2>
      </div>
      {q.isLoading && <p className="oi-lead">Loading…</p>}
      <div className="vlist">
        {cards.map((c) => (
          <Link key={c.id} to="/owner/t/$slug" params={{ slug: c.slug }} className="vcard link">
            <div className="vcardhead">
              <span className="avatar sm">{c.initials}</span>
              <span>
                <b>{c.name}</b>
                <small>{c.trade}</small>
              </span>
              <span className="mono balance">{money(c.balance)}</span>
            </div>
            <div className="vstatus">
              {c.open} open item{c.open === 1 ? "" : "s"} · {ago(c.lastSeen)}
            </div>
          </Link>
        ))}
      </div>
      {!q.isLoading && !cards.length && (
        <p className="oi-lead">
          No vendors yet. <Link to="/owner/vendors">Add one</Link>.
        </p>
      )}
    </div>
  );
}
