-- ============================================================
-- Cost Goals: add category column
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Add category column (existing rows get 'Other' as default)
ALTER TABLE cost_goals
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';

-- 2. Drop the old unique index (didn't include category)
DROP INDEX IF EXISTS idx_cost_goals_unique;

-- 3. New unique index that includes category
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_goals_unique
  ON cost_goals (coalesce(user_id::text, ''), household_id, scope, year, month, category);
