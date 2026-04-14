-- ============================================================
-- Shared Transactions — Run in Supabase SQL Editor
-- Allows household members to READ all family transactions,
-- but only the owner can INSERT / UPDATE / DELETE their own.
-- ============================================================

-- Drop the user-only all-in-one policy set by family_system.sql
drop policy if exists "transactions: own only" on transactions;

-- Read: any household member can see all transactions in their household
create policy "transactions: household read"
  on transactions for select
  using (household_id in (select my_household_ids()));

-- Write: only the owner
create policy "transactions: own insert"
  on transactions for insert
  with check (user_id = auth.uid() and household_id in (select my_household_ids()));

create policy "transactions: own update"
  on transactions for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "transactions: own delete"
  on transactions for delete
  using (user_id = auth.uid());

-- gst_entries / income_details: allow household reads (follow parent transaction)
drop policy if exists "gst_entries: via transaction" on gst_entries;

create policy "gst_entries: household read"
  on gst_entries for select
  using (
    transaction_id in (
      select id from transactions
      where household_id in (select my_household_ids())
    )
  );

create policy "gst_entries: own write"
  on gst_entries for insert
  with check (
    transaction_id in (
      select id from transactions where user_id = auth.uid()
    )
  );

create policy "gst_entries: own update"
  on gst_entries for update
  using (
    transaction_id in (
      select id from transactions where user_id = auth.uid()
    )
  );

create policy "gst_entries: own delete"
  on gst_entries for delete
  using (
    transaction_id in (
      select id from transactions where user_id = auth.uid()
    )
  );

drop policy if exists "income_details: via transaction" on income_details;

create policy "income_details: household read"
  on income_details for select
  using (
    transaction_id in (
      select id from transactions
      where household_id in (select my_household_ids())
    )
  );

create policy "income_details: own write"
  on income_details for insert
  with check (
    transaction_id in (
      select id from transactions where user_id = auth.uid()
    )
  );

create policy "income_details: own update"
  on income_details for update
  using (
    transaction_id in (
      select id from transactions where user_id = auth.uid()
    )
  );

create policy "income_details: own delete"
  on income_details for delete
  using (
    transaction_id in (
      select id from transactions where user_id = auth.uid()
    )
  );
