-- ============================================================
-- CanAccounts — Supabase Schema + RLS Policies
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New Query)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Households (one per family unit)
create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Links auth users to households (many-to-many for future multi-user support)
create table if not exists user_households (
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, household_id)
);

-- Accounts (personal or business) belonging to a household
create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('personal', 'business')),
  created_at   timestamptz not null default now()
);

-- Transaction categories (shared, not household-specific)
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- Core transactions
create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  date         date not null,
  amount       numeric(12,2) not null check (amount >= 0),
  type         text not null check (type in ('income', 'expense')),
  category_id  uuid references categories(id) on delete set null,
  description  text,
  created_at   timestamptz not null default now()
);

-- GST entries linked 1:1 with a transaction
create table if not exists gst_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  gst_amount     numeric(10,2) not null check (gst_amount >= 0),
  gst_type       text not null check (gst_type in ('collected', 'paid')),
  created_at     timestamptz not null default now(),
  unique (transaction_id)
);

-- Income classification linked 1:1 with an income transaction
create table if not exists income_details (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  income_type    text not null check (income_type in ('salary', 'dividend')),
  dividend_type  text check (dividend_type in ('eligible', 'non_eligible')),
  created_at     timestamptz not null default now(),
  unique (transaction_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_transactions_household_date
  on transactions(household_id, date desc);

create index if not exists idx_transactions_user
  on transactions(user_id);

create index if not exists idx_accounts_household
  on accounts(household_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table households      enable row level security;
alter table user_households enable row level security;
alter table accounts        enable row level security;
alter table categories      enable row level security;
alter table transactions    enable row level security;
alter table gst_entries     enable row level security;
alter table income_details  enable row level security;

-- Helper function: returns the household_ids the current user belongs to
create or replace function my_household_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select household_id from user_households where user_id = auth.uid();
$$;

-- households: user can see/modify their own households
create policy "households: member access"
  on households for all
  using (id in (select my_household_ids()))
  with check (id in (select my_household_ids()));

-- user_households: user can see their own rows
create policy "user_households: own rows"
  on user_households for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- accounts: accessible to household members
create policy "accounts: household member access"
  on accounts for all
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- categories: readable by all authenticated users (shared lookup)
create policy "categories: authenticated read"
  on categories for select
  using (auth.role() = 'authenticated');

create policy "categories: authenticated insert"
  on categories for insert
  with check (auth.role() = 'authenticated');

-- transactions: accessible by user or by household membership
create policy "transactions: own or household"
  on transactions for all
  using (
    user_id = auth.uid()
    or household_id in (select my_household_ids())
  )
  with check (
    user_id = auth.uid()
    and household_id in (select my_household_ids())
  );

-- gst_entries: accessible if the parent transaction is accessible
create policy "gst_entries: via transaction"
  on gst_entries for all
  using (
    transaction_id in (
      select id from transactions
      where user_id = auth.uid()
         or household_id in (select my_household_ids())
    )
  )
  with check (
    transaction_id in (
      select id from transactions
      where user_id = auth.uid()
        and household_id in (select my_household_ids())
    )
  );

-- income_details: accessible if the parent transaction is accessible
create policy "income_details: via transaction"
  on income_details for all
  using (
    transaction_id in (
      select id from transactions
      where user_id = auth.uid()
         or household_id in (select my_household_ids())
    )
  )
  with check (
    transaction_id in (
      select id from transactions
      where user_id = auth.uid()
        and household_id in (select my_household_ids())
    )
  );

-- ============================================================
-- SEED: Default categories
-- ============================================================

insert into categories (name) values
  ('Advertising & Marketing'),
  ('Bank Fees'),
  ('Business Meals'),
  ('Client Revenue'),
  ('Contract Work'),
  ('Dividends Received'),
  ('Equipment'),
  ('Home Office'),
  ('Insurance'),
  ('Internet & Phone'),
  ('Investment Income'),
  ('Legal & Professional'),
  ('Office Supplies'),
  ('Payroll / Salary'),
  ('Rent'),
  ('Software & Subscriptions'),
  ('Travel'),
  ('Utilities'),
  ('Vehicle / Mileage'),
  ('Other Income'),
  ('Other Expense')
on conflict (name) do nothing;
