-- ============================================================
-- Seed temporary PIN 1234 for all existing individual members.
-- Run in Supabase SQL Editor AFTER member_pin.sql.
-- ============================================================

-- Set PIN 1234 for every individual member account.
-- (Direct UPDATE bypasses auth — safe from the SQL editor / service role.)
update user_profiles
   set pin_hash = crypt('1234', gen_salt('bf'))
 where account_type = 'individual';

-- ── Update set_member_pin with client-side authorization ──────
-- The original version in member_pin.sql had no auth check.
-- This version allows: setting your own PIN, or being a household
-- co-member (so the family admin can reset a member's PIN from
-- the profile page).

create or replace function set_member_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow only: the user themselves, or a household co-member (family admin)
  if p_user_id != auth.uid() and not exists (
    select 1 from user_households uh
    where uh.user_id = p_user_id
      and uh.household_id in (select my_household_ids())
  ) then
    raise exception 'Unauthorized: cannot set PIN for this user';
  end if;

  update user_profiles
     set pin_hash = crypt(p_pin, gen_salt('bf'))
   where user_id = p_user_id;
end;
$$;

-- ── (Optional) clear a specific member's PIN ─────────────────
-- update user_profiles set pin_hash = null where user_id = '<uuid>';
