-- Add recurrence_end column to calendar_events
-- Stores the last date a recurring event should appear (inclusive)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_end date;
