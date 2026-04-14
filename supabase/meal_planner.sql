-- ============================================================
-- Meal Planner — run in Supabase SQL Editor
-- One meal entry per household per day.
-- ============================================================

create table if not exists meal_plans (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  plan_date    date not null,
  title        text not null,
  notes        text,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(household_id, plan_date)
);

create index if not exists idx_meal_plans_household_date
  on meal_plans(household_id, plan_date);

alter table meal_plans enable row level security;

create policy "meal_plans: household all"
  on meal_plans for all
  using  (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
