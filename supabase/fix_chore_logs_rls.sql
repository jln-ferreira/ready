-- Policy 1: users can always read their own logs regardless of household_id.
-- Needed when logs were saved under a personal household before the family
-- household migration ran.
create policy "chore_logs: own logs read"
  on chore_logs for select
  using (done_by = auth.uid());

-- Policy 2: family accounts can read chore logs for any member in their household.
-- Needed so the family account session can view a member's achievements/badges.
create policy "chore_logs: family account member read"
  on chore_logs for select
  using (
    is_family_account()
    and done_by in (
      select uh.user_id
      from user_households uh
      where uh.household_id in (select my_household_ids())
    )
  );
