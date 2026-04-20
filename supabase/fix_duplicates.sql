-- ============================================================
-- Fix: deduplicate household member queries, exclude family
-- accounts from member lists/leaderboard, and add RLS policies
-- so the family account can read member data.
--
-- Safe to run multiple times.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── Fix family accounts whose profile has wrong account_type ─
-- The backfill inserted all existing users as 'individual'.
-- This corrects any family accounts that were mis-categorised.

update user_profiles p
set account_type = 'family'
from auth.users u
where p.user_id = u.id
  and u.raw_user_meta_data->>'account_type' = 'family'
  and p.account_type != 'family';

-- ── Helper: is the current user a family account? ────────────

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

-- ── RLS: cost_goals ──────────────────────────────────────────
-- Allow family account to read household members' personal/business goals.

drop policy if exists "cost_goals: family account household read" on cost_goals;
create policy "cost_goals: family account household read"
  on cost_goals for select
  using (
    user_id = auth.uid()
    or user_id is null
    or (
      is_family_account()
      and household_id in (select my_household_ids())
    )
  );

-- ── RLS: fitness_profiles ────────────────────────────────────
-- Allow family account to read household members' fitness profiles.

drop policy if exists "fitness_profiles: family account household read" on fitness_profiles;
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

-- ── RLS: transactions ────────────────────────────────────────
-- Allow family account to read household members' transactions.

drop policy if exists "transactions: family account household read" on transactions;
create policy "transactions: family account household read"
  on transactions for select
  using (
    user_id = auth.uid()
    or (
      is_family_account()
      and household_id in (select my_household_ids())
    )
  );

-- ── get_household_members ────────────────────────────────────
-- Exclude family accounts; deduplicate users in multiple households.

create or replace function get_household_members()
returns table(user_id uuid, email text, joined_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select
    uh.user_id,
    u.email,
    min(uh.created_at) as joined_at
  from user_households uh
  join auth.users u on u.id = uh.user_id
  left join user_profiles p on p.user_id = uh.user_id
  where uh.household_id in (select my_household_ids())
    and coalesce(p.account_type, 'individual') != 'family'
  group by uh.user_id, u.email
  order by min(uh.created_at);
$$;

-- ── get_household_members_with_profiles ──────────────────────
-- Used by the family account member switcher.

create or replace function get_household_members_with_profiles()
returns table(
  user_id       uuid,
  email         text,
  display_name  text,
  sidebar_color text,
  account_type  text,
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
    max(coalesce(p.display_name, ''))           as display_name,
    max(coalesce(p.sidebar_color, 'blue'))      as sidebar_color,
    max(coalesce(p.account_type, 'individual')) as account_type,
    min(uh.created_at)                          as joined_at
  from user_households uh
  join auth.users u on u.id = uh.user_id
  left join user_profiles p on p.user_id = uh.user_id
  where uh.household_id in (select my_household_ids())
    and coalesce(p.account_type, 'individual') != 'family'
  group by uh.user_id, u.email
  order by min(uh.created_at);
$$;

-- ── get_household_water_leaderboard ──────────────────────────
-- Exclude family accounts; deduplicate users.

create or replace function get_household_water_leaderboard(p_date date default current_date)
returns table(
  user_id    uuid,
  email      text,
  amount_ml  int,
  goal_ml    int,
  pct        int
)
language sql
security definer
stable
set search_path = public
as $$
  with member_goals as (
    select
      fp.user_id,
      greatest(1500,
        least(4000,
          round(
            coalesce(fp.weight_kg, 70) * 35
            * case fp.activity_level
                when 'sedentary' then 1.0
                when 'light'     then 1.1
                when 'moderate'  then 1.2
                when 'active'    then 1.4
                else                  1.2
              end / 100
          ) * 100
        )
      )::int as goal_ml
    from fitness_profiles fp
  )
  select
    uh.user_id,
    u.email,
    coalesce(max(wl.amount_ml), 0)                                              as amount_ml,
    coalesce(max(mg.goal_ml),   2500)                                           as goal_ml,
    least(100, coalesce(
      round(100.0 * max(wl.amount_ml) / nullif(coalesce(max(mg.goal_ml), 2500), 0)),
      0
    ))::int                                                                     as pct
  from user_households uh
  join auth.users u on u.id = uh.user_id
  left join user_profiles p  on p.user_id  = uh.user_id
  left join water_logs wl    on wl.user_id = uh.user_id and wl.log_date = p_date
  left join member_goals mg  on mg.user_id = uh.user_id
  where uh.household_id in (select my_household_ids())
    and coalesce(p.account_type, 'individual') != 'family'
  group by uh.user_id, u.email
  order by coalesce(max(wl.amount_ml), 0) desc;
$$;
