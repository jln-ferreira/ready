-- ============================================================
-- Sample data — run AFTER creating real user accounts
-- Replace the UUIDs with real values from your auth.users table
-- ============================================================

-- Step 1: Create a household
insert into households (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'The Smith Family');

-- Step 2: Link both users to the household
-- Replace these UUIDs with real user IDs from auth.users
insert into user_households (user_id, household_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),  -- spouse 1
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111');  -- spouse 2

-- Step 3: Create accounts
insert into accounts (id, household_id, name, type) values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Personal Chequing', 'personal'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Business Chequing', 'business'),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Business Savings', 'business');

-- Step 4: Sample transactions (use a real user_id)
-- Business income
insert into transactions (id, user_id, household_id, account_id, date, amount, type, description)
  select
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '2024-03-15',
    5000.00,
    'income',
    'Client invoice #001 — web development';

-- GST on the above (collected $250 = 5% of $5000)
insert into gst_entries (transaction_id, gst_amount, gst_type)
  select id, 250.00, 'collected'
  from transactions
  where description = 'Client invoice #001 — web development'
  limit 1;

-- Business expense
insert into transactions (id, user_id, household_id, account_id, date, amount, type, description)
  select
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '2024-03-20',
    800.00,
    'expense',
    'Office supplies — Staples';

-- GST on the expense (paid $40 ITC)
insert into gst_entries (transaction_id, gst_amount, gst_type)
  select id, 40.00, 'paid'
  from transactions
  where description = 'Office supplies — Staples'
  limit 1;

-- Salary income
insert into transactions (id, user_id, household_id, account_id, date, amount, type, description)
  select
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222221',
    '2024-03-31',
    4500.00,
    'income',
    'Bi-weekly payroll';

insert into income_details (transaction_id, income_type, dividend_type)
  select id, 'salary', null
  from transactions
  where description = 'Bi-weekly payroll'
  limit 1;

-- Eligible dividend
insert into transactions (id, user_id, household_id, account_id, date, amount, type, description)
  select
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222221',
    '2024-04-15',
    1200.00,
    'income',
    'Q1 eligible dividend from ABC Corp';

insert into income_details (transaction_id, income_type, dividend_type)
  select id, 'dividend', 'eligible'
  from transactions
  where description = 'Q1 eligible dividend from ABC Corp'
  limit 1;
