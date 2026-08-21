import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { fetchTracker, fetchVendors, signUrl } from "@/lib/tracker-queries";
import * as owner from "@/lib/owner-api";
import { claimVendors } from "@/lib/owner.functions";

import { derive, type Job, type Payment, type Vendor } from "@/lib/tracker-model";
import { Tracker } from "@/components/tracker/Tracker";
import { Toast } from "@/components/tracker/Toast";
import { PaymentForm, draftOf, emptyDraft, type PaymentDraft } from "@/components/tracker/PaymentForm";
import { JobForm, jobDraft, type JobDraft } from "@/components/tracker/JobForm";
import type { TrackerApi } from "@/components/tracker/TrackerContext";

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
  component: OwnerApp,
});

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const fn =
      mode === "in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    const { error } = await fn;
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === "up") setMsg("Check your email to confirm, then sign in.");
  }

  return (
    <div className="authwrap">
      <div className="authcard">
        <h1>
          Starpoint <span>RenoTracker</span>
        </h1>
        <p className="lead">Owner sign-in. Contractors use their own read-only link.</p>
        <label className="fw">
          <span>Email</span>
          <input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="fw">
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
        </label>
        {msg && <div className="authmsg">{msg}</div>}
        <button className="primary fw" disabled={busy} onClick={() => void submit()}>
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button
          className="ghost fw"
          onClick={async () => {
            const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
            if (result.error) setMsg("Google sign-in failed");
          }}
        >
          Continue with Google
        </button>
        <button className="linkbtn center" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Create an account" : "I already have an account"}
        </button>
      </div>
    </div>
  );
}

function VendorSwitcher({
  vendors,
  current,
  onPick,
}: {
  vendors: Vendor[];
  current: Vendor;
  onPick: (v: Vendor) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="vendorwrap">
      <button className="vendor" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <div className="avatar">{current.initials}</div>
        <div className="vmeta">
          <span className="vname">{current.name}</span>
          <span className="vtrade">{current.trade}</span>
        </div>
      </button>
      {open && (
        <div className="vendormenu" role="listbox">
          {vendors.map((v) => (
            <button
              key={v.id}
              role="option"
              aria-selected={v.id === current.id}
              onClick={() => {
                onPick(v);
                setOpen(false);
              }}
            >
              <span className="avatar sm">{v.initials}</span>
              <span>
                <b>{v.name}</b>
                <small>{v.trade}</small>
              </span>
            </button>
          ))}
          <button
            className="signout"
            onClick={() => {
              void supabase.auth.signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function OwnerApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [payForm, setPayForm] = useState<PaymentDraft | null>(null);
  const [jForm, setJForm] = useState<JobDraft | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSession(s);
        if (event !== "SIGNED_OUT") void qc.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors, enabled: !!session });
  const vendors = vendorsQ.data ?? [];
  const current = vendors.find((v) => v.id === vendorId) ?? vendors[0] ?? null;

  const trackerQ = useQuery({
    queryKey: ["tracker", current?.id],
    queryFn: () => fetchTracker(current!.id),
    enabled: !!current,
  });

  if (!ready) return <div className="loading">Loading…</div>;
  if (!session) return <SignIn />;
  if (vendorsQ.isLoading) return <div className="loading">Loading…</div>;
  if (!current)
    return (
      <div className="authwrap">
        <div className="authcard">
          <h1>
            Starpoint <span>RenoTracker</span>
          </h1>
          <p className="lead">No vendors are linked to this account yet.</p>
          <button
            className="primary fw"
            onClick={async () => {
              const r = await claimVendors({});
              setToast(r.claimed ? `Linked ${r.claimed} vendor${r.claimed > 1 ? "s" : ""}` : "Nothing to link");
              void qc.invalidateQueries({ queryKey: ["vendors"] });
            }}
          >
            Link my vendors
          </button>
          <button className="linkbtn center" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
          <Toast message={toast} onDone={() => setToast("")} />
        </div>
      </div>
    );

  if (!trackerQ.data) return <div className="loading">Loading {current.name}…</div>;

  const data = trackerQ.data;
  const d = derive(data);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["tracker", current.id] });

  const api: TrackerApi = {
    readOnly: false,
    signUrl,
    addNote: (t, id, text) => owner.addNote(current.id, t, id, text),
    setResolved: owner.setResolved,
    deleteItem: owner.deleteItem,
    upload: (file, tt, id) => owner.uploadAttachment(current.id, file, tt, id),
    removeAttachment: owner.removeAttachment,
    refresh,
    toast: setToast,
  };

  return (
    <>
      <Tracker
        data={data}
        api={api}
        headerRight={<VendorSwitcher vendors={vendors} current={current} onPick={(v) => setVendorId(v.id)} />}
        onNewPayment={() => setPayForm(emptyDraft(d))}
        onEditPayment={(p: Payment) => setPayForm(draftOf(p))}
        onNewJob={() => setJForm(jobDraft())}
        onEditJob={(j: Job) => setJForm(jobDraft(j))}
      />
      {payForm && (
        <PaymentForm
          d={d}
          draft={payForm}
          toast={setToast}
          onClose={() => setPayForm(null)}
          onSave={async (f) => {
            await owner.savePayment(current.id, f);
            refresh();
          }}
          onDelete={async (id) => {
            await owner.deletePayment(id);
            refresh();
          }}
        />
      )}
      {jForm && (
        <JobForm
          draft={jForm}
          toast={setToast}
          onClose={() => setJForm(null)}
          onSave={async (f) => {
            await owner.saveJob(current.id, f, d.jobs.length + 1);
            refresh();
          }}
          onDelete={async (id) => {
            await owner.deleteJob(id);
            refresh();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}
