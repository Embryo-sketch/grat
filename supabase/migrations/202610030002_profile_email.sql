alter table public.profiles add column if not exists email text not null default '';

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id and p.email = '';

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_grat_profile on auth.users;
create trigger on_auth_user_created_grat_profile
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.create_profile_for_new_user();
