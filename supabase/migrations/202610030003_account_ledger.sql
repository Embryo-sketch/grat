-- Append-only account ledger for staff-confirmed manual credits and debits.
-- The customer balance is derived from entries; transfer requests never alter it.

create table if not exists public.account_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  entry_type text not null check (entry_type in ('credit', 'debit')),
  amount_cents bigint not null check (amount_cents > 0),
  description text not null check (char_length(btrim(description)) between 2 and 160),
  external_reference text check (external_reference is null or char_length(external_reference) <= 160),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists account_ledger_customer_created_idx
  on public.account_ledger_entries(customer_id, created_at desc);
create unique index if not exists account_ledger_customer_reference_unique
  on public.account_ledger_entries(customer_id, external_reference)
  where external_reference is not null;

alter table public.account_ledger_entries enable row level security;
revoke all on public.account_ledger_entries from anon, authenticated;
grant select on public.account_ledger_entries to authenticated;

drop policy if exists "Customers read own ledger; staff read all" on public.account_ledger_entries;
create policy "Customers read own ledger; staff read all"
  on public.account_ledger_entries for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_grat_staff()));

create or replace function public.get_grat_account_balance(p_customer_id uuid default null)
returns table(balance_cents bigint, entry_count bigint, last_entry_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := coalesce(p_customer_id, auth.uid());
begin
  if auth.uid() is null then
    raise exception 'Sign in to view an account balance.' using errcode = '42501';
  end if;
  if v_customer_id is distinct from auth.uid() and not public.is_grat_staff() then
    raise exception 'Staff access is required to view another account.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_customer_id) then
    raise exception 'Customer profile not found.' using errcode = 'P0002';
  end if;
  return query
    select coalesce(sum(case when e.entry_type = 'credit' then e.amount_cents else -e.amount_cents end), 0)::bigint,
      count(e.id)::bigint, max(e.created_at)
    from public.account_ledger_entries e where e.customer_id = v_customer_id;
end;
$$;
revoke all on function public.get_grat_account_balance(uuid) from public, anon, authenticated;
grant execute on function public.get_grat_account_balance(uuid) to authenticated;

create or replace function public.get_grat_account_balances()
returns table(customer_id uuid, full_name text, email text, balance_cents bigint, entry_count bigint, last_entry_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_grat_staff() then
    raise exception 'Staff access is required.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.email,
      coalesce(sum(case when e.entry_type = 'credit' then e.amount_cents else -e.amount_cents end), 0)::bigint,
      count(e.id)::bigint, max(e.created_at)
    from public.profiles p
    left join public.account_ledger_entries e on e.customer_id = p.id
    where p.role = 'customer'
    group by p.id, p.full_name, p.email
    order by p.full_name, p.email;
end;
$$;
revoke all on function public.get_grat_account_balances() from public, anon, authenticated;
grant execute on function public.get_grat_account_balances() to authenticated;

create or replace function public.record_grat_ledger_entry(
  p_customer_id uuid,
  p_entry_type text,
  p_amount_cents bigint,
  p_description text,
  p_external_reference text default null
)
returns table(id uuid, customer_id uuid, entry_type text, amount_cents bigint, description text,
  external_reference text, created_by uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
  v_entry public.account_ledger_entries%rowtype;
begin
  if auth.uid() is null or not public.is_grat_staff() then
    raise exception 'Staff access is required to post ledger entries.' using errcode = '42501';
  end if;
  if p_entry_type not in ('credit', 'debit') or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Choose a credit or debit and enter a positive amount.' using errcode = '22023';
  end if;
  if p_description is null or char_length(btrim(p_description)) not between 2 and 160 then
    raise exception 'Description must be between 2 and 160 characters.' using errcode = '22023';
  end if;
  if p_external_reference is not null and char_length(btrim(p_external_reference)) > 160 then
    raise exception 'External reference must be 160 characters or fewer.' using errcode = '22023';
  end if;

  perform 1 from public.profiles p where p.id = p_customer_id and p.role = 'customer' for update;
  if not found then
    raise exception 'Customer profile not found.' using errcode = 'P0002';
  end if;

  select coalesce(sum(case when e.entry_type = 'credit' then e.amount_cents else -e.amount_cents end), 0)::bigint
    into v_balance from public.account_ledger_entries e where e.customer_id = p_customer_id;
  if p_entry_type = 'debit' and p_amount_cents > v_balance then
    raise exception 'The debit exceeds the customer’s recorded balance.' using errcode = '22023';
  end if;

  insert into public.account_ledger_entries(customer_id, entry_type, amount_cents, description, external_reference, created_by)
  values (p_customer_id, p_entry_type, p_amount_cents, btrim(p_description), nullif(btrim(p_external_reference), ''), auth.uid())
  returning * into v_entry;

  return query select v_entry.id, v_entry.customer_id, v_entry.entry_type, v_entry.amount_cents,
    v_entry.description, v_entry.external_reference, v_entry.created_by, v_entry.created_at;
end;
$$;
revoke all on function public.record_grat_ledger_entry(uuid, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.record_grat_ledger_entry(uuid, text, bigint, text, text) to authenticated;

comment on table public.account_ledger_entries is
  'Append-only manually confirmed balance ledger. No bank connection or payment execution is performed by Grat.';
