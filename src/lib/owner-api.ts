import { supabase } from "@/integrations/supabase/client";
import type { JobDraft } from "@/components/tracker/JobForm";
import type { PaymentDraft } from "@/components/tracker/PaymentForm";

/** Images are downscaled to ≤1600px JPEG before upload; PDFs are kept as-is. */
async function prepare(file: File): Promise<{ blob: Blob; name: string; mime: string }> {
  if (!file.type.startsWith("image/")) return { blob: file, name: file.name, mime: file.type || "application/pdf" };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) throw new Error("no blob");
    return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg", mime: "image/jpeg" };
  } catch {
    return { blob: file, name: file.name, mime: file.type };
  }
}

export async function uploadAttachment(
  vendorId: string,
  file: File,
  target_type: "payment" | "job",
  target_id: string,
) {
  const { blob, name, mime } = await prepare(file);
  const path = `${vendorId}/${target_type}/${target_id}/${crypto.randomUUID()}-${name.replace(/[^\w.\-]+/g, "_")}`;
  const up = await supabase.storage.from("proof").upload(path, blob, { contentType: mime, upsert: false });
  if (up.error) throw up.error;
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from("attachments").insert({
    vendor_id: vendorId,
    target_type,
    target_id,
    storage_path: path,
    file_name: name,
    mime,
    uploaded_by: user.user?.id ?? null,
  });
  if (error) throw error;
}

export async function removeAttachment(id: string, storage_path: string) {
  await supabase.storage.from("proof").remove([storage_path]);
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) throw error;
}

export async function savePayment(vendorId: string, f: PaymentDraft) {
  const args: Record<string, unknown> = {
    _vendor_id: vendorId,
    _date: f.date,
    _bank_ref: f.bank_ref.trim(),
    _amount: Number(f.amount),
    _kind: f.kind,
    _allocations: f.allocations
      .filter((a) => a.job_id && Number(a.amount))
      .map((a) => ({ job_id: a.job_id, amount: Number(a.amount), invoice_ref: a.invoice_ref || null })),
  };
  if (f.payment_no) args["_payment_no"] = Number(f.payment_no);
  if (f.description) args["_description"] = f.description;
  if (f.detail) args["_detail"] = f.detail;
  if (f.id) args["_payment_id"] = f.id;

  const { error } = await supabase.rpc("upsert_payment", args as never);
  if (error) throw error;
}

export async function deletePayment(id: string) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}

export async function saveJob(vendorId: string, f: JobDraft, sortOrder: number) {
  const row = {
    vendor_id: vendorId,
    estimate_no: f.estimate_no.trim(),
    title: f.title.trim(),
    scope: f.scope || null,
    contract_amount: Number(f.contract_amount || 0),
    status: f.status,
    approved_at: f.status === "pending" ? null : new Date().toISOString().slice(0, 10),
  };
  if (f.id) {
    const { error } = await supabase.from("jobs").update(row).eq("id", f.id);
    if (error) throw error;
    if (f.revision_note.trim()) {
      await supabase.from("job_revisions").insert({
        job_id: f.id,
        contract_amount: row.contract_amount,
        note: f.revision_note.trim(),
      });
    }
  } else {
    const { error } = await supabase.from("jobs").insert({ ...row, sort_order: sortOrder });
    if (error) throw error;
  }
}

export async function deleteJob(id: string) {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

export async function addNote(
  vendorId: string,
  target_type: "job" | "payment" | "general",
  target_id: string | null,
  text: string,
) {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from("items").insert({
    vendor_id: vendorId,
    target_type,
    target_id,
    text,
    author_label: "Owner",
    created_by: user.user?.id ?? null,
  });
  if (error) throw error;
}

export async function setResolved(id: string, resolved: boolean) {
  const { error } = await supabase
    .from("items")
    .update({ status: resolved ? "resolved" : "open", resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}
