-- Fix: pgcrypto lives in the 'extensions' schema in Supabase.
-- Add it to the search path of both PIN functions.

create or replace function set_member_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update user_profiles
     set pin_hash = crypt(p_pin, gen_salt('bf'))
   where user_id = p_user_id;
end;
$$;

create or replace function verify_member_pin(p_user_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  if not exists (
    select 1 from user_households uh
    where uh.user_id = p_user_id
      and uh.household_id in (select my_household_ids())
  ) then
    return false;
  end if;

  select pin_hash into stored_hash
    from user_profiles
   where user_id = p_user_id;

  if stored_hash is null then
    return false;
  end if;

  return crypt(p_pin, stored_hash) = stored_hash;
end;
$$;
