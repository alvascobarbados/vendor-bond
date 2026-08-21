import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListVendors } from "@/lib/vendors-admin.functions";
import { statusLine } from "@/components/owner/vendor-status";

export const Route = createFileRoute("/owner/vendors/")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: VendorsList,
});

function VendorsList() {
  const q = useQuery({ queryKey: ["admin-vendors"], queryFn: () => adminListVendors() });
  const navigate = useNavigate();
  const vendors = q.data?.vendors ?? [];

  return (
    <div className="ownerpage">
      <div className="ownerhead">
        <h2>Vendors</h2>
        <button className="primary" onClick={() => void navigate({ to: "/owner/vendors/$id", params: { id: "new" } })}>
          New vendor
        </button>
      </div>
      {q.isLoading && <p className="oi-lead">Loading…</p>}
      <div className="vlist">
        {vendors.map((v) => (
          <Link key={v.id} to="/owner/vendors/$id" params={{ id: v.id }} className="vcard link">
            <div className="vcardhead">
              <span className="avatar sm">{v.initials}</span>
              <span>
                <b>{v.name}</b>
                <small>
                  {v.contact_first_name} · /c/{v.slug}
                </small>
              </span>
            </div>
            <div className="vstatus">{statusLine(v)}</div>
          </Link>
        ))}
      </div>
      {!q.isLoading && !vendors.length && <p className="oi-lead">No vendors yet.</p>}
    </div>
  );
}
