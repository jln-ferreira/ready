-- ============================================================
-- Clear dev/test data for Chores, Shopping, and Meals.
-- Safe to run repeatedly. Does NOT drop tables or schema.
-- ============================================================

-- Chores
DELETE FROM chore_logs;
DELETE FROM chores;

-- Shopping
DELETE FROM shopping_logs;
DELETE FROM shopping_items;

-- Meals
DELETE FROM meal_logs;
DELETE FROM meal_plans;
