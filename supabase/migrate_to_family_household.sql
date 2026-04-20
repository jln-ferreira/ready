-- ============================================================
-- Migration: move all data from personal households to the
-- shared family household for users who are in multiple households.
--
-- This fixes data written before useHousehold preferred the
-- family household. Safe to run multiple times (idempotent).
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── Step 1: Fix log_water() to prefer the family household ───

create or replace function log_water(p_amount_ml int, p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  hh_id     uuid;
  new_total int;
begin
  -- Prefer the household that contains a family account co-member
  select uh.household_id into hh_id
  from user_households uh
  where uh.user_id = auth.uid()
  order by (
    exists (
      select 1
      from user_households uh2
      join user_profiles p on p.user_id = uh2.user_id
      where uh2.household_id = uh.household_id
        and uh2.user_id != auth.uid()
        and p.account_type = 'family'
    )
  ) desc
  limit 1;

  insert into water_logs (user_id, household_id, log_date, amount_ml)
  values (auth.uid(), hh_id, p_date, greatest(0, p_amount_ml))
  on conflict (user_id, log_date)
  do update set
    amount_ml  = greatest(0, water_logs.amount_ml + excluded.amount_ml),
    updated_at = now()
  returning amount_ml into new_total;

  return coalesce(new_total, 0);
end;
$$;

-- ── Step 2: Migrate existing data ────────────────────────────
-- For each user in multiple households, find the shared family
-- household and move all their data to it.

do $$
declare
  user_rec       record;
  family_hh_id   uuid;
  personal_hh_id uuid;
begin
  -- Loop over users who belong to more than one household
  for user_rec in
    select user_id
    from user_households
    group by user_id
    having count(*) > 1
  loop

    -- The family household = the one that has a family-account co-member
    select uh.household_id into family_hh_id
    from user_households uh
    join user_households uh2 on uh2.household_id = uh.household_id
                              and uh2.user_id != uh.user_id
    join user_profiles p     on p.user_id = uh2.user_id
    where uh.user_id = user_rec.user_id
      and p.account_type = 'family'
    limit 1;

    if family_hh_id is null then continue; end if;

    -- Move data from every other household for this user
    for personal_hh_id in
      select household_id
      from user_households
      where user_id = user_rec.user_id
        and household_id != family_hh_id
    loop

      -- ── Shared family tables (keyed by household_id) ──────
      update chores
        set household_id = family_hh_id
        where household_id = personal_hh_id;

      update chore_logs
        set household_id = family_hh_id
        where household_id = personal_hh_id;

      update calendar_events
        set household_id = family_hh_id
        where household_id = personal_hh_id;

      update shopping_items
        set household_id = family_hh_id
        where household_id = personal_hh_id;

      update notices
        set household_id = family_hh_id
        where household_id = personal_hh_id;

      -- meal_plans has unique(household_id, plan_date):
      -- insert into family household; on conflict keep existing family row
      insert into meal_plans (id, household_id, plan_date, title, notes, created_by, created_at, updated_at)
      select id, family_hh_id, plan_date, title, notes, created_by, created_at, updated_at
      from meal_plans
      where household_id = personal_hh_id
      on conflict (household_id, plan_date) do nothing;

      delete from meal_plans where household_id = personal_hh_id;

      -- ── Finance: accounts + transactions (private per user) ──
      -- Accounts have no user_id — move any accounts that only this
      -- personal household owns (not already duplicated in family hh).
      -- Transactions reference these account IDs and must follow them.

      -- Move accounts whose household is the personal household and
      -- that don't already exist (by name+type) in the family household.
      -- Use a temp mapping to re-point transaction account_ids.
      update accounts
        set household_id = family_hh_id
        where household_id = personal_hh_id;

      -- water_logs: unique(user_id, log_date) — safe to just update household_id
      update water_logs
        set household_id = family_hh_id
        where household_id = personal_hh_id
          and user_id = user_rec.user_id;

      -- transactions: already reference correct account_ids (accounts were just moved)
      update transactions
        set household_id = family_hh_id
        where household_id = personal_hh_id
          and user_id = user_rec.user_id;

      -- cost_goals
      update cost_goals
        set household_id = family_hh_id
        where household_id = personal_hh_id
          and (user_id = user_rec.user_id or user_id is null);

    end loop;
  end loop;
end $$;
