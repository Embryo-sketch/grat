-- Initial Grat customer profiles and manual transfer request workflow.
-- No payment execution or bank/off-ramp connection is performed here.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_grat_profile on auth.users;
create trigger on_auth_user_created_grat_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.is_grat_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('staff', 'admin')
  );
$$;

revoke all on function public.is_grat_staff() from public, anon;
grant execute on function public.is_grat_staff() to authenticated;

create table if not exists public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  from_account text not null check (char_length(from_account) between 2 and 80),
  recipient text not null check (char_length(recipient) between 2 and 100),
  bank text not null check (char_length(bank) between 2 and 100),
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  amount_cents bigint not null check (amount_cents > 0),
  memo text not null default '' check (char_length(memo) <= 120),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'needs_info', 'approved', 'sent', 'rejected')),
  staff_note text not null default '' check (char_length(staff_note) <= 240),
  payout_provider text,
  payout_reference text,
  payout_amount_cents bigint check (payout_amount_cents is null or payout_amount_cents > 0),
  payout_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_request_sent_has_payout check (
    (status = 'sent' and payout_provider is not null and payout_reference is not null
      and payout_amount_cents is not null and payout_sent_at is not null)
    or (status <> 'sent' and payout_provider is null and payout_reference is null
      and payout_amount_cents is null and payout_sent_at is null)
  )
);

create table if not exists public.transfer_request_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.transfer_requests(id) on delete cascade,
  status text not null check (status in ('submitted', 'under_review', 'needs_info', 'approved', 'sent', 'rejected')),
  actor_id uuid references public.profiles(id),
  note text not null default '' check (char_length(note) <= 240),
  created_at timestamptz not null default now()
);

create index if not exists transfer_requests_customer_created_idx
  on public.transfer_requests(customer_id, created_at desc);
create index if not exists transfer_requests_status_created_idx
  on public.transfer_requests(status, created_at desc);
create index if not exists transfer_request_history_request_idx
  on public.transfer_request_history(request_id, id);

create or replace function public.record_transfer_request_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.transfer_request_history (request_id, status, actor_id, note)
    values (new.id, new.status, new.customer_id, 'Transfer request submitted. No funds moved.');
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.transfer_request_history (request_id, status, actor_id, note)
    values (new.id, new.status, (select auth.uid()),
      case when new.status = 'sent'
        then 'Payout recorded as manually completed outside Grat.'
        else 'Request status updated.'
      end);
  end if;
  return new;
end;
$$;

drop trigger if exists record_transfer_request_history on public.transfer_requests;
create trigger record_transfer_request_history
  after insert or update of status on public.transfer_requests
  for each row execute procedure public.record_transfer_request_history();

alter table public.profiles enable row level security;
alter table public.transfer_requests enable row level security;
alter table public.transfer_request_history enable row level security;

revoke all on public.profiles, public.transfer_requests, public.transfer_request_history from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, update on public.transfer_requests to authenticated;
grant insert (customer_id, from_account, recipient, bank, account_last4, amount_cents, memo)
  on public.transfer_requests to authenticated;
grant select on public.transfer_request_history to authenticated;

drop policy if exists "Users can read own profile; staff can read profiles" on public.profiles;
create policy "Users can read own profile; staff can read profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_grat_staff()));
drop policy if exists "Users can update own name" on public.profiles;
create policy "Users can update own name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
drop policy if exists "Customers can read own transfer requests; staff can read all" on public.transfer_requests;
create policy "Customers can read own transfer requests; staff can read all"
  on public.transfer_requests for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_grat_staff()));
drop policy if exists "Customers can submit own transfer requests" on public.transfer_requests;
create policy "Customers can submit own transfer requests"
  on public.transfer_requests for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'submitted');
drop policy if exists "Staff can update transfer requests" on public.transfer_requests;
create policy "Staff can update transfer requests"
  on public.transfer_requests for update to authenticated
  using ((select public.is_grat_staff()))
  with check ((select public.is_grat_staff()));
drop policy if exists "Customers and staff can read transfer history" on public.transfer_request_history;
create policy "Customers and staff can read transfer history"
  on public.transfer_request_history for select to authenticated
  using (
    (select public.is_grat_staff())
    or exists (
      select 1 from public.transfer_requests r
      where r.id = request_id and r.customer_id = (select auth.uid())
    )
  );

comment on table public.transfer_requests is
  'Customer submitted manual transfer requests. Grat does not send or verify payments.';
