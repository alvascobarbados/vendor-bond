import { fdate, fmt, money, pct } from "./format";

export type JobStatus = "pending" | "confirmed" | "closed";
export type PaymentKind = "contract" | "bill";

export interface Vendor {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  trade: string | null;
  initials: string | null;
  contact_first_name: string | null;
  address: string | null;
  bank: Record<string, string> | null;
}

export interface Job {
  id: string;
  vendor_id: string;
  estimate_no: string;
  title: string;
  scope: string | null;
  contract_amount: number;
  status: JobStatus;
  sort_order: number;
}

export interface Allocation {
  id: string;
  payment_id: string;
  job_id: string;
  amount: number;
  invoice_ref: string | null;
}

export interface Payment {
  id: string;
  vendor_id: string;
  payment_no: number | null;
  date: string;
  bank_ref: string;
  amount: number;
  kind: PaymentKind;
  description: string | null;
  detail: string | null;
  allocations: Allocation[];
}

export interface Attachment {
  id: string;
  vendor_id: string;
  target_type: "payment" | "job" | "item";
  target_id: string;
  storage_path: string;
  file_name: string;
  mime: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  vendor_id: string;
  target_type: "job" | "payment" | "general";
  target_id: string | null;
  text: string;
  status: "open" | "resolved";
  author_label: string;
}

export interface TrackerData {
  vendor: Vendor;
  jobs: Job[];
  payments: Payment[];
  attachments: Attachment[];
  items: Item[];
}

export function docKey(targetType: string, targetId: string) {
  return `${targetType}:${targetId}`;
}

/** Everything the three tabs need, derived once. Pending quotes never count. */
export function derive(data: TrackerData) {
  const jobs = [...data.jobs].sort((a, b) => a.sort_order - b.sort_order);
  const payments = [...data.payments].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.payment_no ?? 0) - (b.payment_no ?? 0),
  );

  const open = jobs.filter((j) => j.status === "confirmed");
  const closed = jobs.filter((j) => j.status === "closed");
  const pending = jobs.filter((j) => j.status === "pending");
  const pendingValue = pending.reduce((s, j) => s + j.contract_amount, 0);

  const allocOf = (p: Payment, jobId: string) => p.allocations.find((a) => a.job_id === jobId);
  const paymentsFor = (jobId: string) => payments.filter((p) => allocOf(p, jobId));
  const paid = (jobId: string) => paymentsFor(jobId).reduce((s, p) => s + (allocOf(p, jobId)?.amount ?? 0), 0);

  const openValue = open.reduce((s, j) => s + j.contract_amount, 0);
  const openPaid = open.reduce((s, j) => s + paid(j.id), 0);
  const openTransfers = payments.filter((p) => open.some((j) => allocOf(p, j.id))).length;

  const contractTotal = payments.filter((p) => p.kind === "contract").reduce((s, p) => s + p.amount, 0);
  const billTotal = payments.filter((p) => p.kind === "bill").reduce((s, p) => s + p.amount, 0);
  const grandTotal = contractTotal + billTotal;

  const last = payments[payments.length - 1];
  const lastN = payments.reduce((m, p) => Math.max(m, p.payment_no ?? 0), 0);
  const asOf = `${lastN ? `Through Payment ${lastN} · ` : ""}${last ? fdate(last.date, true) : "No transfers yet"}`;

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  const allocSum = (p: Payment) => p.allocations.reduce((s, a) => s + a.amount, 0);
  const mismatch = (p: Payment) => p.kind === "contract" && Math.abs(allocSum(p) - p.amount) > 0.005;

  const payLabel = (p: Payment) => (p.payment_no ? `Payment ${p.payment_no}` : "Unnumbered");

  /** one line that says what a transfer was for */
  const purpose = (p: Payment) => {
    if (p.kind !== "contract") return p.description ?? "";
    if (p.allocations.length === 1) {
      const a = p.allocations[0]!;
      const j = jobById.get(a.job_id);
      return `Est ${j?.estimate_no ?? ""} · ${j?.title ?? ""}${a.invoice_ref ? ` · ${a.invoice_ref}` : ""}`;
    }
    return `Split · ${p.allocations
      .map((a) => `${jobById.get(a.job_id)?.estimate_no ?? ""} ${money(a.amount)}`)
      .join(" · ")}`;
  };

  /** the row label inside a job card */
  const rowLabel = (p: Payment, jobId: string) => {
    let s = payLabel(p);
    if (p.allocations.length > 1) {
      s += ` · split with ${p.allocations
        .filter((a) => a.job_id !== jobId)
        .map((a) => jobById.get(a.job_id)?.estimate_no ?? "")
        .join(", ")}`;
    }
    const inv = allocOf(p, jobId)?.invoice_ref;
    if (inv) s += ` · ${inv}`;
    return s;
  };

  /** where a note lives — derived, nothing stored */
  const itemSource = (it: Item) => {
    if (it.target_type === "general" || !it.target_id) return "General";
    if (it.target_type === "job") {
      const j = jobById.get(it.target_id);
      return j ? `Est ${j.estimate_no} · ${j.title}` : "Job";
    }
    const p = paymentById.get(it.target_id);
    if (!p) return "Payment";
    const head = p.kind === "contract" ? payLabel(p) : `Bill${p.payment_no ? ` · Payment ${p.payment_no}` : ""}`;
    return `${head} · ${fdate(p.date)}`;
  };

  const openItems = data.items.filter((i) => i.status === "open");
  const resolvedItems = data.items.filter((i) => i.status === "resolved");

  const attachmentsFor = (targetType: string, targetId: string) =>
    data.attachments.filter((a) => a.target_type === targetType && a.target_id === targetId);

  return {
    vendor: data.vendor,
    jobs,
    payments,
    bills: payments.filter((p) => p.kind === "bill"),
    open,
    closed,
    pending,
    pendingValue,
    openValue,
    openPaid,
    openTransfers,
    contractTotal,
    billTotal,
    grandTotal,
    asOf,
    lastN,
    lastDate: last?.date ?? null,
    paid,
    paymentsFor,
    allocOf,
    allocSum,
    mismatch,
    payLabel,
    purpose,
    rowLabel,
    itemSource,
    openItems,
    resolvedItems,
    attachmentsFor,
    jobById,
    paymentById,
    masterPct: Math.round(pct(openPaid, openValue)),
  };
}

export type Derived = ReturnType<typeof derive>;

/** WhatsApp summary — same shape as the prototype's summaryText() */
export function summaryText(d: Derived) {
  const L: string[] = [];
  L.push(`*Starpoint · ${d.vendor.name}*`);
  L.push(d.asOf);
  L.push("");
  L.push("*Confirmed work*");
  d.open.forEach((j) => {
    const g = d.paid(j.id);
    L.push(
      `Est ${j.estimate_no} ${j.title} — contract ${money(j.contract_amount)} · paid ${money(g)} · balance ${money(
        j.contract_amount - g,
      )}`,
    );
  });
  d.closed.forEach((j) => L.push(`Est ${j.estimate_no} ${j.title} — ${money(j.contract_amount)} · paid in full`));
  L.push(
    `Confirmed jobs: ${money(d.openPaid)} paid of ${money(d.openValue)} · balance ${money(
      d.openValue - d.openPaid,
    )} (${d.masterPct}%)`,
  );
  L.push("");
  if (d.pending.length) {
    L.push("*Pending approval (not in totals)*");
    d.pending.forEach((j) => L.push(`Est ${j.estimate_no} ${j.title} — ${money(j.contract_amount)}`));
    L.push("");
  }
  L.push("*Paid to date*");
  L.push(
    `Contract ${money(d.contractTotal)} · Bills ${fmt(d.billTotal, true)} · Total ${fmt(d.grandTotal, true)} (${
      d.payments.length
    } transfers)`,
  );
  if (d.openItems.length) {
    L.push("");
    L.push(`*Open items (${d.openItems.length})*`);
    d.openItems.forEach((n) => L.push(`• ${n.text}`));
  }
  return L.join("\n");
}

export function csvText(d: Derived) {
  const q = (s: unknown) => {
    const v = String(s ?? "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const jobs = d.jobs;
  const rows: unknown[][] = [
    ["Date", "Payment", "Bank ref", "Type", "Purpose", "Detail", "Amount"].concat(
      jobs.map((j) => `Est ${j.estimate_no}`),
    ),
  ];
  d.payments.forEach((p) => {
    rows.push(
      [
        p.date,
        p.payment_no ?? "",
        p.bank_ref,
        p.kind === "contract" ? "Contract" : "Bill",
        d.purpose(p),
        p.kind === "contract" ? "" : (p.detail ?? ""),
        p.amount.toFixed(2),
      ].concat(jobs.map((j) => (d.allocOf(p, j.id) ? d.allocOf(p, j.id)!.amount.toFixed(2) : ""))),
    );
  });
  rows.push([]);
  rows.push(["Totals", "", "", "Contract", "", "", d.contractTotal.toFixed(2)]);
  rows.push(["", "", "", "Bills", "", "", d.billTotal.toFixed(2)]);
  rows.push(["", "", "", "Total", "", "", d.grandTotal.toFixed(2)]);
  rows.push([]);
  rows.push(["Estimate", "Job", "Contract", "Paid", "Balance", "Status"]);
  jobs.forEach((j) => {
    const g = d.paid(j.id);
    rows.push([
      j.estimate_no,
      j.title,
      j.contract_amount.toFixed(2),
      g.toFixed(2),
      (j.contract_amount - g).toFixed(2),
      j.status,
    ]);
  });
  return "\uFEFF" + rows.map((r) => r.map(q).join(",")).join("\r\n");
}

/** WhatsApp caption for a saved contract payment, in the owner's format */
export function whatsappCaption(
  d: Derived,
  payment: { payment_no: number | null; amount: number; kind: string },
  allocations: { job_id: string; amount: number }[],
  previousPaid: Record<string, number>,
) {
  const label = payment.payment_no ? `Payment ${payment.payment_no}` : "Payment";
  if (payment.kind !== "contract") {
    return `${label} - Reimbursement of bills - BBD${money(payment.amount).replace("$", "$")}`;
  }
  const head = `${label} - Part Payments toward various Quotes - BBD${money(payment.amount)}`;
  const lines = allocations.map((a) => {
    const j = d.jobById.get(a.job_id);
    const prev = previousPaid[a.job_id] ?? 0;
    const remaining = (j?.contract_amount ?? 0) - prev - a.amount;
    return `Estimate ${j?.estimate_no ?? ""} - ${j?.title ?? ""} - Previous ${money(prev)} - This ${money(
      a.amount,
    )} - Remaining ${money(remaining)}`;
  });
  return [head, ...lines].join("\n");
}
