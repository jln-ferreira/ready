-- ============================================================
-- Member PIN — 4-digit PIN for switching to a member account
-- Run in Supabase SQL Editor after profiles.sql
-- Requires the pgcrypto extension: CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ============================================================

-- Enable pgcrypto (safe to run if already enabled)
create extension if not exists pgcrypto;

-- Add pin_hash column to user_profiles
alter table user_profiles
  add column if not exists pin_hash text;

-- ── set_member_pin(p_user_id, p_pin) ─────────────────────────
-- Stores a bcrypt hash of the 4-digit PIN for a member.
-- Called from the server-side member signup route (service role).

create or replace function set_member_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update user_profiles
     set pin_hash = crypt(p_pin, gen_salt('bf'))
   where user_id = p_user_id;
end;
$$;

-- ── verify_member_pin(p_user_id, p_pin) ──────────────────────
-- Returns true if the plain PIN matches the stored hash.
-- Called from the family account client (RLS user = family account,
-- which shares a household with the member).

create or replace function verify_member_pin(p_user_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  stored_hash text;
begin
  -- Ensure caller is in the same household as the target member
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

-- ── Update get_household_members_with_profiles() ──────────────
-- Adds has_pin boolean so the sidebar knows whether to show the modal.
-- Must drop first because the return type changed.

drop function if exists get_household_members_with_profiles();

create or replace function get_household_members_with_profiles()
returns table(
  user_id       uuid,
  email         text,
  display_name  text,
  sidebar_color text,
  account_type  text,
  has_pin       boolean,
  joined_at     timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    uh.user_id,
    u.email,
    coalesce(p.display_name, '')           as display_name,
    coalesce(p.sidebar_color, 'blue')      as sidebar_color,
    coalesce(p.account_type, 'individual') as account_type,
    (p.pin_hash is not null)               as has_pin,
    uh.created_at                          as joined_at
  from user_households uh
  join auth.users u on u.id = uh.user_id
  left join user_profiles p on p.user_id = uh.user_id
  where uh.household_id in (select my_household_ids())
  order by uh.created_at;
$$;
