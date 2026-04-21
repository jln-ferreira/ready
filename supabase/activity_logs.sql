-- ============================================================
-- Activity Logs — persistent points history for Shopping and Meals.
-- These tables survive item deletion so the leaderboard is never lost.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Shopping actions log (+3 pts for adding, +5 pts for checking off)
CREATE TABLE IF NOT EXISTS shopping_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action       text        NOT NULL CHECK (action IN ('added', 'checked')),
  points       int         NOT NULL,
  log_date     date        NOT NULL DEFAULT current_date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_logs_household_date
  ON shopping_logs(household_id, log_date);

ALTER TABLE shopping_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_logs: household all" ON shopping_logs;
CREATE POLICY "shopping_logs: household all"
  ON shopping_logs FOR ALL
  USING  (household_id IN (SELECT my_household_ids()))
  WITH CHECK (household_id IN (SELECT my_household_ids()));

-- Meal planning log (+8 pts per meal slot planned)
-- One entry per household + plan_date + meal_type; never deleted (history preserved).
CREATE TABLE IF NOT EXISTS meal_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points       int         NOT NULL,
  plan_date    date        NOT NULL,
  meal_type    text        NOT NULL DEFAULT 'dinner'
                             CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, plan_date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_household_date
  ON meal_logs(household_id, plan_date);

-- Add meal_type if table was created before this column existed
ALTER TABLE meal_logs
  ADD COLUMN IF NOT EXISTS meal_type text NOT NULL DEFAULT 'dinner'
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner'));

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_logs: household all" ON meal_logs;
CREATE POLICY "meal_logs: household all"
  ON meal_logs FOR ALL
  USING  (household_id IN (SELECT my_household_ids()))
  WITH CHECK (household_id IN (SELECT my_household_ids()));
