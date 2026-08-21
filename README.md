# STARPOINT RENO

# Build "Starpoint RenoTracker" — a per-vendor contract & payment tracker shared between a homeowner and each contractor

I'm renovating a house ("Starpoint", Barbados). For each contractor I want one shared, phone-first source of truth for **what was quoted, what's confirmed, what's been paid against each quote, what's left, every bill I reimbursed, and the open questions** — with the bank slip or invoice attached to every line. I (the owner) edit; the contractor opens a link and sees exactly the same numbers, read-only. A fully working single-file HTML prototype is attached (`starpoint_renotracker.html`) together with screenshots (`screens/`), the real data (`renotracker_seed.json`) and the real documents (`documents/`). **Match the prototype's layout, wording and visual language closely — it has been refined on a phone with the contractor in mind. Build it properly on top: database, auth, uploads, multi-vendor.**

## Stack

React + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres, Auth, Storage, RLS). Mobile-first PWA (installable, works offline for viewing). All money is BBD, shown as `$12,054.30` (cents only when there are cents, e.g. `$38,000` / `$1,606.21`). Every figure, estimate number and bank reference is set in a monospace face with tabular numerals.

## The four rules (enforce them in the data model, not just the UI)

1. **Two streams, never mixed.** A transfer is either a *contract payment* (drawn down against one or more approved estimates) or a *bill reimbursement* (materials, equipment, engineer, etc. paid at cost). Totals are always shown per stream and combined.

2. **The approved estimate is the contract.** A job's contract value comes from its estimate; if the scope changes the vendor re-issues the estimate and the contract value is updated (keep a history).

3. **Every transfer carries the bank reference (T-number) and my sequential "Payment N" number for that vendor.** "Payment 17" is how I label transfers in WhatsApp and on the slips; it is the primary human label everywhere in the app. Bills that I didn't number show as "Unnumbered".

4. **Pending quotes are shown but never counted.** A job is `pending` (quoted, not approved), `confirmed` (approved, in progress) or `closed` (paid in full). Only confirmed + closed count in any total, meter, count, summary or export.

## Data model (Supabase)

- `vendors` — id, slug, name, legal_name, trade, initials, contact_first_name, bank details (jsonb), owner_id.

- `jobs` — id, vendor_id, estimate_no (text, e.g. "1016"), title, scope, contract_amount, status (`pending|confirmed|closed`), approved_at, sort_order; `job_revisions` (job_id, contract_amount, estimate_file_id, note, created_at) for re-issued estimates.

- `payments` — id, vendor_id, payment_no (int, nullable, unique per vendor when set), date, bank_ref (text), amount, kind (`contract|bill`), description, detail, created_by. For `bill`, description/detail describe what was reimbursed.

- `payment_allocations` — payment_id, job_id, amount, invoice_ref (the vendor's invoice/QUO number for that drawdown). A constraint/trigger: for `kind=contract`, allocations must sum to `payments.amount`; the UI shows an amber "allocation ≠ amount" warning while editing.

- `attachments` — id, vendor_id, target_type (`payment|job|item`), target_id, storage_path, file_name, mime, is_primary, uploaded_by, created_at. Supabase Storage bucket `proof/` (private; signed URLs). Images are downscaled client-side to ≤1600 px JPEG before upload; PDFs kept as-is.

- `items` — open items/notes: id, vendor_id, target_type (`job|payment|general`), target_id, text, status (`open|resolved`), created_by, resolved_at. Notes are visible to both sides.

- `vendor_access` — vendor_id, token (for the contractor's read-only link), optional PIN, last_seen_at.

- Derived (views or client): per job `paid = Σ allocations`, `balance = contract − paid`, `pct`; per vendor open-job totals; per month totals by stream; "through Payment N · date" = latest transfer.

## Roles

- **Owner (me):** email/password or magic link. Full CRUD on everything across vendors; vendor switcher in the header (avatar chip). 

- **Vendor (contractor):** opens `/v/<token>` (optionally enters a PIN). Read-only view of *their* tracker only: can open attachments, add notes (marked as theirs), and resolve items addressed to them. Cannot see other vendors or edit money. RLS must enforce this.

## Screens (three tabs — bottom bar on phones, top tab strip on desktop; see screens/)

**Work** (`11-…`, `12-…`, `01-…`)

- As-of line: vendor name (phone) · "Through Payment 18 · 20 Aug 2026", with a **Compact / Detailed** toggle (remembered per user). Compact hides scope, document chips, payment rows, notes and detail lines; cards shrink to estimate · status · title · amount · Paid / % / Balance + thin bar (`14-…`, `02-…`).

- Standing band: **Contract / Paid / Balance** for confirmed jobs, with "N confirmed jobs", "N transfers", "left to invoice"; a segmented master bar (one segment per job) and "53% paid".

- **Confirmed work**: one card per job — estimate pill "EST 1016", status pill (**✓ Confirmed** emerald outline / **✓ Paid in full** solid emerald), title, scope, "Estimate 1016" document chip (+ attach), contract amount top-right, then "Paid $13,000 · 57% paid · Balance $10,000", a bar with **one segment per payment**, and the payment rows: `2 Jul · $9,000 · Payment 8 · INV 1011 · [✓ T4452199] [📎]`. Split payments read "Payment 14 · split with 1017, 1019 · INV 1011". ≥5 payments → show latest 3 + "Show all N payments". A paid-in-full job keeps its full history and a 100% bar. "+ Add note" under each card.

- **Pending approval** (`13-…`): dashed amber cards, "Pending approval" pill, amount labelled "Quoted", line "Not approved yet — not included in any total". Section header: "2 quotes · $43,000 · not in totals".

- **Bills reimbursed**: one row per bill: date · **Payment 16** · description · detail line · amount · `[✓ T4954943] [📎]` · "+ Add note"; footer "Bills total".

**Payments** (`15-…`, `16-…`, `03-…`)

- Hero "Total paid $108,038.71" with "Contract $48,800 · Bills $59,238.71 · Transfers 19"; filter **All / Contract / Bills**; the Compact/Detailed toggle.

- Ledger **newest first, grouped by month** with a **sticky month header**: "August 2026 — $12,054.30 — Contract $6,000 · Bills $6,054.30 · 3 transfers" (totals follow the active filter). Each row: date · CONTRACT/BILL tag · **Payment 17** · purpose ("Est 1016 · East Wing rebuild · INV 1011" or "Split · 1016 $2,000 · 1017 $2,000 · 1019 $2,000") · detail line for bills · `[✓ T8949204] [📎]` · amount · "+ Add note".

- **Add payment** (owner, floating button): amount, date, bank ref (T-number, required), kind, Payment N (auto = last+1, editable), for contract: allocation rows with each job's current balance shown and a live "remaining to allocate" that must reach 0, invoice ref per allocation; for bills: description + detail; attach slip photo/PDF (camera on phone). On save, offer **"Copy WhatsApp caption"** in my format, e.g. `Payment 17 - Part Payments toward various Quotes - BBD$6,000` followed by one line per allocation (`Estimate 1016 - East Wing Rebuild - Previous $11,000 - This $2,000 - Remaining $10,000`).

**Open Items** (`18-…`, `04-…`)

- "Add a note" input; list of open items each with its source label ("Bill · Payment 16 · 14 Aug", "Est 1016 · East Wing rebuild", "General"), **Resolve** button; a Resolved section (reopenable); a "Total paid to <vendor>" card (Contract / Bills reimbursed / Total to date). The tab shows a badge with the open count. A note added anywhere (job, payment, bill) appears inline at its source **and** here.

**Documents** (`05-…`, `17-…`): tapping any chip opens a full-screen viewer (dark backdrop) listing every attachment for that payment/job (images inline, PDFs embedded), with **Attach** and per-file **Remove** (owner only). Chip states: ✓ (has proof) / 📎 (attached on this device — prototype only) / dashed "no proof yet". Chips show a count when >1.

**Export** (`06-…`, `19-…`; header button → sheet): **Save as PDF** (all three pages as a clean statement: header with vendor, "Through Payment N · date", print date; page per section; pending cards and month headers included), **Share summary** (native share sheet → WhatsApp; text exactly like the prototype's `summaryText()`: confirmed jobs with contract/paid/balance, pending quotes (not in totals), totals, open items), **Download ledger (CSV)** (one row per transfer with a column per job allocation + jobs block), **Download data (JSON)**.

## Design system (copy exactly)

Background `#ECEEEA`, surface `#FFFFFF`, ink `#15201B`, muted `#5E6B63`, faint `#8A968E`, lines `#DBDFD8`/`#C7CDC3`, **paid emerald `#1E6F50`** (alt segment `#2C8A66`, tint `#F1F6F2`, line `#D5E6DC`), bar track `#E4E7E1`, bill slate `#4A6E8A`, **flag amber `#A85A25`** on `#F6EDE2` (only ever for pending/open items/warnings). System sans for UI; monospace tabular numerals for every number, estimate number and bank ref. 14 px card radius, 1 px borders, no shadows, no other decoration. Status pills are uppercase 11 px. The look is an Apple-minimal ledger; resist adding colour.

## Seed & acceptance

Import `renotracker_seed.json` (1 vendor, 7 jobs, 19 payments with allocations and invoice refs, 6 open items) and upload the files under `documents/` as attachments (each payment lists its `files`; each job its `estimateFile`). After import the app must show: Work — Contract **$71,500**, Paid **$38,000**, Balance **$33,500**, **53%**, "4 confirmed jobs", "6 transfers"; 1016 $13,000/$10,000/57%, 1017 $9,000/$5,500/62%, 1019 $8,000/$6,000/57%, 1023 $8,000/$12,000/40%, 1011 paid in full $10,800; Pending "2 quotes · $43,000 · not in totals". Payments — **$108,038.71**, Contract $48,800, Bills $59,238.71, 19 transfers; months Aug $12,054.30 (3), Jul $39,174.41 (8), Jun $56,810.00 (8). Open items — 6. These numbers are verified against the bank slips; treat them as the test.

## Out of scope for v1

Multi-currency, invoicing the vendor from the app, payments initiated from the app, accounting integrations. Keep v1 to the three tabs, add/edit forms, attachments, roles, export.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e9c485dd-0724-4282-9c7b-be385cdf07c7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
