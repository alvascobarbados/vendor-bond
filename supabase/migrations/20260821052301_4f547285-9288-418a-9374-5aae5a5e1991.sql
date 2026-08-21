
create or replace function public.upsert_payment(
  _vendor_id uuid,
  _date date,
  _bank_ref text,
  _amount numeric,
  _kind public.payment_kind,
  _payment_no int default null,
  _description text default null,
  _detail text default null,
  _allocations jsonb default '[]'::jsonb,
  _payment_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  _id uuid;
begin
  if _payment_id is null then
    insert into public.payments (vendor_id, payment_no, date, bank_ref, amount, kind, description, detail, created_by)
    values (_vendor_id, _payment_no, _date, _bank_ref, _amount, _kind, _description, _detail, auth.uid())
    returning id into _id;
  else
    update public.payments
      set payment_no = _payment_no, date = _date, bank_ref = _bank_ref, amount = _amount,
          kind = _kind, description = _description, detail = _detail
      where id = _payment_id
      returning id into _id;
    if _id is null then raise exception 'Payment not found'; end if;
    delete from public.payment_allocations where payment_id = _id;
  end if;

  if _kind = 'contract' then
    insert into public.payment_allocations (payment_id, job_id, amount, invoice_ref)
    select _id, (a->>'job_id')::uuid, (a->>'amount')::numeric, nullif(a->>'invoice_ref','')
    from jsonb_array_elements(_allocations) a;
  end if;

  return _id;
end;
$$;

revoke all on function public.upsert_payment(uuid, date, text, numeric, public.payment_kind, int, text, text, jsonb, uuid) from public, anon;
grant execute on function public.upsert_payment(uuid, date, text, numeric, public.payment_kind, int, text, text, jsonb, uuid) to authenticated, service_role;
