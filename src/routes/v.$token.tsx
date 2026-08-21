import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getVendorTracker, vendorAddNote, vendorResolveItem, vendorSignUrl } from "@/lib/vendor.functions";
import type { TrackerData } from "@/lib/tracker-model";
import { Tracker } from "@/components/tracker/Tracker";
import { Toast } from "@/components/tracker/Toast";
import type { TrackerApi } from "@/components/tracker/TrackerContext";

export const Route = createFileRoute("/v/$token")({
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
  component: VendorView,
});

function VendorView() {
  const { token } = Route.useParams();
  const [pin, setPin] = useState("");
  const [entered, setEntered] = useState("");
  const [toast, setToast] = useState("");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["vendor-tracker", token, entered],
    queryFn: () => getVendorTracker({ data: entered ? { token, pin: entered } : { token } }),
    retry: false,
  });

  if (q.isLoading) return <div className="loading">Loading…</div>;

  if (q.error) {
    const msg = String((q.error as Error).message ?? "");
    if (msg.includes("PIN_REQUIRED"))
      return (
        <div className="authwrap">
          <div className="authcard">
            <h1>
              Starpoint <span>RenoTracker</span>
            </h1>
            <p className="lead">Enter the PIN you were given to open your tracker.</p>
            <label className="fw">
              <span>PIN</span>
              <input
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setEntered(pin)}
              />
            </label>
            <button className="primary fw" onClick={() => setEntered(pin)}>
              Open
            </button>
          </div>
        </div>
      );
    return (
      <div className="loading">
        <p>This link isn't valid. Ask for a fresh one.</p>
      </div>
    );
  }

  const data = q.data as unknown as TrackerData;
  const access = entered ? { token, pin: entered } : { token };
  const refresh = () => void qc.invalidateQueries({ queryKey: ["vendor-tracker", token, entered] });

  const api: TrackerApi = {
    readOnly: true,
    signUrl: async (path) => (await vendorSignUrl({ data: { ...access, path } })).url,
    addNote: async (target_type, target_id, text) => {
      await vendorAddNote({ data: { ...access, target_type, target_id, text } });
    },
    setResolved: async (id, resolved) => {
      if (!resolved) return;
      await vendorResolveItem({ data: { ...access, id } });
    },
    refresh,
    toast: setToast,
  };

  return (
    <>
      <Tracker data={data} api={api} />
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}
