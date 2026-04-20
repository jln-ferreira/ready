-- Add points value to each chore (creator can override)
ALTER TABLE chores ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 10;

-- Snapshot points at close time so retroactive edits don't change history
ALTER TABLE chore_logs ADD COLUMN IF NOT EXISTS points_earned integer;

-- Backfill existing logs with their chore's default points
UPDATE chore_logs cl
SET points_earned = c.points
FROM chores c
WHERE cl.chore_id = c.id
  AND cl.points_earned IS NULL;
