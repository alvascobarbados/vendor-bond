import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  adminListVendors,
  adminNewSetupCode,
  adminResetPin,
  adminSaveVendor,
  adminSetAccessEnabled,
} from "@/lib/vendors-admin.functions";
import { deleteVendor } from "@/lib/owner.functions";
import { initialsOf, slugify, statusLine, type VendorRow } from "@/components/owner/vendor-status";
import { Toast } from "@/components/tracker/Toast";

export const Route = createFileRoute("/owner/vendors/$id")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: VendorDetail,
});

interface Draft {
  id?: string;
  name: string;
  contact_first_name: string;
  slug: string;
  trade: string;
  initials: string;
  legal_name: string;
  address: string;
  bank: { bank: string; account: string; transit: string; swift: string };
}

function toDraft(v?: VendorRow): Draft {
  const bank = (v?.bank ?? {}) as Record<string, string>;
  return {
    ...(v?.id ? { id: v.id } : {}),
    name: v?.name ?? "",
    contact_first_name: v?.contact_first_name ?? "",
    slug: v?.slug ?? "",
    trade: v?.trade ?? "",
    initials: v?.initials ?? "",
    legal_name: v?.legal_name ?? "",
    address: v?.address ?? "",
    bank: {
      bank: bank["bank"] ?? "",
      account: bank["account"] ?? "",
      transit: bank["transit"] ?? "",
      swift: bank["swift"] ?? "",
    },
  };
}

function VendorDetail() {
  const { id } = useParams({ from: "/owner/vendors/$id" });
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["admin-vendors"], queryFn: () => adminListVendors() });
  const vendor = useMemo(() => q.data?.vendors.find((v) => v.id === id), [q.data, id]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [code, setCode] = useState<{ code: string; message: string } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const isNew = id === "new";
  const d = draft ?? toDraft(isNew ? undefined : vendor);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...d, [k]: v });

  if (!isNew && q.isLoading) return <div className="loading">Loading…</div>;
  if (!isNew && !vendor) return <div className="loading">No such vendor.</div>;

  async function save() {
    if (!d.name.trim()) return setToast("Company name is required");
    setBusy(true);
    try {
      const r = await adminSaveVendor({
        data: {
          ...(d.id ? { id: d.id } : {}),
          name: d.name,
          contact_first_name: d.contact_first_name,
          slug: d.slug || slugify(d.contact_first_name || d.name),
          trade: d.trade,
          initials: d.initials || initialsOf(d.name),
          legal_name: d.legal_name,
          address: d.address,
          bank: d.bank,
        },
      });
      setToast("Vendor saved");
      await q.refetch();
      setDraft(null);
      if (isNew) void navigate({ to: "/owner/vendors/$id", params: { id: r.id } });
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ownerpage">
      <div className="ownerhead">
        <h2>{isNew ? "New vendor" : d.name || "Vendor"}</h2>
        <button className="ghost" onClick={() => void navigate({ to: "/owner/vendors" })}>
          Back
        </button>
      </div>

      <div className="ownercard">
        <div className="frow">
          <label>
            <span>Company</span>
            <input
              value={d.name}
              onChange={(e) => setDraft({ ...d, name: e.target.value, initials: d.initials || initialsOf(e.target.value) })}
            />
          </label>
          <label>
            <span>Contact first name</span>
            <input
              value={d.contact_first_name}
              onChange={(e) =>
                setDraft({
                  ...d,
                  contact_first_name: e.target.value,
                  slug: d.id ? d.slug : slugify(e.target.value),
                })
              }
            />
          </label>
        </div>
        <div className="frow">
          <label>
            <span>Slug (public handle)</span>
            <input value={d.slug} onChange={(e) => set("slug", slugify(e.target.value))} />
          </label>
          <label>
            <span>Initials</span>
            <input value={d.initials} onChange={(e) => set("initials", e.target.value.toUpperCase())} />
          </label>
        </div>
        <div className="frow">
          <label>
            <span>Trade</span>
            <input value={d.trade} onChange={(e) => set("trade", e.target.value)} />
          </label>
          <label>
            <span>Legal name</span>
            <input value={d.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
          </label>
        </div>
        <label className="fw">
          <span>Address</span>
          <input value={d.address} onChange={(e) => set("address", e.target.value)} />
        </label>
        <div className="frow">
          <label>
            <span>Bank</span>
            <input value={d.bank.bank} onChange={(e) => set("bank", { ...d.bank, bank: e.target.value })} />
          </label>
          <label>
            <span>Account</span>
            <input value={d.bank.account} onChange={(e) => set("bank", { ...d.bank, account: e.target.value })} />
          </label>
        </div>
        <div className="frow">
          <label>
            <span>Transit</span>
            <input value={d.bank.transit} onChange={(e) => set("bank", { ...d.bank, transit: e.target.value })} />
          </label>
          <label>
            <span>SWIFT</span>
            <input value={d.bank.swift} onChange={(e) => set("bank", { ...d.bank, swift: e.target.value })} />
          </label>
        </div>
        <div className="formacts">
          <button className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {vendor && (
        <div className="ownercard">
          <div className="sheethead">Access</div>
          <div className="vstatus">{statusLine(vendor)}</div>
          <div className="vacts">
            <label className="toggle">
              <input
                type="checkbox"
                checked={vendor.access?.enabled ?? false}
                onChange={async (e) => {
                  await adminSetAccessEnabled({ data: { vendor_id: vendor.id, enabled: e.target.checked } });
                  void q.refetch();
                }}
              />
              <span>Access enabled</span>
            </label>
            <button
              className="ghost"
              onClick={async () => {
                setCode(await adminNewSetupCode({ data: { vendor_id: vendor.id } }));
                void q.refetch();
              }}
            >
              New setup code
            </button>
            <button
              className="danger"
              onClick={async () => {
                if (!confirm(`Reset ${vendor.contact_first_name ?? vendor.name}'s PIN?`)) return;
                await adminResetPin({ data: { vendor_id: vendor.id } });
                setCode(await adminNewSetupCode({ data: { vendor_id: vendor.id } }));
                void q.refetch();
              }}
            >
              Reset PIN
            </button>
          </div>

          {code && (
            <div className="codebox">
              <div className="codehead">Setup code</div>
              <div className="codebig">
                {code.code.slice(0, 3)} {code.code.slice(3)}
              </div>
              <p className="hint">Valid for 7 days. Shown once — copy the message now.</p>
              <div className="formacts">
                <button
                  className="ghost"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(code.message)
                      .then(() => setToast("WhatsApp message copied"))
                      .catch(() => setToast("Couldn't copy"))
                  }
                >
                  Copy WhatsApp message
                </button>
                <button className="primary" onClick={() => setCode(null)}>
                  Done
                </button>
              </div>
            </div>
          )}

          <div className="events">
            {vendor.events.map((e, i) => (
              <div key={i} className="eventrow">
                <span className="mono">{new Date(e.at).toLocaleString()}</span>
                <span>{e.kind}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {vendor && (
        <div className="ownercard danger-zone">
          <div className="sheethead">Danger zone</div>
          <p className="hint">
            Deleting removes this vendor with every payment, estimate, note, attachment and stored file. Type the
            company name to confirm.
          </p>
          <label className="fw">
            <span>Company name</span>
            <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          </label>
          <div className="formacts">
            <button
              className="danger"
              disabled={confirmName.trim() !== vendor.name}
              onClick={async () => {
                try {
                  await deleteVendor({ data: { vendor_id: vendor.id, confirm: confirmName.trim() } });
                  void navigate({ to: "/owner/vendors" });
                } catch (e) {
                  setToast(e instanceof Error ? e.message : "Couldn't delete");
                }
              }}
            >
              Delete vendor
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
