-- ============================================================
-- Meal Types — adds Breakfast / Lunch / Dinner slots per day.
-- Run AFTER activity_logs.sql in Supabase SQL Editor.
-- ============================================================

-- Add meal_type to meal_plans (existing rows default to 'dinner')
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS meal_type text NOT NULL DEFAULT 'dinner'
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner'));

-- Drop the old one-meal-per-day unique constraint
ALTER TABLE meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_household_id_plan_date_key;

-- New constraint: one entry per household + day + meal type
ALTER TABLE meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_household_plan_date_type;
ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_household_plan_date_type
    UNIQUE(household_id, plan_date, meal_type);
