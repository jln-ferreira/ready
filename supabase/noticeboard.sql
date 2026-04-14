-- ============================================================
-- Noticeboard — run in Supabase SQL Editor
-- ============================================================

create table if not exists notices (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  content      text not null,
  pinned       boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notices_household
  on notices(household_id, pinned, created_at);

alter table notices enable row level security;

create policy "notices: household all"
  on notices for all
  using  (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
