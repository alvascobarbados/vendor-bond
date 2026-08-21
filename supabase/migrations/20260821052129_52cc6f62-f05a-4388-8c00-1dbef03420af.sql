
create type public.job_status as enum ('pending','confirmed','closed');
create type public.payment_kind as enum ('contract','bill');
create type public.item_status as enum ('open','resolved');
create type public.attach_target as enum ('payment','job','item');
create type public.item_target as enum ('job','payment','general');

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  trade text,
  initials text,
  contact_first_name text,
  address text,
  bank jsonb not null default '{}'::jsonb,
  owner_id uuid,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  estimate_no text not null,
  title text not null,
  scope text,
  contract_amount numeric(12,2) not null default 0,
  status public.job_status not null default 'pending',
  approved_at date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (vendor_id, estimate_no)
);

create table public.job_revisions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contract_amount numeric(12,2) not null,
  estimate_file_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  payment_no int,
  date date not null,
  bank_ref text not null,
  amount numeric(12,2) not null,
  kind public.payment_kind not null,
  description text,
  detail text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index payments_vendor_no_uniq on public.payments(vendor_id, payment_no) where payment_no is not null;

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  amount numeric(12,2) not null,
  invoice_ref text
);
create index payment_allocations_payment_idx on public.payment_allocations(payment_id);
create index payment_allocations_job_idx on public.payment_allocations(job_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  target_type public.attach_target not null,
  target_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime text,
  is_primary boolean not null default false,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index attachments_target_idx on public.attachments(vendor_id, target_type, target_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  target_type public.item_target not null default 'general',
  target_id uuid,
  text text not null,
  status public.item_status not null default 'open',
  created_by uuid,
  author_label text not null default 'owner',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index items_vendor_idx on public.items(vendor_id);

create table public.vendor_access (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  token text not null unique,
  pin text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.owns_vendor(_vendor_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vendors v where v.id = _vendor_id and v.owner_id = auth.uid())
$$;

create or replace function public.check_allocation_sum()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _payment_id uuid;
  _kind public.payment_kind;
  _amount numeric(12,2);
  _sum numeric(12,2);
begin
  _payment_id := coalesce(new.payment_id, old.payment_id);
  select p.kind, p.amount into _kind, _amount from public.payments p where p.id = _payment_id;
  if _kind is null then return null; end if;
  if _kind <> 'contract' then return null; end if;
  select coalesce(sum(a.amount),0) into _sum from public.payment_allocations a where a.payment_id = _payment_id;
  if abs(_sum - _amount) > 0.005 then
    raise exception 'Allocations (%) must sum to the payment amount (%)', _sum, _amount;
  end if;
  return null;
end;
$$;

create constraint trigger payment_allocations_sum_check
after insert or update or delete on public.payment_allocations
deferrable initially deferred
for each row execute function public.check_allocation_sum();

create or replace function public.check_payment_alloc_sum()
returns trigger language plpgsql security definer set search_path = public as $$
declare _sum numeric(12,2);
begin
  if new.kind <> 'contract' then return null; end if;
  select coalesce(sum(a.amount),0) into _sum from public.payment_allocations a where a.payment_id = new.id;
  if abs(_sum - new.amount) > 0.005 then
    raise exception 'Allocations (%) must sum to the payment amount (%)', _sum, new.amount;
  end if;
  return null;
end;
$$;

create constraint trigger payments_sum_check
after insert or update on public.payments
deferrable initially deferred
for each row execute function public.check_payment_alloc_sum();

grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
grant select, insert, update, delete on public.job_revisions to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.payment_allocations to authenticated;
grant select, insert, update, delete on public.attachments to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.vendor_access to authenticated;
grant all on public.vendors, public.jobs, public.job_revisions, public.payments,
  public.payment_allocations, public.attachments, public.items, public.vendor_access to service_role;

alter table public.vendors enable row level security;
alter table public.jobs enable row level security;
alter table public.job_revisions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.attachments enable row level security;
alter table public.items enable row level security;
alter table public.vendor_access enable row level security;

create policy "owner manages vendors" on public.vendors for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner manages jobs" on public.jobs for all to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create policy "owner manages job revisions" on public.job_revisions for all to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and public.owns_vendor(j.vendor_id)))
  with check (exists (select 1 from public.jobs j where j.id = job_id and public.owns_vendor(j.vendor_id)));

create policy "owner manages payments" on public.payments for all to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create policy "owner manages allocations" on public.payment_allocations for all to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id and public.owns_vendor(p.vendor_id)))
  with check (exists (select 1 from public.payments p where p.id = payment_id and public.owns_vendor(p.vendor_id)));

create policy "owner manages attachments" on public.attachments for all to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create policy "owner manages items" on public.items for all to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create policy "owner manages vendor access" on public.vendor_access for all to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create policy "owner reads proof" on storage.objects for select to authenticated
  using (bucket_id = 'proof' and exists (
    select 1 from public.vendors v where v.owner_id = auth.uid()
      and (storage.foldername(name))[1] = v.id::text));

create policy "owner writes proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'proof' and exists (
    select 1 from public.vendors v where v.owner_id = auth.uid()
      and (storage.foldername(name))[1] = v.id::text));

create policy "owner deletes proof" on storage.objects for delete to authenticated
  using (bucket_id = 'proof' and exists (
    select 1 from public.vendors v where v.owner_id = auth.uid()
      and (storage.foldername(name))[1] = v.id::text));
