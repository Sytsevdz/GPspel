-- GP Web App (Het betere GP spel)
-- Supabase/PostgreSQL schema + example seed data

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- -------------------------
-- Enums
-- -------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'grand_prix_status') then
    create type grand_prix_status as enum ('upcoming', 'open', 'locked', 'finished');
  end if;
end$$;

-- -------------------------
-- Tables
-- -------------------------

-- 1) profiles
-- Linked 1:1 with Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_display_name text;
  fallback_display_name text;
begin
  requested_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  fallback_display_name := nullif(trim(split_part(new.email, '@', 1)), '');

  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(requested_display_name, fallback_display_name, 'Player')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- 2) leagues
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  join_code text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) league_members
-- A user belongs to a league. Role is optional.
create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- 4) grand_prix
create table if not exists public.grand_prix (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  qualification_start timestamptz not null,
  deadline timestamptz not null,
  is_sprint_weekend boolean not null default false,
  status grand_prix_status not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deadline >= qualification_start)
);

-- 5) drivers
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  constructor_team text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6) driver_prices
-- price stored as integer in "millions * 10" (e.g. 87 = 8.7M)
create table if not exists public.driver_prices (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  grand_prix_id uuid not null references public.grand_prix(id) on delete cascade,
  price integer not null check (price > 0),
  created_at timestamptz not null default now(),
  unique (driver_id, grand_prix_id)
);

-- 7) team_selections
-- One team selection per user per grand prix.
create table if not exists public.team_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grand_prix_id uuid not null references public.grand_prix(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, grand_prix_id)
);

-- 8) team_selection_drivers
-- Links selected drivers to a team selection.
-- "Exactly 4 drivers" is enforced in application logic.
create table if not exists public.team_selection_drivers (
  id uuid primary key default gen_random_uuid(),
  team_selection_id uuid not null references public.team_selections(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (team_selection_id, driver_id)
);

-- 9) predictions
-- One prediction per user per grand prix.
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grand_prix_id uuid not null references public.grand_prix(id) on delete cascade,
  quali_p1 uuid not null references public.drivers(id) on delete restrict,
  quali_p2 uuid not null references public.drivers(id) on delete restrict,
  quali_p3 uuid not null references public.drivers(id) on delete restrict,
  race_p1 uuid not null references public.drivers(id) on delete restrict,
  race_p2 uuid not null references public.drivers(id) on delete restrict,
  race_p3 uuid not null references public.drivers(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, grand_prix_id),
  check (quali_p1 <> quali_p2 and quali_p1 <> quali_p3 and quali_p2 <> quali_p3),
  check (race_p1 <> race_p2 and race_p1 <> race_p3 and race_p2 <> race_p3)
);

-- Helpful indexes
create index if not exists idx_league_members_user_id on public.league_members(user_id);
create index if not exists idx_team_selections_gp on public.team_selections(grand_prix_id);
create index if not exists idx_predictions_gp on public.predictions(grand_prix_id);

-- -------------------------
-- Row Level Security (release 1)
-- -------------------------

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.team_selections enable row level security;
alter table public.team_selection_drivers enable row level security;
alter table public.predictions enable row level security;

-- release 1 note: grand_prix, drivers, and driver_prices are treated as public read-only tables,
-- so RLS is intentionally not enabled on those tables yet.

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "leagues_select_member" on public.leagues;
create policy "leagues_select_member"
on public.leagues
for select
using (
  exists (
    select 1
    from public.league_members lm
    where lm.league_id = leagues.id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists "league_members_select_member" on public.league_members;
create policy "league_members_select_member"
on public.league_members
for select
using (
  exists (
    select 1
    from public.league_members lm
    where lm.league_id = league_members.league_id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists "team_selections_select_own" on public.team_selections;
create policy "team_selections_select_own"
on public.team_selections
for select
using (auth.uid() = user_id);

drop policy if exists "team_selections_insert_own" on public.team_selections;
create policy "team_selections_insert_own"
on public.team_selections
for insert
with check (auth.uid() = user_id);

drop policy if exists "team_selections_update_own" on public.team_selections;
create policy "team_selections_update_own"
on public.team_selections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "team_selection_drivers_select_own_team_selection" on public.team_selection_drivers;
create policy "team_selection_drivers_select_own_team_selection"
on public.team_selection_drivers
for select
using (
  exists (
    select 1
    from public.team_selections ts
    where ts.id = team_selection_drivers.team_selection_id
      and ts.user_id = auth.uid()
  )
);

drop policy if exists "team_selection_drivers_insert_own_team_selection" on public.team_selection_drivers;
create policy "team_selection_drivers_insert_own_team_selection"
on public.team_selection_drivers
for insert
with check (
  exists (
    select 1
    from public.team_selections ts
    where ts.id = team_selection_drivers.team_selection_id
      and ts.user_id = auth.uid()
  )
);

drop policy if exists "team_selection_drivers_update_own_team_selection" on public.team_selection_drivers;
create policy "team_selection_drivers_update_own_team_selection"
on public.team_selection_drivers
for update
using (
  exists (
    select 1
    from public.team_selections ts
    where ts.id = team_selection_drivers.team_selection_id
      and ts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_selections ts
    where ts.id = team_selection_drivers.team_selection_id
      and ts.user_id = auth.uid()
  )
);

-- release 1 note: team_selection_drivers policies are scoped to owner access via parent team_selection;
-- no separate league or lock-window constraints are enforced in RLS yet.

drop policy if exists "predictions_select_own" on public.predictions;
create policy "predictions_select_own"
on public.predictions
for select
using (auth.uid() = user_id);

drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_own"
on public.predictions
for insert
with check (auth.uid() = user_id);

drop policy if exists "predictions_update_own" on public.predictions;
create policy "predictions_update_own"
on public.predictions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- release 1 note: insert policies for profiles, leagues, and league_members are intentionally omitted.
-- account creation and league membership management are expected to run via trusted backend flows.

-- -------------------------
-- Example seed inserts
-- -------------------------
-- Note: These profile IDs must exist in auth.users first.
-- In Supabase, create users via Auth admin or dashboard, then seed profiles with matching IDs.

-- 3 users (profiles)
insert into public.profiles (id, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'MaxFanNL'),
  ('22222222-2222-2222-2222-222222222222', 'PoleHunter'),
  ('33333333-3333-3333-3333-333333333333', 'RainMaster')
on conflict (id) do nothing;

-- 1 league
insert into public.leagues (id, name, join_code, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vrienden GP League', 'GP2026FUN', '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

insert into public.league_members (league_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member')
on conflict (league_id, user_id) do nothing;

-- 1 grand prix
insert into public.grand_prix (
  id,
  name,
  slug,
  qualification_start,
  deadline,
  is_sprint_weekend,
  status
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Dutch Grand Prix 2026',
  'dutch-gp-2026',
  '2026-08-28 13:00:00+00',
  '2026-08-29 13:00:00+00',
  false,
  'open'
)
on conflict (id) do nothing;

-- 4 drivers
insert into public.drivers (id, name, constructor_team, active)
values
  ('d1111111-1111-1111-1111-111111111111', 'Max Verstappen', 'Red Bull', true),
  ('d2222222-2222-2222-2222-222222222222', 'Lando Norris', 'McLaren', true),
  ('d3333333-3333-3333-3333-333333333333', 'Charles Leclerc', 'Ferrari', true),
  ('d4444444-4444-4444-4444-444444444444', 'George Russell', 'Mercedes', true)
on conflict (id) do nothing;

-- Example driver prices for that GP
insert into public.driver_prices (driver_id, grand_prix_id, price)
values
  ('d1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 95),
  ('d2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 90),
  ('d3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 88),
  ('d4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 84)
on conflict (driver_id, grand_prix_id) do nothing;
