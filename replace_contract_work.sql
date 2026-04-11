-- ============================================================
--  CanAccounts — Replace income transactions with Contract Work
--
--  This script:
--  1. Deletes all existing income transactions categorised as
--     "Client Revenue" or "Contract Work" for your account.
--  2. Inserts 69 new weekly "Contract Work" entries from your
--     updated spreadsheet.
--
--  Replace the 3 UUIDs below before running.
--  Get them with:
--       SELECT id FROM households LIMIT 1;
--       SELECT id FROM accounts WHERE type = 'business' LIMIT 1;
--  Your user UUID → Supabase → Authentication → Users
-- ============================================================

CREATE TEMP TABLE _vars AS SELECT
  'YOUR-USER-UUID-HERE'::uuid        AS user_id,
  'YOUR-HOUSEHOLD-UUID-HERE'::uuid   AS household_id,
  'YOUR-BUSINESS-ACCOUNT-UUID'::uuid AS account_id;

-- ── Ensure Contract Work category exists ─────────────────────
INSERT INTO categories (name) VALUES ('Contract Work') ON CONFLICT (name) DO NOTHING;

-- ── Delete old income transactions (Client Revenue / Contract Work) ──
DELETE FROM transactions
WHERE account_id = (SELECT account_id FROM _vars)
  AND type = 'income'
  AND category_id IN (
    SELECT id FROM categories
    WHERE name IN ('Client Revenue', 'Contract Work')
  );

-- ============================================================
-- INSERT new weekly Contract Work income (69 entries)
-- ============================================================

-- Week ending 2024-12-05  |  $1,440.00 + $72.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2024-12-05', 1440.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2024-12-05'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 72.00, 'collected' FROM ins;

-- Week ending 2024-12-12  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2024-12-12', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2024-12-12'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2024-12-19  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2024-12-19', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2024-12-19'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2024-12-30  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2024-12-30', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2024-12-30'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-01-02  |  $320.00 + $16.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-01-02', 320.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-01-02'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 16.00, 'collected' FROM ins;

-- Week ending 2025-01-09  |  $480.00 + $24.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-01-09', 480.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-01-09'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 24.00, 'collected' FROM ins;

-- Week ending 2025-01-15  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-01-15', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-01-15'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-01-22  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-01-22', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-01-22'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-01-30  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-01-30', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-01-30'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-02-06  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-02-06', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-02-06'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-02-13  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-02-13', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-02-13'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-02-20  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-02-20', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-02-20'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-02-27  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-02-27', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-02-27'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-03-06  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-03-06', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-03-06'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-03-13  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-03-13', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-03-13'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-03-20  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-03-20', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-03-20'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-03-27  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-03-27', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-03-27'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-04-03  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-04-03', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-04-03'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-04-10  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-04-10', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-04-10'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-04-17  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-04-17', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-04-17'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-04-24  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-04-24', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-04-24'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-05-01  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-05-01', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-05-01'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-05-08  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-05-08', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-05-08'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-05-15  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-05-15', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-05-15'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-05-22  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-05-22', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-05-22'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-05-29  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-05-29', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-05-29'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-06-26  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-06-26', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-06-26'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-07-03  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-07-03', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-07-03'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-07-10  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-07-10', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-07-10'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-07-17  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-07-17', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-07-17'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-07-24  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-07-24', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-07-24'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-07-31  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-07-31', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-07-31'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-08-07  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-08-07', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-08-07'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-08-14  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-08-14', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-08-14'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-08-21  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-08-21', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-08-21'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-08-27  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-08-27', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-08-27'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-09-03  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-09-03', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-09-03'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-09-10  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-09-10', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-09-10'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-09-17  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-09-17', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-09-17'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-09-24  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-09-24', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-09-24'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-10-02  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-10-02', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-10-02'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-10-01  |  $560.00 + $28.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-10-01', 560.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-10-01'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 28.00, 'collected' FROM ins;

-- Week ending 2025-10-08  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-10-08', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-10-08'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-10-15  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-10-15', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-10-15'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-10-22  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-10-22', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-10-22'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-10-29  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-10-29', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-10-29'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-11-05  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-11-05', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-11-05'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-11-12  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-11-12', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-11-12'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-11-19  |  $2,240.00 + $112.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-11-19', 2240.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-11-19'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 112.00, 'collected' FROM ins;

-- Week ending 2025-11-26  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-11-26', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-11-26'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-12-03  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-12-03', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-12-03'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-12-10  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-12-10', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-12-10'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-12-17  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-12-17', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-12-17'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2025-12-31  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2025-12-31', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2025-12-31'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2026-01-14  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-01-14', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-01-14'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2026-01-22  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-01-22', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-01-22'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2026-01-29  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-01-29', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-01-29'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2026-02-05  |  $2,800.00 + $140.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-02-05', 2800.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-02-05'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 140.00, 'collected' FROM ins;

-- Week ending 2026-02-12  |  $2,400.00 + $120.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-02-12', 2400.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-02-12'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 120.00, 'collected' FROM ins;

-- Week ending 2026-02-19  |  $2,400.00 + $120.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-02-19', 2400.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-02-19'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 120.00, 'collected' FROM ins;

-- Week ending 2026-02-26  |  $1,920.00 + $96.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-02-26', 1920.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-02-26'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 96.00, 'collected' FROM ins;

-- Week ending 2026-03-05  |  $2,400.00 + $120.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-03-05', 2400.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-03-05'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 120.00, 'collected' FROM ins;

-- Week ending 2026-03-12  |  $2,400.00 + $120.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-03-12', 2400.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-03-12'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 120.00, 'collected' FROM ins;

-- Week ending 2026-03-19  |  $2,400.00 + $120.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-03-19', 2400.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-03-19'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 120.00, 'collected' FROM ins;

-- Week ending 2026-03-26  |  $2,400.00 + $120.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-03-26', 2400.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-03-26'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 120.00, 'collected' FROM ins;

-- Week ending 2026-03-26  |  $2,400.00 + $120.00 GST
WITH ins AS (
  INSERT INTO transactions (user_id, household_id, account_id, date, amount, type, category_id, description)
  SELECT v.user_id, v.household_id, v.account_id,
         '2026-03-26', 2400.00, 'income',
         (SELECT id FROM categories WHERE name = 'Contract Work'),
         'Contract work — week ending 2026-03-26'
  FROM _vars v RETURNING id
)
INSERT INTO gst_entries (transaction_id, gst_amount, gst_type)
  SELECT id, 120.00, 'collected' FROM ins;

DROP TABLE IF EXISTS _vars;