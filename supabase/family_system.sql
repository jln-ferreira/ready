-- ============================================================
-- Family System Migration
-- Run in Supabase SQL Editor after schema.sql
-- ============================================================

-- ── 1. Calendar events → household-scoped ──────────────────

alter table calendar_events
  add column if not exists household_id uuid references households(id) on delete cascade;

-- Backfill existing events with the creator's household
update calendar_events ce
set household_id = uh.household_id
from user_households uh
where uh.user_id = ce.user_id
  and ce.household_id is null;

-- Now enforce not-null
alter table calendar_events
  alter column household_id set not null;

-- Replace user-only RLS with household-level RLS
drop policy if exists "calendar_events: own rows" on calendar_events;

create policy "calendar_events: household read"
  on calendar_events for select
  using (household_id in (select my_household_ids()));

create policy "calendar_events: household write"
  on calendar_events for insert
  with check (
    household_id in (select my_household_ids())
    and user_id = auth.uid()
  );

create policy "calendar_events: household update"
  on calendar_events for update
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy "calendar_events: household delete"
  on calendar_events for delete
  using (household_id in (select my_household_ids()));

create index if not exists idx_calendar_events_household_start
  on calendar_events(household_id, start_datetime);

-- ── 2. Finance → private per user ──────────────────────────

drop policy if exists "transactions: own or household" on transactions;

create policy "transactions: own only"
  on transactions for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 3. Household invites ────────────────────────────────────

create table if not exists household_invites (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null default upper(substr(md5(random()::text), 1, 6)),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  expires_at   timestamptz not null default now() + interval '7 days',
  used_at      timestamptz,
  used_by      uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

alter table household_invites enable row level security;

-- Household members can see and create invites for their household
create policy "household_invites: member select"
  on household_invites for select
  using (household_id in (select my_household_ids()));

create policy "household_invites: member insert"
  on household_invites for insert
  with check (
    household_id in (select my_household_ids())
    and created_by = auth.uid()
  );

create policy "household_invites: member delete"
  on household_invites for delete
  using (
    household_id in (select my_household_ids())
    and created_by = auth.uid()
  );

-- ── 4. Expose household members (emails) ───────────────────

create or replace function get_household_members()
returns table(user_id uuid, email text, joined_at timestamptz)
language sql
security definer
stable
as $$
  select uh.user_id, u.email, uh.created_at
  from user_households uh
  join auth.users u on u.id = uh.user_id
  where uh.household_id in (select my_household_ids())
  order by uh.created_at;
$$;

-- ── 5. Auto-setup trigger on signup ────────────────────────
-- Creates a household for the first user, or joins an existing one via invite code

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hh_id       uuid;
  invite_code text;
begin
  invite_code := upper(trim(new.raw_user_meta_data->>'invite_code'));

  if invite_code is not null and invite_code != '' then
    -- Try to join via invite
    select household_id into hh_id
    from public.household_invites
    where code = invite_code
      and used_at is null
      and expires_at > now()
    limit 1;

    if hh_id is not null then
      update public.household_invites
        set used_at = now(), used_by = new.id
      where code = invite_code;

      insert into public.user_households (user_id, household_id)
      values (new.id, hh_id)
      on conflict (user_id, household_id) do nothing;

      return new;
    end if;
  end if;

  -- No valid invite → create a new household
  insert into public.households (name)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'household_name'), ''), 'My Household'))
  returning id into hh_id;

  insert into public.user_households (user_id, household_id)
  values (new.id, hh_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
