-- ============================================================
-- my_preferred_household_id()
-- Returns the household_id the current user should use.
-- Prefers the household that has a family account co-member
-- (i.e. the shared family household over a personal one).
-- Uses SECURITY DEFINER to bypass the user_households RLS which
-- only lets each user see their own rows.
--
-- Run in Supabase SQL Editor.
-- ============================================================

create or replace function my_preferred_household_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select uh.household_id
  from user_households uh
  where uh.user_id = auth.uid()
  order by (
    exists (
      select 1
      from user_households uh2
      join user_profiles p on p.user_id = uh2.user_id
      where uh2.household_id = uh.household_id
        and uh2.user_id      != auth.uid()
        and p.account_type   = 'family'
    )
  ) desc
  limit 1;
$$;
