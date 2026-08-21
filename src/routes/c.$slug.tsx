import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  getVendorTracker,
  vendorAddNote,
  vendorLogout,
  vendorResolveItem,
  vendorSetup,
  vendorSignUrl,
  vendorState,
  vendorVerifyPin,
} from "@/lib/vendor.functions";
import type { TrackerData } from "@/lib/tracker-model";
import { Tracker } from "@/components/tracker/Tracker";
import { Toast } from "@/components/tracker/Toast";
import type { TrackerApi } from "@/components/tracker/TrackerContext";

export const Route = createFileRoute("/c/$slug")({
  head: () => ({
    meta: [
      { title: "Your Starpoint tracker — quotes, payments, balance" },
      {
        name: "description",
        content:
          "Read-only view of your work at Starpoint: every approved estimate, what has been paid against it, bills reimbursed and open questions.",
      },
      { property: "og:title", content: "Starpoint RenoTracker" },
      { property: "og:description", content: "Your quotes, payments and balance at Starpoint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContractorView,
});

function Boxes({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: (v: string) => void }) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      inputMode="numeric"
      onChange={(v) => {
        onChange(v);
        if (v.length === 6) setTimeout(() => onDone(v), 30);
      }}
    >
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

function Card({ title, lead, error, shake, children }: {
  title: string;
  lead?: string;
  error?: string;
  shake?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="authwrap">
      <div className={`authcard pincard${shake ? " shake" : ""}`}>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
        {error && <div className="authmsg">{error}</div>}
      </div>
    </div>
  );
}

type Step = "code" | "pin1" | "pin2";

function ContractorView() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [toast, setToast] = useState("");

  const stateQ = useQuery({ queryKey: ["vendor-state", slug], queryFn: () => vendorState({ data: { slug } }), retry: false });

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  function fail(msg: string) {
    setErr(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  const reload = () => void qc.invalidateQueries({ queryKey: ["vendor-state", slug] });

  const trackerQ = useQuery({
    queryKey: ["vendor-tracker", slug],
    queryFn: () => getVendorTracker({ data: { slug } }),
    enabled: stateQ.data?.state === "remembered",
    retry: false,
  });

  if (stateQ.isLoading) return <div className="loading">Loading…</div>;
  const s = stateQ.data;
  if (!s || s.state === "not_found") return <Card title="Not found" lead="This page doesn't exist. Ask the owner for the right link." />;
  if (s.state === "disabled") return <Card title={s.company} lead="This page has been switched off." />;
  if (s.state === "no_code")
    return <Card title={`Hi ${s.firstName} 👋`} lead={`Ask ${s.ownerName} to send you a setup code.`} />;
  if (s.state === "locked") {
    const until = s.lockedUntil ? new Date(s.lockedUntil) : null;
    return (
      <Card
        title="Too many tries"
        lead={`Locked for 15 minutes${until ? ` — until ${until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}. ${s.ownerName} can unlock it.`}
      />
    );
  }

  if (s.state === "needs_setup") {
    if (step === "code")
      return (
        <Card title={`Hi ${s.firstName} 👋`} lead={`Enter the setup code ${s.ownerName} sent you.`} error={err} shake={shake}>
          <Boxes
            key="code"
            value={code}
            onChange={(v) => {
              setCode(v);
              setErr("");
            }}
            onDone={(v) => v.length === 6 && setStep("pin1")}
          />
        </Card>
      );
    if (step === "pin1")
      return (
        <Card title="Now choose your own 6-digit PIN" error={err} shake={shake}>
          <Boxes
            key="pin1"
            value={pin}
            onChange={(v) => {
              setPin(v);
              setErr("");
            }}
            onDone={() => setStep("pin2")}
          />
        </Card>
      );
    return (
      <Card title="Enter it again" error={err} shake={shake}>
        <Boxes
          key="pin2"
          value={pin2}
          onChange={(v) => {
            setPin2(v);
            setErr("");
          }}
          onDone={async (v) => {
            if (busy) return;
            if (v !== pin) {
              setPin("");
              setPin2("");
              setStep("pin1");
              return fail("Those didn't match — pick a PIN again");
            }
            setBusy(true);
            try {
              await vendorSetup({ data: { slug, code, pin } });
              reload();
            } catch (e) {
              const m = String((e as Error).message ?? "");
              setPin("");
              setPin2("");
              setCode("");
              setStep("code");
              if (m.includes("WEAK_PIN")) fail("Too easy to guess — try another PIN");
              else if (m.includes("LOCKED")) fail("Too many tries — locked for 15 minutes");
              else if (m.includes("BAD_CODE")) fail(`That code is wrong (${m.split(":")[1] ?? ""} left)`);
              else fail("Couldn't set your PIN");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
    );
  }

  if (s.state === "needs_pin")
    return (
      <Card title={`Hi ${s.firstName} 👋`} lead="Enter your PIN." error={err} shake={shake}>
        <Boxes
          value={pin}
          onChange={(v) => {
            setPin(v);
            setErr("");
          }}
          onDone={async (v) => {
            if (busy) return;
            setBusy(true);
            try {
              await vendorVerifyPin({ data: { slug, pin: v } });
              reload();
            } catch (e) {
              const m = String((e as Error).message ?? "");
              setPin("");
              if (m.includes("LOCKED")) fail(`Too many tries — locked for 15 minutes. ${s.ownerName} can unlock it.`);
              else if (m.includes("BAD_PIN")) fail(`Try again (${m.split(":")[1] ?? ""} left)`);
              else fail("Couldn't sign you in");
            } finally {
              setBusy(false);
            }
          }}
        />
        <p className="hint">{`Forgot PIN? Ask ${s.ownerName} to reset it.`}</p>
      </Card>
    );

  if (!trackerQ.data) return <div className="loading">Loading…</div>;
  const data = trackerQ.data as unknown as TrackerData;

  const api: TrackerApi = {
    readOnly: true,
    signUrl: async (path) => (await vendorSignUrl({ data: { slug, path } })).url,
    addNote: async (target_type, target_id, text) => {
      await vendorAddNote({ data: { slug, target_type, target_id, text } });
    },
    setResolved: async (id, resolved) => {
      if (!resolved) return;
      await vendorResolveItem({ data: { slug, id } });
    },
    refresh: () => void qc.invalidateQueries({ queryKey: ["vendor-tracker", slug] }),
    toast: setToast,
    onSwitch: async () => {
      await vendorLogout({ data: { slug } });
      void navigate({ to: "/", replace: true });
    },
    switchLabel: `Not ${s.firstName}? Switch`,
  };

  return (
    <>
      <Tracker data={data} api={api} />
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}
