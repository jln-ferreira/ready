-- ============================================================
-- Cost Goals — run in Supabase SQL Editor
-- Monthly spending targets per user per scope.
-- Family scope = household-level (user_id nullable).
-- ============================================================

create table if not exists cost_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,  -- null = household-level (family)
  household_id uuid not null references households(id) on delete cascade,
  scope        text not null check (scope in ('personal', 'family', 'business')),
  year         int  not null,
  month        int  not null check (month between 1 and 12),
  amount       numeric(12,2) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One goal per (user/null, household, scope, year, month)
create unique index if not exists idx_cost_goals_unique
  on cost_goals (coalesce(user_id::text, ''), household_id, scope, year, month);

create index if not exists idx_cost_goals_household_year
  on cost_goals(household_id, scope, year);

alter table cost_goals enable row level security;

-- Personal / business: only the owner reads/writes their goals
create policy "cost_goals: own personal/business"
  on cost_goals for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Family: any household member can read/write the shared family goal
create policy "cost_goals: family household"
  on cost_goals for all
  using  (user_id is null and household_id in (select my_household_ids()))
  with check (user_id is null and household_id in (select my_household_ids()));
