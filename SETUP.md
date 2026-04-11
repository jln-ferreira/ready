# CanAccounts — Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a strong database password and save it
3. Copy your **Project URL** and **anon/public key** from Project Settings → API

## 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 3. Run the Database Schema

In the Supabase dashboard → **SQL Editor** → New Query:

1. Paste the contents of `supabase/schema.sql` and run it
2. This creates all tables, indexes, and RLS policies
3. Default categories are seeded automatically

## 4. Create User Accounts

In Supabase → Authentication → Users → Invite User (or use the signup page):
- Create accounts for both spouses using the `/auth/signup` page

## 5. Link Users to a Household

After both users sign up, run the following in the SQL Editor (replacing the UUIDs
with real ones from Authentication → Users):

```sql
-- Create household
insert into households (id, name) values
  (gen_random_uuid(), 'The Smith Family');

-- Get the household ID from the above, then:
insert into user_households (user_id, household_id) values
  ('user-uuid-spouse-1', 'household-uuid'),
  ('user-uuid-spouse-2', 'household-uuid');

-- Create accounts
insert into accounts (household_id, name, type) values
  ('household-uuid', 'Personal Chequing', 'personal'),
  ('household-uuid', 'Business Chequing', 'business'),
  ('household-uuid', 'Business Savings', 'business');
```

See `supabase/seed.sql` for a complete example with sample data.

## 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/auth/login`.

---

## App Structure

| Route | Description |
|-------|-------------|
| `/dashboard` | Monthly income, expenses, GST totals, recent transactions |
| `/transactions` | Add/view/delete all transactions (with GST + income type) |
| `/reports` | Annual overview, expense breakdown by category |
| `/tax` | **CRA-ready tax report** — copy values, download ZIP package |

## Tax Report Features

The `/tax` page computes and displays:

- **T2125** — Business income, expenses, net income
- **GST34** — Collected, paid (ITC), net payable
- **T4** — Salary/employment income
- **T5** — Eligible and non-eligible dividends

Each value has a **Copy** button. Each section has a **Copy All** button.

The **Download Tax Package** button generates a ZIP containing:
- `transactions.csv` — Full transaction ledger
- `gst_summary.csv` — GST34 line items
- `income_summary.csv` — All income categories
- `tax_summary.json` — Structured JSON for import
- `tax_summary.pdf` — Formatted PDF report

## Security Notes

- All routes except `/auth/*` are protected by middleware
- Supabase RLS policies ensure users only see their household's data
- Both spouses share one household and can view each other's transactions
- Passwords are managed by Supabase Auth (bcrypt, never stored in plain text)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| Language | TypeScript |
| Icons | Lucide React |
| PDF | jsPDF |
| ZIP | JSZip |
| File save | file-saver |
