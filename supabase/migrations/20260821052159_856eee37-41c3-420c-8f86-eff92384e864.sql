
drop policy "owner manages jobs" on public.jobs;
drop policy "owner manages job revisions" on public.job_revisions;
drop policy "owner manages payments" on public.payments;
drop policy "owner manages allocations" on public.payment_allocations;
drop policy "owner manages attachments" on public.attachments;
drop policy "owner manages items" on public.items;
drop policy "owner manages vendor access" on public.vendor_access;

create policy "owner manages jobs" on public.jobs for all to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));

create policy "owner manages job revisions" on public.job_revisions for all to authenticated
  using (exists (select 1 from public.jobs j join public.vendors v on v.id = j.vendor_id where j.id = job_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.jobs j join public.vendors v on v.id = j.vendor_id where j.id = job_id and v.owner_id = auth.uid()));

create policy "owner manages payments" on public.payments for all to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));

create policy "owner manages allocations" on public.payment_allocations for all to authenticated
  using (exists (select 1 from public.payments p join public.vendors v on v.id = p.vendor_id where p.id = payment_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.payments p join public.vendors v on v.id = p.vendor_id where p.id = payment_id and v.owner_id = auth.uid()));

create policy "owner manages attachments" on public.attachments for all to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));

create policy "owner manages items" on public.items for all to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));

create policy "owner manages vendor access" on public.vendor_access for all to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));

drop function if exists public.owns_vendor(uuid);

revoke all on function public.check_allocation_sum() from public, anon, authenticated;
revoke all on function public.check_payment_alloc_sum() from public, anon, authenticated;
