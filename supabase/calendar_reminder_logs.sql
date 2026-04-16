-- ============================================================
-- Tracks which reminders have already been sent so we never
-- send the same one twice even if the cron fires multiple times.
-- Run in Supabase SQL Editor.
-- ============================================================

create table if not exists calendar_reminder_logs (
  event_id      uuid not null references calendar_events(id) on delete cascade,
  reminder_type text not null,
  sent_at       timestamptz not null default now(),
  primary key (event_id, reminder_type)
);
