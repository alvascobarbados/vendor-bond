drop policy if exists "owner reads proof" on storage.objects;
drop policy if exists "owner writes proof" on storage.objects;
drop policy if exists "owner deletes proof" on storage.objects;

create policy "owner reads proof" on storage.objects for select to authenticated
using (
  bucket_id = 'proof' and exists (
    select 1 from public.vendors v
    where v.owner_id = auth.uid()
      and (storage.foldername(storage.objects.name))[1] = v.id::text
  )
);

create policy "owner writes proof" on storage.objects for insert to authenticated
with check (
  bucket_id = 'proof' and exists (
    select 1 from public.vendors v
    where v.owner_id = auth.uid()
      and (storage.foldername(storage.objects.name))[1] = v.id::text
  )
);

create policy "owner updates proof" on storage.objects for update to authenticated
using (
  bucket_id = 'proof' and exists (
    select 1 from public.vendors v
    where v.owner_id = auth.uid()
      and (storage.foldername(storage.objects.name))[1] = v.id::text
  )
)
with check (
  bucket_id = 'proof' and exists (
    select 1 from public.vendors v
    where v.owner_id = auth.uid()
      and (storage.foldername(storage.objects.name))[1] = v.id::text
  )
);

create policy "owner deletes proof" on storage.objects for delete to authenticated
using (
  bucket_id = 'proof' and exists (
    select 1 from public.vendors v
    where v.owner_id = auth.uid()
      and (storage.foldername(storage.objects.name))[1] = v.id::text
  )
);