import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { fetchVendors } from "@/lib/tracker-queries";
import { whoAmI } from "@/lib/admin.functions";
import { VendorTracker } from "@/components/owner/VendorTracker";

export const Route = createFileRoute("/owner/t/$slug")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: TrackerPage,
});

function TrackerPage() {
  const { slug } = useParams({ from: "/owner/t/$slug" });
  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
  const meQ = useQuery({ queryKey: ["whoami"], queryFn: () => whoAmI() });
  const vendors = vendorsQ.data ?? [];
  const vendor = vendors.find((v) => v.slug === slug);

  if (vendorsQ.isLoading) return <div className="loading">Loading…</div>;
  if (!vendor) return <div className="loading">No such vendor.</div>;

  const owner = meQ.data?.owner;
  return (
    <VendorTracker
      vendor={vendor}
      vendors={vendors}
      ownerName={owner?.display_name || owner?.email || "Owner"}
    />
  );
}
