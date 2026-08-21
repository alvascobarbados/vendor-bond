import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { fetchTracker, signUrl } from "@/lib/tracker-queries";
import * as owner from "@/lib/owner-api";
import { derive, type Job, type Payment, type Vendor } from "@/lib/tracker-model";
import { Tracker } from "@/components/tracker/Tracker";
import { Toast } from "@/components/tracker/Toast";
import { PaymentForm, draftOf, emptyDraft, type PaymentDraft } from "@/components/tracker/PaymentForm";
import { JobForm, jobDraft, type JobDraft } from "@/components/tracker/JobForm";
import { OwnerMenu } from "@/components/owner/OwnerNav";
import type { TrackerApi } from "@/components/tracker/TrackerContext";

function VendorSwitcher({
  vendors,
  current,
  ownerName,
}: {
  vendors: Vendor[];
  current: Vendor;
  ownerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="vendorwrap">
      <button className="vendor" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <div className="avatar">{current.initials}</div>
        <div className="vmeta">
          <span className="vname">{current.name}</span>
          <span className="vtrade">{current.trade}</span>
        </div>
      </button>
      {open && (
        <div className="vendormenu" role="listbox">
          {vendors.map((v) => (
            <button
              key={v.id}
              role="option"
              aria-selected={v.id === current.id}
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/owner/t/$slug", params: { slug: v.slug } });
              }}
            >
              <span className="avatar sm">{v.initials}</span>
              <span>
                <b>{v.name}</b>
                <small>{v.trade}</small>
              </span>
            </button>
          ))}
          <button
            className="manage"
            onClick={() => {
              setOpen(false);
              setMenu(true);
            }}
          >
            Menu
          </button>
        </div>
      )}
      {menu && <OwnerMenu name={ownerName} onClose={() => setMenu(false)} />}
    </div>
  );
}

export function VendorTracker({
  vendor,
  vendors,
  ownerName,
}: {
  vendor: Vendor;
  vendors: Vendor[];
  ownerName: string;
}) {
  const qc = useQueryClient();
  const [toast, setToast] = useState("");
  const [payForm, setPayForm] = useState<PaymentDraft | null>(null);
  const [jForm, setJForm] = useState<JobDraft | null>(null);

  const trackerQ = useQuery({ queryKey: ["tracker", vendor.id], queryFn: () => fetchTracker(vendor.id) });

  if (!trackerQ.data) return <div className="loading">Loading {vendor.name}…</div>;

  const data = trackerQ.data;
  const d = derive(data);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["tracker", vendor.id] });

  const api: TrackerApi = {
    readOnly: false,
    signUrl,
    addNote: (t, id, text) => owner.addNote(vendor.id, t, id, text),
    setResolved: owner.setResolved,
    deleteItem: owner.deleteItem,
    upload: (file, tt, id) => owner.uploadAttachment(vendor.id, file, tt, id),
    removeAttachment: owner.removeAttachment,
    refresh,
    toast: setToast,
  };

  return (
    <>
      <Tracker
        data={data}
        api={api}
        headerRight={<VendorSwitcher vendors={vendors} current={vendor} ownerName={ownerName} />}
        onNewPayment={() => setPayForm(emptyDraft(d))}
        onEditPayment={(p: Payment) => setPayForm(draftOf(p))}
        onNewJob={() => setJForm(jobDraft())}
        onEditJob={(j: Job) => setJForm(jobDraft(j))}
      />
      {payForm && (
        <PaymentForm
          d={d}
          draft={payForm}
          toast={setToast}
          onClose={() => setPayForm(null)}
          onSave={async (f, slip) => {
            const id = await owner.savePayment(vendor.id, f);
            if (slip && id) await owner.uploadAttachment(vendor.id, slip, "payment", id);
            refresh();
          }}
          onDelete={async (id) => {
            await owner.deletePayment(id);
            refresh();
          }}
        />
      )}
      {jForm && (
        <JobForm
          draft={jForm}
          toast={setToast}
          onClose={() => setJForm(null)}
          onSave={async (f) => {
            await owner.saveJob(vendor.id, f, d.jobs.length + 1);
            refresh();
          }}
          onDelete={async (id) => {
            await owner.deleteJob(id);
            refresh();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );
}
