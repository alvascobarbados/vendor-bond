import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listContractors } from "@/lib/vendor.functions";

export const Route = createFileRoute("/c/")({
  head: () => ({
    meta: [
      { title: "Contractors — Starpoint RenoTracker" },
      { name: "description", content: "Tap your name to open your Starpoint tracker." },
      { property: "og:title", content: "Contractors — Starpoint RenoTracker" },
      { property: "og:description", content: "Tap your name to open your Starpoint tracker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContractorList,
});

function ContractorList() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["contractors"], queryFn: () => listContractors() });

  return (
    <div className="authwrap">
      <div className="authcard">
        <h1>
          Starpoint <span>RenoTracker</span>
        </h1>
        <p className="lead">Tap your name.</p>
        {q.isLoading && <div className="loading">Loading…</div>}
        <div className="clist">
          {(q.data ?? []).map((c) => (
            <button key={c.slug} className="crow" onClick={() => navigate({ to: "/c/$slug", params: { slug: c.slug } })}>
              <span className="avatar">{c.initials}</span>
              <span>
                <b>{c.firstName}</b>
                <small>{c.company}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
