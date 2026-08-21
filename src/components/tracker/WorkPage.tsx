import { useState } from "react";
import { fdate, fmt, money, pct } from "@/lib/format";
import type { Job } from "@/lib/tracker-model";
import { DocChip } from "./DocChip";
import { NoteZone } from "./NoteZone";
import { useTracker } from "./TrackerContext";
import { IconFlag, IconTick } from "./icons";

const COLLAPSE_AT = 5;
const SHOW_LATEST = 3;

function StatusPill({ j }: { j: Job }) {
  if (j.status === "closed")
    return (
      <span className="status closed">
        <IconTick />
        Paid in full
      </span>
    );
  if (j.status === "pending") return <span className="status pending">Pending approval</span>;
  return (
    <span className="status confirmed">
      <IconTick />
      Confirmed
    </span>
  );
}

function JobCard({ j, onEdit }: { j: Job; onEdit?: (j: Job) => void }) {
  const { d, api } = useTracker();
  const [showAll, setShowAll] = useState(false);
  const got = d.paid(j.id);
  const pays = d.paymentsFor(j.id);
  const pc = Math.round(pct(got, j.contract_amount));
  const collapse = pays.length >= COLLAPSE_AT;

  return (
    <article className={`job ${j.status}`}>
      <div className="top">
        <div className="idblock">
          <div className="idline">
            <span className="estno">EST {j.estimate_no}</span>
            <StatusPill j={j} />
          </div>
          <h3>{j.title}</h3>
          <p className="scope">{j.scope}</p>
          <DocChip targetType="job" targetId={j.id} label={`Estimate ${j.estimate_no}`} title="View estimate" />
        </div>
        <div className="amount">
          <div className="v">{money(j.contract_amount)}</div>
          <div className="lbl">Contract</div>
          {!api.readOnly && onEdit && (
            <button className="linkbtn" onClick={() => onEdit(j)}>
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="crbar">
        <div className="c">
          <span className="k">Paid</span> <b>{money(got)}</b>
        </div>
        <span className="pctpill">{pc}% paid</span>
        <div className="r">
          <span className="k">Balance</span> <b>{money(j.contract_amount - got)}</b>
        </div>
      </div>
      <div className="meter" role="img" aria-label={`${pc} percent paid`}>
        {pays.map((p) => (
          <div
            key={p.id}
            className="seg"
            title={`${d.payLabel(p)} · ${money(d.allocOf(p, j.id)?.amount ?? 0)}`}
            style={{ width: `${pct(d.allocOf(p, j.id)?.amount ?? 0, j.contract_amount).toFixed(2)}%` }}
          />
        ))}
      </div>
      <div className={`pays${showAll ? " open" : ""}`}>
        {pays.map((p, i) => (
          <div className={`pay${collapse && !showAll && i < pays.length - SHOW_LATEST ? " more" : ""}`} key={p.id}>
            <span className="date">{fdate(p.date)}</span>
            <span className="amt">{money(d.allocOf(p, j.id)?.amount ?? 0)}</span>
            <span className="desc">{d.rowLabel(p, j.id)}</span>
            <DocChip targetType="payment" targetId={p.id} label={p.bank_ref} title="View transfer slip" />
          </div>
        ))}
        {!pays.length && (
          <div className="pay">
            <span className="desc">No payments yet</span>
          </div>
        )}
        {collapse && (
          <button className="showall" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show latest only" : `Show all ${pays.length} payments`}
          </button>
        )}
      </div>
      <NoteZone targetType="job" targetId={j.id} />
    </article>
  );
}

function PendingCard({ j, onEdit }: { j: Job; onEdit?: (j: Job) => void }) {
  const { api } = useTracker();
  return (
    <article className="job pending">
      <div className="top">
        <div className="idblock">
          <div className="idline">
            <span className="estno">EST {j.estimate_no}</span>
            <StatusPill j={j} />
          </div>
          <h3>{j.title}</h3>
          <p className="scope">{j.scope}</p>
          <DocChip targetType="job" targetId={j.id} label={`Estimate ${j.estimate_no}`} title="View estimate" />
        </div>
        <div className="amount">
          <div className="v">{money(j.contract_amount)}</div>
          <div className="lbl">Quoted</div>
          {!api.readOnly && onEdit && (
            <button className="linkbtn" onClick={() => onEdit(j)}>
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="pendnote">
        <IconFlag />
        Not approved yet — not included in any total.
      </div>
      <NoteZone targetType="job" targetId={j.id} />
    </article>
  );
}

export function WorkPage({
  compact,
  setCompact,
  onEditJob,
}: {
  compact: boolean;
  setCompact: (v: boolean) => void;
  onEditJob?: (j: Job) => void;
}) {
  const { d } = useTracker();

  return (
    <section className="page active" role="tabpanel">
      <h2 className="printonly">Work</h2>
      <div className="asof">
        <span className="t">
          <span className="vn">{d.vendor.name} · </span>
          {d.asOf}
        </span>
        <div className="viewtoggle" role="group" aria-label="View">
          <button aria-pressed={compact} className={compact ? "on" : ""} onClick={() => setCompact(true)}>
            Compact
          </button>
          <button aria-pressed={!compact} className={!compact ? "on" : ""} onClick={() => setCompact(false)}>
            Detailed
          </button>
        </div>
      </div>

      <div className="totals">
        <div className="cell">
          <div className="k">Contract</div>
          <div className="v">{money(d.openValue)}</div>
          <div className="foot">
            {d.open.length} confirmed job{d.open.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="cell hi">
          <div className="k">Paid</div>
          <div className="v">{money(d.openPaid)}</div>
          <div className="foot">
            {d.openTransfers} transfer{d.openTransfers === 1 ? "" : "s"}
          </div>
        </div>
        <div className="cell">
          <div className="k">Balance</div>
          <div className="v">{money(d.openValue - d.openPaid)}</div>
          <div className="foot">left to invoice</div>
        </div>
      </div>

      <div className="master">
        <div className="barhead">
          <div className="l">
            <b>{money(d.openPaid)}</b> paid of <b>{money(d.openValue)}</b>
          </div>
          <div className="pct">{d.masterPct}% paid</div>
        </div>
        <div className="meter tall" role="img" aria-label={`${d.masterPct} percent paid overall`}>
          {d.open.map((j) => (
            <div
              key={j.id}
              className="seg"
              title={`Est ${j.estimate_no}`}
              style={{ width: `${pct(d.paid(j.id), d.openValue).toFixed(2)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="section">
        <div className="head">
          <h2>Confirmed work</h2>
          <span className="count">
            {d.open.length} confirmed · {d.closed.length} paid in full
          </span>
        </div>
        {[...d.open, ...d.closed].map((j) => (
          <JobCard key={j.id} j={j} {...(onEditJob ? { onEdit: onEditJob } : {})} />
        ))}
      </div>

      {d.pending.length > 0 && (
        <div className="section">
          <div className="head">
            <h2>Pending approval</h2>
            <span className="count">
              {d.pending.length} quote{d.pending.length === 1 ? "" : "s"} · {money(d.pendingValue)} · not in totals
            </span>
          </div>
          {d.pending.map((j) => (
            <PendingCard key={j.id} j={j} {...(onEditJob ? { onEdit: onEditJob } : {})} />
          ))}
        </div>
      )}

      <div className="section">
        <div className="head">
          <h2>Bills reimbursed</h2>
          <span className="count">paid at cost · separate from contract</span>
        </div>
        <div className="bills">
          {d.bills.map((b) => (
            <div className="billblock" key={b.id}>
              <div className="billrow">
                <span className="d">{fdate(b.date)}</span>
                <span className="desc">
                  <b className={`pn${b.payment_no ? "" : " unnumbered"}`}>{d.payLabel(b)}</b> · {b.description}
                  {b.detail ? <span className="vend">{b.detail}</span> : null}
                </span>
                <span className="amt">{fmt(b.amount, true)}</span>
                <span className="rc">
                  <DocChip targetType="payment" targetId={b.id} label={b.bank_ref} title="View transfer slip" />
                </span>
              </div>
              <NoteZone targetType="payment" targetId={b.id} />
            </div>
          ))}
          <div className="billblock subtotal">
            <div className="billrow">
              <span className="d" />
              <span className="desc">Bills total</span>
              <span className="amt">{fmt(d.billTotal, true)}</span>
              <span className="rc" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
