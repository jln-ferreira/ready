-- ============================================================
-- Calendar Feed Token — run in Supabase SQL Editor
-- Adds a secret token to each household for iCal subscriptions.
-- ============================================================

alter table households
  add column if not exists calendar_token uuid unique not null default gen_random_uuid();

-- Backfill any rows that somehow got null (shouldn't happen with NOT NULL default)
update households
set calendar_token = gen_random_uuid()
where calendar_token is null;
