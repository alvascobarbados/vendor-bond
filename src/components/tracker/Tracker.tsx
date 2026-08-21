import { useEffect, useMemo, useState, type ReactNode } from "react";
import { derive, type Job, type Payment, type TrackerData } from "@/lib/tracker-model";
import { fdate } from "@/lib/format";
import { TrackerCtx, type TrackerApi } from "./TrackerContext";
import { WorkPage } from "./WorkPage";
import { PaymentsPage, type PayFilter } from "./PaymentsPage";
import { OpenItemsPage } from "./OpenItemsPage";
import { DocViewer, type DocTarget } from "./DocViewer";
import { ExportSheet } from "./ExportSheet";
import { IconExport, IconOpen, IconPayments, IconPlus, IconWork } from "./icons";

type Page = "work" | "payments" | "open";

export function Tracker({
  data,
  api,
  headerRight,
  onNewPayment,
  onEditPayment,
  onEditJob,
  onNewJob,
}: {
  data: TrackerData;
  api: TrackerApi;
  headerRight?: ReactNode;
  onNewPayment?: () => void;
  onEditPayment?: (p: Payment) => void;
  onEditJob?: (j: Job) => void;
  onNewJob?: () => void;
}) {
  const d = useMemo(() => derive(data), [data]);
  const [page, setPage] = useState<Page>("work");
  const [compact, setCompact] = useState(false);
  const [filter, setFilter] = useState<PayFilter>("all");
  const [doc, setDoc] = useState<DocTarget | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("compact", compact);
    return () => document.body.classList.remove("compact");
  }, [compact]);

  const ctx = {
    d,
    api,
    openDoc: (targetType: "payment" | "job", targetId: string, title: string) =>
      setDoc({ targetType, targetId, title }),
  };

  return (
    <TrackerCtx.Provider value={ctx}>
      <header className="topbar">
        <div className="wrap">
          <div className="brand">
            <div>
              <h1>
                Starpoint <span>RenoTracker</span>
              </h1>
              <div className="printhead printonly">
                {d.vendor.legal_name ?? d.vendor.name} · {d.asOf} · printed{" "}
                {fdate(new Date().toISOString().slice(0, 10), true)}
              </div>
            </div>
          </div>
          <div className="right">
            {headerRight ?? (
              <div className="vendor">
                <div className="avatar">{d.vendor.initials}</div>
                <div className="vmeta">
                  <span className="vname">{d.vendor.name}</span>
                  <span className="vtrade">{d.vendor.trade}</span>
                </div>
              </div>
            )}
            <button className="export" title="Export" onClick={() => setSheet(true)}>
              <IconExport />
              <span className="lbl">Export</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="tabbar" role="tablist" aria-label="Sections">
        <button
          className={`tab${page === "work" ? " active" : ""}`}
          role="tab"
          aria-selected={page === "work"}
          onClick={() => setPage("work")}
        >
          <IconWork />
          Work
        </button>
        <button
          className={`tab${page === "payments" ? " active" : ""}`}
          role="tab"
          aria-selected={page === "payments"}
          onClick={() => setPage("payments")}
        >
          <IconPayments />
          Payments
        </button>
        <button
          className={`tab${page === "open" ? " active" : ""}`}
          role="tab"
          aria-selected={page === "open"}
          onClick={() => setPage("open")}
        >
          <IconOpen />
          Open Items
          <span className="badge">{d.openItems.length}</span>
        </button>
      </nav>

      <div className="wrap">
        {page === "work" && (
          <WorkPage compact={compact} setCompact={setCompact} {...(onEditJob ? { onEditJob } : {})} />
        )}
        {page === "payments" && (
          <PaymentsPage
            filter={filter}
            setFilter={setFilter}
            compact={compact}
            setCompact={setCompact}
            {...(onEditPayment ? { onEditPayment } : {})}
          />
        )}
        {page === "open" && <OpenItemsPage />}
      </div>

      {!api.readOnly && (onNewPayment || onNewJob) && (
        <div className="fab">
          {onNewJob && page === "work" && (
            <button className="fab-mini" onClick={onNewJob} title="New estimate">
              Est
            </button>
          )}
          {onNewPayment && (
            <button className="fab-main" onClick={onNewPayment} title="New transfer" aria-label="New transfer">
              <IconPlus />
            </button>
          )}
        </div>
      )}

      {doc && <DocViewer target={doc} onClose={() => setDoc(null)} />}
      {sheet && (
        <ExportSheet
          d={d}
          onClose={() => setSheet(false)}
          toast={api.toast}
          beforePrint={() => {
            setFilter("all");
            setCompact(false);
          }}
        />
      )}
    </TrackerCtx.Provider>
  );
}
