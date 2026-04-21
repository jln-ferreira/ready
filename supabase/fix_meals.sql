-- ============================================================
-- Fix Meals — shared meals per slot, one log per slot.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Ensure meal_type column exists on both tables
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS meal_type text NOT NULL DEFAULT 'dinner'
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner'));

ALTER TABLE meal_logs
  ADD COLUMN IF NOT EXISTS meal_type text NOT NULL DEFAULT 'dinner'
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner'));

-- 2. meal_plans: deduplicate then enforce one shared meal per slot
DELETE FROM meal_plans
WHERE id NOT IN (
  SELECT DISTINCT ON (household_id, plan_date, meal_type) id
  FROM meal_plans
  ORDER BY household_id, plan_date, meal_type, updated_at DESC NULLS LAST
);

ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_household_id_plan_date_key;
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_household_plan_date_type;
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_household_plan_date_type_user;
ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_household_plan_date_type
    UNIQUE(household_id, plan_date, meal_type);

-- 3. meal_logs: one log entry per slot per household
--    (first person to plan that slot gets the points; editing doesn't re-award)
ALTER TABLE meal_logs DROP CONSTRAINT IF EXISTS meal_logs_household_id_plan_date_key;
ALTER TABLE meal_logs DROP CONSTRAINT IF EXISTS meal_logs_household_plan_date_type;
ALTER TABLE meal_logs DROP CONSTRAINT IF EXISTS meal_logs_household_plan_date_type_user;
ALTER TABLE meal_logs
  ADD CONSTRAINT meal_logs_household_plan_date_type
    UNIQUE(household_id, plan_date, meal_type);
