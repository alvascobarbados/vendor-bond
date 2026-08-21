import { fdate, fmt, money, monthKey, monthName } from "@/lib/format";
import type { Payment } from "@/lib/tracker-model";
import { DocChip } from "./DocChip";
import { NoteZone } from "./NoteZone";
import { useTracker } from "./TrackerContext";

export type PayFilter = "all" | "contract" | "bill";

function PayRow({ p, onEdit }: { p: Payment; onEdit?: (p: Payment) => void }) {
  const { d, api } = useTracker();
  const cat = p.kind;
  return (
    <div className="prow">
      <div className="prowmain">
        <span className="d">{fdate(p.date)}</span>
        <span className="mid">
          <span className={`cat ${cat}`}>{cat === "contract" ? "Contract" : "Bill"}</span>
          <div className="purpose">
            <b className={`pn${p.payment_no ? "" : " unnumbered"}`}>{d.payLabel(p)}</b> · {d.purpose(p)}
          </div>
          {cat === "bill" && p.detail ? <div className="detail">{p.detail}</div> : null}
          <div className="ref">
            <DocChip targetType="payment" targetId={p.id} label={p.bank_ref} title="View transfer slip" />
            {d.mismatch(p) && <span className="warn">allocation {money(d.allocSum(p))} ≠ amount</span>}
            {!api.readOnly && onEdit && (
              <button className="linkbtn" onClick={() => onEdit(p)}>
                Edit
              </button>
            )}
          </div>
        </span>
        <span className="amt">{fmt(p.amount, true)}</span>
      </div>
      <NoteZone targetType="payment" targetId={p.id} />
    </div>
  );
}

export function PaymentsPage({
  filter,
  setFilter,
  compact,
  setCompact,
  onEditPayment,
}: {
  filter: PayFilter;
  setFilter: (f: PayFilter) => void;
  compact: boolean;
  setCompact: (v: boolean) => void;
  onEditPayment?: (p: Payment) => void;
}) {
  const { d } = useTracker();

  const list = d.payments.filter((p) => filter === "all" || p.kind === filter).slice().reverse();
  const months: { key: string; rows: Payment[]; c: number; b: number }[] = [];
  const idx: Record<string, number> = {};
  list.forEach((p) => {
    const k = monthKey(p.date);
    if (idx[k] === undefined) {
      idx[k] = months.length;
      months.push({ key: k, rows: [], c: 0, b: 0 });
    }
    const m = months[idx[k]!]!;
    m.rows.push(p);
    if (p.kind === "contract") m.c += p.amount;
    else m.b += p.amount;
  });

  return (
    <section className="page active" role="tabpanel">
      <h2 className="printonly">Payments</h2>
      <div className="payhead">
        <div className="big">
          <small>Total paid</small>
          <span>{fmt(d.grandTotal, true)}</span>
        </div>
        <div className="split">
          <span>
            Contract <b>{money(d.contractTotal)}</b>
          </span>
          <span>
            Bills <b>{fmt(d.billTotal, true)}</b>
          </span>
          <span>
            Transfers <b>{d.payments.length}</b>
          </span>
        </div>
      </div>

      <div className="filters" role="group" aria-label="Filter payments">
        {(["all", "contract", "bill"] as PayFilter[]).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "contract" ? "Contract" : "Bills"}
          </button>
        ))}
        <div className="viewtoggle" role="group" aria-label="View" style={{ marginLeft: "auto" }}>
          <button aria-pressed={compact} className={compact ? "on" : ""} onClick={() => setCompact(true)}>
            Compact
          </button>
          <button aria-pressed={!compact} className={!compact ? "on" : ""} onClick={() => setCompact(false)}>
            Detailed
          </button>
        </div>
      </div>

      <div>
        {months.map((m) => {
          const n = m.rows.length;
          const sub =
            filter === "all"
              ? `Contract ${money(m.c)} · Bills ${fmt(m.b, true)} · ${n} transfer${n === 1 ? "" : "s"}`
              : `${n} transfer${n === 1 ? "" : "s"}`;
          return (
            <div className="month" key={m.key}>
              <div className="mhead">
                <span className="m">{monthName(m.key)}</span>
                <span className="mt">{fmt(m.c + m.b, true)}</span>
                <span className="sub">{sub}</span>
              </div>
              <div className="ledger">
                {m.rows.map((p) => (
                  <PayRow key={p.id} p={p} {...(onEditPayment ? { onEdit: onEditPayment } : {})} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
