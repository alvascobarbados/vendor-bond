import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/admin.functions";
import { Toast } from "@/components/tracker/Toast";

export const Route = createFileRoute("/owner/settings")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Settings,
});

function Settings() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const [f, setF] = useState({ owner_first_name: "", site_name: "", public_base_url: "", currency_code: "BBD" });
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (q.data)
      setF({
        owner_first_name: q.data.owner_first_name,
        site_name: q.data.site_name,
        public_base_url: q.data.public_base_url,
        currency_code: q.data.currency_code,
      });
  }, [q.data]);

  return (
    <div className="ownerpage">
      <div className="ownerhead">
        <h2>Settings</h2>
      </div>
      <div className="ownercard">
        <div className="frow">
          <label>
            <span>Your first name</span>
            <input
              value={f.owner_first_name}
              onChange={(e) => setF({ ...f, owner_first_name: e.target.value })}
            />
          </label>
          <label>
            <span>Site name</span>
            <input value={f.site_name} onChange={(e) => setF({ ...f, site_name: e.target.value })} />
          </label>
        </div>
        <p className="hint">Contractors see “Ask {f.owner_first_name || "…"}” on their tracker.</p>
        <div className="frow">
          <label>
            <span>Public base URL</span>
            <input value={f.public_base_url} onChange={(e) => setF({ ...f, public_base_url: e.target.value })} />
          </label>
          <label>
            <span>Currency</span>
            <input
              value={f.currency_code}
              maxLength={3}
              onChange={(e) => setF({ ...f, currency_code: e.target.value.toUpperCase() })}
            />
          </label>
        </div>
        <div className="formacts">
          <button
            className="primary"
            onClick={async () => {
              try {
                await saveSettings({ data: f });
                setToast("Settings saved");
                void q.refetch();
              } catch (e) {
                setToast(e instanceof Error ? e.message : "Couldn't save");
              }
            }}
          >
            Save
          </button>
        </div>
      </div>
      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
