-- ============================================================
-- Fitness Update — run in Supabase SQL Editor
-- Adds optional p_date parameter to log_water() so past dates
-- can be logged or edited.
-- ============================================================

create or replace function log_water(p_amount_ml int, p_date date default current_date)
returns int   -- returns new total for that date
language plpgsql
security definer
set search_path = public
as $$
declare
  hh_id     uuid;
  new_total int;
begin
  select household_id into hh_id
  from user_households
  where user_id = auth.uid()
  limit 1;

  insert into water_logs (user_id, household_id, log_date, amount_ml)
  values (auth.uid(), hh_id, p_date, greatest(0, p_amount_ml))
  on conflict (user_id, log_date)
  do update set
    amount_ml  = greatest(0, water_logs.amount_ml + excluded.amount_ml),
    updated_at = now()
  returning amount_ml into new_total;

  return coalesce(new_total, 0);
end;
$$;
