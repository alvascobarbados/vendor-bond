import { useState } from "react";
import type { Job, JobStatus } from "@/lib/tracker-model";

export interface JobDraft {
  id?: string;
  estimate_no: string;
  title: string;
  scope: string;
  contract_amount: string;
  status: JobStatus;
  revision_note: string;
}

export function jobDraft(j?: Job): JobDraft {
  return j
    ? {
        id: j.id,
        estimate_no: j.estimate_no,
        title: j.title,
        scope: j.scope ?? "",
        contract_amount: String(j.contract_amount),
        status: j.status,
        revision_note: "",
      }
    : { estimate_no: "", title: "", scope: "", contract_amount: "", status: "pending", revision_note: "" };
}

export function JobForm({
  draft: initial,
  onClose,
  onSave,
  onDelete,
  toast,
}: {
  draft: JobDraft;
  onClose: () => void;
  onSave: (d: JobDraft) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  toast: (m: string) => void;
}) {
  const [f, setF] = useState<JobDraft>(initial);
  const [busy, setBusy] = useState(false);
  function set<K extends keyof JobDraft>(k: K, v: JobDraft[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheetin form">
        <div className="sheethead">{f.id ? `Edit estimate ${f.estimate_no}` : "New estimate"}</div>
        <div className="frow">
          <label>
            <span>Estimate no.</span>
            <input value={f.estimate_no} placeholder="1016" onChange={(e) => set("estimate_no", e.target.value)} />
          </label>
          <label>
            <span>Contract (BBD)</span>
            <input
              inputMode="decimal"
              value={f.contract_amount}
              onChange={(e) => set("contract_amount", e.target.value)}
            />
          </label>
        </div>
        <label className="fw">
          <span>Title</span>
          <input value={f.title} placeholder="Roof package" onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="fw">
          <span>Scope</span>
          <input value={f.scope} onChange={(e) => set("scope", e.target.value)} />
        </label>
        <div className="seg2" role="group" aria-label="Status">
          {(["pending", "confirmed", "closed"] as JobStatus[]).map((s) => (
            <button key={s} aria-pressed={f.status === s} onClick={() => set("status", s)}>
              {s === "pending" ? "Pending" : s === "confirmed" ? "Confirmed" : "Paid in full"}
            </button>
          ))}
        </div>
        {f.id && (
          <label className="fw">
            <span>Revision note (if re-issued)</span>
            <input
              value={f.revision_note}
              placeholder="Estimate re-issued — scope added"
              onChange={(e) => set("revision_note", e.target.value)}
            />
          </label>
        )}
        <div className="formacts">
          {f.id && onDelete && (
            <button
              className="danger"
              onClick={async () => {
                if (!confirm("Delete this estimate?")) return;
                await onDelete(f.id!);
                toast("Estimate deleted");
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (!f.estimate_no.trim() || !f.title.trim()) return toast("Estimate number and title are required");
              setBusy(true);
              try {
                await onSave(f);
                toast("Saved");
                onClose();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Couldn't save");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
