import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  adminListVendors,
  adminNewSetupCode,
  adminResetPin,
  adminSaveVendor,
  adminSetAccessEnabled,
} from "@/lib/vendors-admin.functions";

type Row = Awaited<ReturnType<typeof adminListVendors>>["vendors"][number];

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

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initialsOf(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function toDraft(v?: Row): Draft {
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

function ago(iso: string | null) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hours ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function statusLine(v: Row) {
  const a = v.access;
  if (!a) return "No access set up yet.";
  if (!a.enabled) return "Access switched off.";
  const bits: string[] = [];
  if (a.has_setup_code && a.setup_code_expires_at)
    bits.push(
      new Date(a.setup_code_expires_at) > new Date() ? "Setup code active · not used yet" : "Setup code expired",
    );
  if (a.pin_set_at)
    bits.push(
      `PIN set ${new Date(a.pin_set_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}${a.last_device ? ` on ${a.last_device}` : ""}`,
    );
  if (!a.has_pin && !a.has_setup_code) bits.push("No PIN and no setup code");
  if (a.last_seen_at) bits.push(`Last seen ${ago(a.last_seen_at)}`);
  if (a.failed_attempts) bits.push(`${a.failed_attempts} failed tries`);
  if (a.locked_until && new Date(a.locked_until) > new Date())
    bits.push(
      `Locked until ${new Date(a.locked_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    );
  return bits.join(" · ");
}

export function VendorsScreen({
  onClose,
  toast,
  onChanged,
}: {
  onClose: () => void;
  toast: (m: string) => void;
  onChanged: () => void;
}) {
  const q = useQuery({ queryKey: ["admin-vendors"], queryFn: () => adminListVendors() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [code, setCode] = useState<{ vendor: string; code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const vendors = useMemo(() => q.data?.vendors ?? [], [q.data]);
  const refresh = () => {
    void q.refetch();
    onChanged();
  };

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return toast("Company name is required");
    setBusy(true);
    try {
      await adminSaveVendor({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name,
          contact_first_name: draft.contact_first_name,
          slug: draft.slug || slugify(draft.contact_first_name || draft.name),
          trade: draft.trade,
          initials: draft.initials || initialsOf(draft.name),
          legal_name: draft.legal_name,
          address: draft.address,
          bank: draft.bank,
        },
      });
      toast("Vendor saved");
      setDraft(null);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheetin form">
        <div className="sheethead">{draft ? (draft.id ? "Edit vendor" : "New vendor") : "Vendors"}</div>

        {!draft && (
          <>
            <div className="vlist">
              {vendors.map((v) => (
                <div className="vcard" key={v.id}>
                  <div className="vcardhead">
                    <span className="avatar sm">{v.initials}</span>
                    <span>
                      <b>{v.name}</b>
                      <small>
                        {v.contact_first_name} · /c/{v.slug}
                      </small>
                    </span>
                    <button className="ghost" onClick={() => setDraft(toDraft(v))}>
                      Edit
                    </button>
                  </div>
                  <div className="vstatus">{statusLine(v)}</div>
                  <div className="vacts">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={v.access?.enabled ?? false}
                        onChange={async (e) => {
                          await adminSetAccessEnabled({ data: { vendor_id: v.id, enabled: e.target.checked } });
                          refresh();
                        }}
                      />
                      <span>Access enabled</span>
                    </label>
                    <button
                      className="ghost"
                      onClick={async () => {
                        const r = await adminNewSetupCode({ data: { vendor_id: v.id } });
                        setCode({ vendor: v.name, ...r });
                        refresh();
                      }}
                    >
                      New setup code
                    </button>
                    <button
                      className="danger"
                      onClick={async () => {
                        if (!confirm(`Reset ${v.contact_first_name ?? v.name}'s PIN?`)) return;
                        await adminResetPin({ data: { vendor_id: v.id } });
                        const r = await adminNewSetupCode({ data: { vendor_id: v.id } });
                        setCode({ vendor: v.name, ...r });
                        refresh();
                      }}
                    >
                      Reset PIN
                    </button>
                  </div>
                </div>
              ))}
              {!vendors.length && !q.isLoading && <p className="oi-lead">No vendors yet.</p>}
            </div>
            <div className="formacts">
              <button className="ghost" onClick={onClose}>
                Close
              </button>
              <button className="primary" onClick={() => setDraft(toDraft())}>
                New vendor
              </button>
            </div>
          </>
        )}

        {draft && (
          <>
            <div className="frow">
              <label>
                <span>Company</span>
                <input
                  value={draft.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setDraft((d) =>
                      d ? { ...d, name, initials: d.initials || initialsOf(name) } : d,
                    );
                  }}
                />
              </label>
              <label>
                <span>Contact first name</span>
                <input
                  value={draft.contact_first_name}
                  onChange={(e) => {
                    const cf = e.target.value;
                    setDraft((d) => (d ? { ...d, contact_first_name: cf, slug: d.id ? d.slug : slugify(cf) } : d));
                  }}
                />
              </label>
            </div>
            <div className="frow">
              <label>
                <span>Slug (public handle)</span>
                <input value={draft.slug} onChange={(e) => set("slug", slugify(e.target.value))} />
              </label>
              <label>
                <span>Initials</span>
                <input value={draft.initials} onChange={(e) => set("initials", e.target.value.toUpperCase())} />
              </label>
            </div>
            <div className="frow">
              <label>
                <span>Trade</span>
                <input value={draft.trade} onChange={(e) => set("trade", e.target.value)} />
              </label>
              <label>
                <span>Legal name</span>
                <input value={draft.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
              </label>
            </div>
            <label className="fw">
              <span>Address</span>
              <input value={draft.address} onChange={(e) => set("address", e.target.value)} />
            </label>
            <div className="frow">
              <label>
                <span>Bank</span>
                <input value={draft.bank.bank} onChange={(e) => set("bank", { ...draft.bank, bank: e.target.value })} />
              </label>
              <label>
                <span>Account</span>
                <input
                  value={draft.bank.account}
                  onChange={(e) => set("bank", { ...draft.bank, account: e.target.value })}
                />
              </label>
            </div>
            <div className="frow">
              <label>
                <span>Transit</span>
                <input
                  value={draft.bank.transit}
                  onChange={(e) => set("bank", { ...draft.bank, transit: e.target.value })}
                />
              </label>
              <label>
                <span>SWIFT</span>
                <input
                  value={draft.bank.swift}
                  onChange={(e) => set("bank", { ...draft.bank, swift: e.target.value })}
                />
              </label>
            </div>
            <div className="formacts">
              <button className="ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}

        {code && (
          <div className="codebox">
            <div className="codehead">Setup code for {code.vendor}</div>
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
                    .then(() => toast("WhatsApp message copied"))
                    .catch(() => toast("Couldn't copy"))
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
      </div>
    </div>
  );
}
