import { useMemo, useState } from "react";
import { money, todayISO } from "@/lib/format";
import { whatsappCaption, type Derived, type Payment } from "@/lib/tracker-model";

export interface PaymentDraft {
  id?: string;
  payment_no: string;
  date: string;
  bank_ref: string;
  amount: string;
  kind: "contract" | "bill";
  description: string;
  detail: string;
  allocations: { job_id: string; amount: string; invoice_ref: string }[];
}

export function emptyDraft(d: Derived): PaymentDraft {
  return {
    payment_no: String(d.lastN + 1),
    date: todayISO(),
    bank_ref: "",
    amount: "",
    kind: "contract",
    description: "",
    detail: "",
    allocations: [],
  };
}

export function draftOf(p: Payment): PaymentDraft {
  return {
    id: p.id,
    payment_no: p.payment_no ? String(p.payment_no) : "",
    date: p.date,
    bank_ref: p.bank_ref,
    amount: String(p.amount),
    kind: p.kind,
    description: p.description ?? "",
    detail: p.detail ?? "",
    allocations: p.allocations.map((a) => ({
      job_id: a.job_id,
      amount: String(a.amount),
      invoice_ref: a.invoice_ref ?? "",
    })),
  };
}

export function PaymentForm({
  d,
  draft: initial,
  onClose,
  onSave,
  onDelete,
  toast,
}: {
  d: Derived;
  draft: PaymentDraft;
  onClose: () => void;
  onSave: (draft: PaymentDraft) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  toast: (m: string) => void;
}) {
  const [f, setF] = useState<PaymentDraft>(initial);
  const [busy, setBusy] = useState(false);

  const amount = Number(f.amount || 0);
  const allocSum = f.allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
  const off = f.kind === "contract" && Math.abs(allocSum - amount) > 0.005;

  const selectable = useMemo(() => d.jobs.filter((j) => j.status !== "pending"), [d.jobs]);

  function set<K extends keyof PaymentDraft>(k: K, v: PaymentDraft[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    if (!f.bank_ref.trim()) return toast("Bank reference (T-number) is required");
    if (!amount) return toast("Enter the transfer amount");
    if (off) return toast("Allocations must add up to the amount");
    setBusy(true);
    try {
      await onSave(f);
      toast(f.id ? "Payment updated" : "Payment saved");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  function caption() {
    const prev: Record<string, number> = {};
    f.allocations.forEach((a) => {
      const already = d
        .paymentsFor(a.job_id)
        .filter((p) => p.id !== f.id)
        .reduce((s, p) => s + (d.allocOf(p, a.job_id)?.amount ?? 0), 0);
      prev[a.job_id] = already;
    });
    const text = whatsappCaption(
      d,
      { payment_no: f.payment_no ? Number(f.payment_no) : null, amount, kind: f.kind },
      f.allocations.map((a) => ({ job_id: a.job_id, amount: Number(a.amount || 0) })),
      prev,
    );
    void navigator.clipboard
      .writeText(text)
      .then(() => toast("WhatsApp caption copied"))
      .catch(() => toast("Couldn't copy"));
  }

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheetin form">
        <div className="sheethead">{f.id ? "Edit transfer" : "New transfer"}</div>

        <div className="seg2" role="group" aria-label="Stream">
          <button aria-pressed={f.kind === "contract"} onClick={() => set("kind", "contract")}>
            Contract payment
          </button>
          <button aria-pressed={f.kind === "bill"} onClick={() => set("kind", "bill")}>
            Bill reimbursement
          </button>
        </div>

        <div className="frow">
          <label>
            <span>Payment N</span>
            <input
              inputMode="numeric"
              value={f.payment_no}
              placeholder="Unnumbered"
              onChange={(e) => set("payment_no", e.target.value)}
            />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </label>
        </div>

        <div className="frow">
          <label>
            <span>Bank ref (T-number)</span>
            <input value={f.bank_ref} placeholder="T123456789" onChange={(e) => set("bank_ref", e.target.value)} />
          </label>
          <label>
            <span>Amount (BBD)</span>
            <input inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
          </label>
        </div>

        {f.kind === "bill" ? (
          <>
            <label className="fw">
              <span>What was reimbursed</span>
              <input
                value={f.description}
                placeholder="Materials — Carters"
                onChange={(e) => set("description", e.target.value)}
              />
            </label>
            <label className="fw">
              <span>Detail</span>
              <input
                value={f.detail}
                placeholder="Invoices 4471, 4478"
                onChange={(e) => set("detail", e.target.value)}
              />
            </label>
          </>
        ) : (
          <div className="allocs">
            <div className="allochead">
              <span>Drawn down against</span>
              <span className={off ? "warn" : "ok"}>
                {money(allocSum)} of {money(amount)}
              </span>
            </div>
            {f.allocations.map((a, i) => (
              <div className="allocrow" key={i}>
                <select
                  value={a.job_id}
                  onChange={(e) =>
                    setF((p) => {
                      const n = [...p.allocations];
                      n[i] = { ...n[i]!, job_id: e.target.value };
                      return { ...p, allocations: n };
                    })
                  }
                >
                  <option value="">Choose estimate…</option>
                  {selectable.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.estimate_no} · {j.title}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  placeholder="Amount"
                  value={a.amount}
                  onChange={(e) =>
                    setF((p) => {
                      const n = [...p.allocations];
                      n[i] = { ...n[i]!, amount: e.target.value };
                      return { ...p, allocations: n };
                    })
                  }
                />
                <input
                  placeholder="Invoice ref"
                  value={a.invoice_ref}
                  onChange={(e) =>
                    setF((p) => {
                      const n = [...p.allocations];
                      n[i] = { ...n[i]!, invoice_ref: e.target.value };
                      return { ...p, allocations: n };
                    })
                  }
                />
                <button
                  className="rm"
                  aria-label="Remove allocation"
                  onClick={() => setF((p) => ({ ...p, allocations: p.allocations.filter((_, k) => k !== i) }))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="addalloc"
              onClick={() =>
                setF((p) => ({
                  ...p,
                  allocations: [
                    ...p.allocations,
                    {
                      job_id: "",
                      amount: String(Math.max(0, amount - allocSum) || ""),
                      invoice_ref: "",
                    },
                  ],
                }))
              }
            >
              Add allocation
            </button>
            {off && <div className="allocwarn">Allocations {money(allocSum)} ≠ amount {money(amount)}</div>}
          </div>
        )}

        <div className="formacts">
          {f.id && onDelete && (
            <button
              className="danger"
              onClick={async () => {
                if (!confirm("Delete this transfer?")) return;
                await onDelete(f.id!);
                toast("Transfer deleted");
                onClose();
              }}
            >
              Delete
            </button>
          )}
          {f.kind === "contract" && f.allocations.length > 0 && (
            <button className="ghost" onClick={caption}>
              Copy caption
            </button>
          )}
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
