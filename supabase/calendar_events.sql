-- ============================================================
-- Calendar Events — run in Supabase SQL Editor
-- ============================================================

create table if not exists calendar_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  start_datetime timestamptz not null,
  end_datetime   timestamptz not null,
  all_day        boolean not null default false,
  location       text,
  category       text not null default 'Personal',
  recurrence     text not null default 'none'
                   check (recurrence in ('none','daily','weekly','monthly')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_calendar_events_user_start
  on calendar_events(user_id, start_datetime);

alter table calendar_events enable row level security;

create policy "calendar_events: own rows"
  on calendar_events for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
