-- ============================================================
-- Chore Rotation — run in Supabase SQL Editor
-- ============================================================

create table if not exists chores (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title        text not null,
  emoji        text,
  recurrence   text not null default 'weekly'
                 check (recurrence in ('daily', 'weekly')),
  day_of_week  int check (day_of_week between 0 and 6), -- 0=Sun … 6=Sat; null = daily
  created_at   timestamptz not null default now()
);

create table if not exists chore_logs (
  id           uuid primary key default gen_random_uuid(),
  chore_id     uuid not null references chores(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  done_by      uuid not null references auth.users(id) on delete cascade,
  done_date    date not null default current_date,
  created_at   timestamptz not null default now(),
  unique(chore_id, done_date)
);

create index if not exists idx_chores_household
  on chores(household_id);

create index if not exists idx_chore_logs_chore_date
  on chore_logs(chore_id, done_date);

alter table chores enable row level security;
alter table chore_logs enable row level security;

create policy "chores: household all"
  on chores for all
  using  (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy "chore_logs: household all"
  on chore_logs for all
  using  (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
