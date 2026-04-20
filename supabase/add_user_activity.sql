-- Tracks one row per user per day — opening the app counts as activity
create table if not exists user_activity (
  user_id       uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  primary key (user_id, activity_date)
);

alter table user_activity enable row level security;

-- Users can only read/write their own rows
create policy "Users manage own activity"
  on user_activity for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Household members can read each other's activity dates (for streak comparison)
create policy "Household members can read activity"
  on user_activity for select
  using (
    exists (
      select 1 from user_households uh1
      join user_households uh2 on uh1.household_id = uh2.household_id
      where uh1.user_id = auth.uid()
        and uh2.user_id = user_activity.user_id
    )
  );
