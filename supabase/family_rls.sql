-- ============================================================
-- Family Account RLS — lets the family account read all
-- household member data (transactions, goals, fitness).
-- Run in Supabase SQL Editor after profiles.sql
-- ============================================================

-- ── Helper: is the current user a family account? ─────────────

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
  );
$$;

-- ── Transactions ──────────────────────────────────────────────
-- Family account can read (but not write) all household transactions.

create policy "transactions: family account household read"
  on transactions for select
  using (
    user_id = auth.uid()
    or (
      is_family_account()
      and household_id in (select my_household_ids())
    )
  );

-- ── Cost Goals ────────────────────────────────────────────────
-- Family account can read household members' personal/business goals.

create policy "cost_goals: family account household read"
  on cost_goals for select
  using (
    user_id = auth.uid()
    or user_id is null   -- family-scoped goals (already accessible)
    or (
      is_family_account()
      and household_id in (select my_household_ids())
    )
  );

-- ── Fitness Profiles ──────────────────────────────────────────
-- Family account can read household members' fitness profiles.

create policy "fitness_profiles: family account household read"
  on fitness_profiles for select
  using (
    user_id = auth.uid()
    or (
      is_family_account()
      and user_id in (
        select uh.user_id from user_households uh
        where uh.household_id in (select my_household_ids())
      )
    )
  );
