-- ============================================================
-- Context Fix: allow family account to act on behalf of members
--
-- Run in Supabase SQL Editor AFTER fix_duplicates.sql.
-- Safe to run multiple times.
-- ============================================================

-- ── 1. Update is_family_account() with email fallback ────────
-- Covers the case where user_profiles.account_type wasn't
-- backfilled (family accounts created before the backfill).

create or replace function is_family_account()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select account_type = 'family'
     from user_profiles
     where user_id = auth.uid()),
    false
  )
  -- Email pattern fallback: family.xxx@ready.app
  or (auth.jwt()->>'email' like 'family.%@ready.app');
$$;

-- ── 2. Transactions: allow family account to write for members ─

drop policy if exists "transactions: own only"                  on transactions;
drop policy if exists "transactions: family account household read" on transactions;

-- One unified policy for all operations
create policy "transactions: own or family managed"
  on transactions for all
  using (
    user_id = auth.uid()
    or (
      is_family_account()
      and household_id in (select my_household_ids())
    )
  )
  with check (
    user_id = auth.uid()
    or (
      is_family_account()
      and user_id in (
        select uh.user_id from user_households uh
        where uh.household_id in (select my_household_ids())
      )
      and household_id in (select my_household_ids())
    )
  );

-- ── 3. Cost goals: allow family account to write for members ──

drop policy if exists "cost_goals: own personal/business"          on cost_goals;
drop policy if exists "cost_goals: family household"               on cost_goals;
drop policy if exists "cost_goals: family account household read"  on cost_goals;

-- Personal / business goals: own OR family account acting for member
create policy "cost_goals: personal business"
  on cost_goals for all
  using (
    user_id = auth.uid()
    or (
      is_family_account()
      and user_id is not null
      and household_id in (select my_household_ids())
    )
  )
  with check (
    user_id = auth.uid()
    or (
      is_family_account()
      and user_id in (
        select uh.user_id from user_households uh
        where uh.household_id in (select my_household_ids())
      )
      and household_id in (select my_household_ids())
    )
  );

-- Family scope goals (user_id IS NULL): any household member
create policy "cost_goals: family scope"
  on cost_goals for all
  using  (user_id is null and household_id in (select my_household_ids()))
  with check (user_id is null and household_id in (select my_household_ids()));
