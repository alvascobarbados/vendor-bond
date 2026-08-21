import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { whoAmI } from "@/lib/admin.functions";
import { OwnerMenu, OwnerSidebar } from "@/components/owner/OwnerNav";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Owner — Starpoint RenoTracker" },
      { name: "description", content: "Owner back-office for the Starpoint renovation contract and payment tracker." },
      { property: "og:title", content: "Owner — Starpoint RenoTracker" },
      { property: "og:description", content: "Record estimates, transfers and contractor access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerLayout,
});

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
  }

  return (
    <div className="authwrap">
      <div className="authcard">
        <h1>
          Starpoint <span>RenoTracker</span>
        </h1>
        <p className="lead">Owner sign-in. Contractors tap their own name instead.</p>
        <label className="fw">
          <span>Email</span>
          <input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="fw">
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
        </label>
        {msg && <div className="authmsg">{msg}</div>}
        <button className="primary fw" disabled={busy} onClick={() => void submit()}>
          {busy ? "…" : "Sign in"}
        </button>
        <button
          className="ghost fw"
          onClick={async () => {
            const result = await lovable.auth.signInWithOAuth("google", {
              redirect_uri: `${window.location.origin}/owner`,
            });
            if (result.error) setMsg("Google sign-in failed");
          }}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function NotForYou() {
  return (
    <div className="authwrap">
      <div className="authcard">
        <h1>
          Starpoint <span>RenoTracker</span>
        </h1>
        <p className="lead">This is a private app. There&apos;s nothing here for this account.</p>
      </div>
    </div>
  );
}

function OwnerLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const meQ = useQuery({ queryKey: ["whoami"], queryFn: () => whoAmI(), enabled: !!session });

  useEffect(() => {
    if (meQ.data && meQ.data.owner === null) void supabase.auth.signOut();
  }, [meQ.data]);

  if (!ready) return <div className="loading">Loading…</div>;
  if (!session) return <SignIn />;
  if (meQ.isLoading || !meQ.data) return <div className="loading">Loading…</div>;
  if (!meQ.data.owner) return <NotForYou />;

  const owner = meQ.data.owner;
  const name = owner.display_name || owner.email;

  return (
    <div className="ownerlayout">
      <OwnerSidebar name={name} />
      <div className="ownertop">
        <b>Owner</b>
        <button className="ownerchip" onClick={() => setMenu(true)}>
          {name} ▾
        </button>
      </div>
      <div className="ownermain">
        <Outlet />
      </div>
      {menu && <OwnerMenu name={name} onClose={() => setMenu(false)} />}
    </div>
  );
}

