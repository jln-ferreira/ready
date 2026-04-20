-- Fix: drop old sleep_logs (had user_id) and recreate with kid_id
-- Also creates the kids table if it doesn't exist yet

-- Kids profiles (not auth users)
create table if not exists kids (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  name                 text not null,
  date_of_birth        date,
  daily_sleep_goal_min int  not null default 660,
  created_by           uuid references auth.users(id),
  created_at           timestamptz default now()
);

alter table kids enable row level security;

drop policy if exists "kids_household" on kids;
create policy "kids_household" on kids
  for all
  using     (household_id in (select household_id from user_households where user_id = auth.uid()))
  with check(household_id in (select household_id from user_households where user_id = auth.uid()));

-- Drop old table (had user_id column) and recreate correctly
drop table if exists sleep_logs;

create table sleep_logs (
  id           uuid primary key default gen_random_uuid(),
  kid_id       uuid not null references kids(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  sleep_type   text not null default 'sono_noturno'
               check (sleep_type in ('soneca', 'sono_noturno')),
  log_date     date not null default current_date,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);

alter table sleep_logs enable row level security;

drop policy if exists "sleep_logs_household" on sleep_logs;
create policy "sleep_logs_household" on sleep_logs
  for all
  using     (household_id in (select household_id from user_households where user_id = auth.uid()))
  with check(household_id in (select household_id from user_households where user_id = auth.uid()));
