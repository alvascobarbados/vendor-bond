import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { dataOverview, exportEverything } from "@/lib/admin.functions";
import { Toast } from "@/components/tracker/Toast";

export const Route = createFileRoute("/owner/data")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: DataPage,
});

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DataPage() {
  const q = useQuery({ queryKey: ["data-overview"], queryFn: () => dataOverview() });
  const [toast, setToast] = useState("");

  async function dump(kind: "json" | "csv") {
    const all = await exportEverything();
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "json") {
      download(`renotracker-${stamp}.json`, JSON.stringify(all, null, 2), "application/json");
    } else {
      download(`renotracker-payments-${stamp}.csv`, toCsv(all.payments as Record<string, unknown>[]), "text/csv");
      download(`renotracker-jobs-${stamp}.csv`, toCsv(all.jobs as Record<string, unknown>[]), "text/csv");
    }
    setToast("Export downloaded");
  }

  return (
    <div className="ownerpage">
      <div className="ownerhead">
        <h2>Data</h2>
      </div>
      <div className="ownercard">
        <div className="sheethead">Export</div>
        <div className="formacts">
          <button className="primary" onClick={() => void dump("json")}>
            Everything as JSON
          </button>
          <button className="ghost" onClick={() => void dump("csv")}>
            Payments &amp; jobs as CSV
          </button>
        </div>
      </div>

      <div className="ownercard">
        <div className="sheethead">Storage</div>
        <p className="hint">
          {q.data ? `${q.data.attachments} files · ${mb(q.data.bytes)} in the proof bucket` : "Counting…"}
        </p>
      </div>

      <div className="ownercard">
        <div className="sheethead">Recent contractor activity</div>
        <div className="events">
          {(q.data?.activity ?? []).map((e, i) => (
            <div key={i} className="eventrow">
              <span className="mono">{new Date(e.at).toLocaleString()}</span>
              <span>
                {e.vendor} · {e.kind}
              </span>
            </div>
          ))}
          {!q.isLoading && !(q.data?.activity ?? []).length && <p className="hint">Nothing yet.</p>}
        </div>
      </div>
      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
