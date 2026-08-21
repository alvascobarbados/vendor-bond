import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { currentContractor } from "@/lib/vendor.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Starpoint RenoTracker — contract & payment tracker" },
      {
        name: "description",
        content:
          "One shared source of truth per contractor: quoted, confirmed, paid against each estimate, bills reimbursed and every open question — with proof attached.",
      },
      { property: "og:title", content: "Starpoint RenoTracker" },
      {
        property: "og:description",
        content: "Per-vendor renovation contract and payment tracker for the Starpoint house.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FrontDoor,
});

function FrontDoor() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ data: auth }, contractor] = await Promise.all([
        supabase.auth.getSession(),
        currentContractor().catch(() => ({ slug: null as string | null })),
      ]);
      if (cancelled) return;
      if (contractor.slug) return void navigate({ to: "/c/$slug", params: { slug: contractor.slug }, replace: true });
      if (auth.session) return void navigate({ to: "/owner", replace: true });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready) return <div className="loading">Loading…</div>;

  return (
    <div className="authwrap">
      <div className="authcard door">
        <h1>
          Starpoint <span>RenoTracker</span>
        </h1>
        <p className="lead">Who's opening this?</p>
        <button className="doorbtn" onClick={() => navigate({ to: "/owner" })}>
          <b>Owner</b>
          <small>Record payments, estimates and access</small>
        </button>
        <button className="doorbtn" onClick={() => navigate({ to: "/c" })}>
          <b>Contractor</b>
          <small>See your quotes, payments and balance</small>
        </button>
      </div>
    </div>
  );
}
