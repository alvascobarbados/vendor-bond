import { supabase } from "@/integrations/supabase/client";
import type { Allocation, Attachment, Item, Job, Payment, TrackerData, Vendor } from "./tracker-model";

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase.from("vendors").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as Vendor[];
}

export async function fetchTracker(vendorId: string): Promise<TrackerData> {
  const [v, j, p, a, at, it] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", vendorId).single(),
    supabase.from("jobs").select("*").eq("vendor_id", vendorId),
    supabase.from("payments").select("*").eq("vendor_id", vendorId),
    supabase.from("payment_allocations").select("*, payments!inner(vendor_id)").eq("payments.vendor_id", vendorId),
    supabase.from("attachments").select("*").eq("vendor_id", vendorId),
    supabase.from("items").select("*").eq("vendor_id", vendorId).order("created_at"),
  ]);
  for (const r of [v, j, p, a, at, it]) if (r.error) throw r.error;

  const allocs = (a.data ?? []) as unknown as Allocation[];
  const payments = ((p.data ?? []) as unknown as Payment[]).map((row) => ({
    ...row,
    amount: Number(row.amount),
    allocations: allocs
      .filter((x) => x.payment_id === row.id)
      .map((x) => ({ ...x, amount: Number(x.amount) })),
  }));

  return {
    vendor: v.data as unknown as Vendor,
    jobs: ((j.data ?? []) as unknown as Job[]).map((row) => ({ ...row, contract_amount: Number(row.contract_amount) })),
    payments,
    attachments: (at.data ?? []) as unknown as Attachment[],
    items: (it.data ?? []) as unknown as Item[],
  };
}

export async function signUrl(path: string) {
  const { data, error } = await supabase.storage.from("proof").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
