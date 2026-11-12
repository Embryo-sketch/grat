-- Admin-only role management for the Grat operations dashboard.
create or replace function public.admin_set_grat_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
  v_admin_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('customer', 'staff', 'admin') then
    raise exception 'Choose a valid user role.' using errcode = '22023';
  end if;

  -- Serialize admin demotions so concurrent requests cannot remove the last administrator.
  perform pg_advisory_xact_lock(hashtext('grat-admin-role-change')::bigint);

  if not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  select p.role into v_current_role
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  if p_user_id = (select auth.uid()) and p_role is distinct from v_current_role then
    raise exception 'You cannot change your own administrator role.' using errcode = '42501';
  end if;

  if v_current_role = 'admin' and p_role <> 'admin' then
    select count(*) into v_admin_count from public.profiles p where p.role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'At least one administrator must remain.' using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_grat_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_grat_user_role(uuid, text) to authenticated;
