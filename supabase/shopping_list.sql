-- ============================================================
-- Shopping List — run in Supabase SQL Editor
-- ============================================================

create table if not exists shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  category     text not null default 'Other',
  checked      boolean not null default false,
  checked_by   uuid references auth.users(id),
  checked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_shopping_items_household
  on shopping_items(household_id, checked, created_at);

alter table shopping_items enable row level security;

create policy "shopping_items: household all"
  on shopping_items for all
  using  (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
