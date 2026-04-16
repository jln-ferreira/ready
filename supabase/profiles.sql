-- ============================================================
-- User Profiles — display name, sidebar colour, account type
-- Run in Supabase SQL Editor after schema.sql + family_system.sql
-- ============================================================

create table if not exists user_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  sidebar_color text not null default 'blue',
  account_type  text not null default 'individual'
                check (account_type in ('individual', 'family')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table user_profiles enable row level security;

-- Own profile: full access
create policy "user_profiles: own access"
  on user_profiles for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Household members can read each other's profiles (for member switcher)
create policy "user_profiles: household read"
  on user_profiles for select
  using (
    user_id in (
      select uh.user_id from user_households uh
      where uh.household_id in (select my_household_ids())
    )
  );

-- ── get_household_members_with_profiles() ─────────────────────
-- Returns household members with their profile data for the member switcher

create or replace function get_household_members_with_profiles()
returns table(
  user_id       uuid,
  email         text,
  display_name  text,
  sidebar_color text,
  account_type  text,
  joined_at     timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    uh.user_id,
    u.email,
    coalesce(p.display_name, '')        as display_name,
    coalesce(p.sidebar_color, 'blue')   as sidebar_color,
    coalesce(p.account_type, 'individual') as account_type,
    uh.created_at                       as joined_at
  from user_households uh
  join auth.users u on u.id = uh.user_id
  left join user_profiles p on p.user_id = uh.user_id
  where uh.household_id in (select my_household_ids())
  order by uh.created_at;
$$;

-- ── Update handle_new_user to also create a profile row ───────
-- Replaces the version in family_system.sql

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hh_id        uuid;
  invite_code  text;
  acct_type    text;
begin
  invite_code := upper(trim(new.raw_user_meta_data->>'invite_code'));
  acct_type   := coalesce(nullif(trim(new.raw_user_meta_data->>'account_type'), ''), 'individual');

  -- Always create a profile row for every new user
  insert into public.user_profiles (user_id, account_type)
  values (new.id, acct_type)
  on conflict (user_id) do nothing;

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
  -- For family accounts, use the family_login_name as the household name
  insert into public.households (name)
  values (
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'household_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'family_login_name'), ''),
      'My Household'
    )
  )
  returning id into hh_id;

  insert into public.user_households (user_id, household_id)
  values (new.id, hh_id);

  return new;
end;
$$;

-- Backfill profiles for existing users (safe to run multiple times)
insert into user_profiles (user_id, account_type)
select id, 'individual'
from auth.users
on conflict (user_id) do nothing;
