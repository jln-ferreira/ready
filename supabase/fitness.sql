-- ============================================================
-- Fitness — run in Supabase SQL Editor
-- Profiles are private per user.
-- Water logs are written by the user, read by the household.
-- ============================================================

-- ── 1. Fitness Profiles ──────────────────────────────────────

create table if not exists fitness_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique not null references auth.users(id) on delete cascade,
  weight_kg      numeric(5,1),
  height_cm      int,
  age            int,
  sex            text check (sex in ('male', 'female', 'other')),
  activity_level text not null default 'moderate'
                   check (activity_level in ('sedentary', 'light', 'moderate', 'active')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table fitness_profiles enable row level security;

create policy "fitness_profiles: own only"
  on fitness_profiles for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 2. Water Logs ────────────────────────────────────────────

create table if not exists water_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  log_date     date not null default current_date,
  amount_ml    int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(user_id, log_date)
);

create index if not exists idx_water_logs_household_date
  on water_logs(household_id, log_date);

alter table water_logs enable row level security;

-- Write: owner only
create policy "water_logs: own insert"
  on water_logs for insert
  with check (user_id = auth.uid());

create policy "water_logs: own update"
  on water_logs for update
  using (user_id = auth.uid());

create policy "water_logs: own delete"
  on water_logs for delete
  using (user_id = auth.uid());

-- Read: whole household (for leaderboard)
create policy "water_logs: household select"
  on water_logs for select
  using (household_id in (select my_household_ids()));

-- ── 3. log_water() — add/subtract ml for today ───────────────

create or replace function log_water(p_amount_ml int)
returns int   -- returns new total
language plpgsql
security definer
set search_path = public
as $$
declare
  hh_id      uuid;
  new_total  int;
begin
  select household_id into hh_id
  from user_households
  where user_id = auth.uid()
  limit 1;

  insert into water_logs (user_id, household_id, log_date, amount_ml)
  values (auth.uid(), hh_id, current_date, greatest(0, p_amount_ml))
  on conflict (user_id, log_date)
  do update set
    amount_ml  = greatest(0, water_logs.amount_ml + excluded.amount_ml),
    updated_at = now()
  returning amount_ml into new_total;

  return coalesce(new_total, 0);
end;
$$;

-- ── 4. get_household_water_leaderboard() ─────────────────────

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
  with goals as (
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
    coalesce(wl.amount_ml, 0)        as amount_ml,
    coalesce(g.goal_ml,    2500)     as goal_ml,
    least(100,
      coalesce(
        round(100.0 * wl.amount_ml / nullif(coalesce(g.goal_ml, 2500), 0)),
        0
      )
    )::int                           as pct
  from user_households uh
  join auth.users u on u.id = uh.user_id
  left join water_logs wl  on wl.user_id  = uh.user_id  and wl.log_date = p_date
  left join goals g         on g.user_id  = uh.user_id
  where uh.household_id in (select my_household_ids())
  order by coalesce(wl.amount_ml, 0) desc;
$$;
