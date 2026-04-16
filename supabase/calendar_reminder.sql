-- ============================================================
-- Add reminder field to calendar_events
-- Run in Supabase SQL Editor.
-- ============================================================

alter table calendar_events
  add column if not exists reminder text not null default 'none'
    check (reminder in ('none', 'at_time', '1_day_before', '2_days_before'));
