-- Configurable one-per-GP bonus predictions.
-- Safe to run against environments where these objects already exist.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'grand_prix_bonus_question_type') then
    create type public.grand_prix_bonus_question_type as enum ('driver_finish_position');
  end if;
end$$;

alter table if exists public.profiles
  add column if not exists role text check (role in ('admin', 'player', 'member'));

alter table if exists public.predictions
  add column if not exists fastest_pitstop_team text;

alter table if exists public.grand_prix_scores
  add column if not exists bonus_prediction_points integer;

create table if not exists public.grand_prix_bonus_questions (
  id uuid primary key default gen_random_uuid(),
  grand_prix_id uuid not null references public.grand_prix(id) on delete cascade,
  question_type public.grand_prix_bonus_question_type not null,
  question_text text not null check (char_length(trim(question_text)) > 0),
  subject_driver_id uuid references public.drivers(id) on delete restrict,
  points integer not null default 10 check (points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grand_prix_id),
  check (question_type <> 'driver_finish_position' or subject_driver_id is not null)
);

create table if not exists public.grand_prix_bonus_predictions (
  id uuid primary key default gen_random_uuid(),
  grand_prix_bonus_question_id uuid not null references public.grand_prix_bonus_questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer_position integer check (answer_position is null or answer_position >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grand_prix_bonus_question_id, user_id)
);

create table if not exists public.grand_prix_bonus_answers (
  id uuid primary key default gen_random_uuid(),
  grand_prix_bonus_question_id uuid not null references public.grand_prix_bonus_questions(id) on delete cascade,
  answer_position integer check (answer_position is null or answer_position >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grand_prix_bonus_question_id)
);

create table if not exists public.grand_prix_bonus_prediction_scores (
  id uuid primary key default gen_random_uuid(),
  grand_prix_bonus_question_id uuid not null references public.grand_prix_bonus_questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grand_prix_bonus_question_id, user_id)
);

create index if not exists idx_grand_prix_bonus_questions_gp
  on public.grand_prix_bonus_questions(grand_prix_id);
create index if not exists idx_grand_prix_bonus_predictions_user
  on public.grand_prix_bonus_predictions(user_id);
create index if not exists idx_grand_prix_bonus_prediction_scores_user
  on public.grand_prix_bonus_prediction_scores(user_id);

alter table public.grand_prix_bonus_questions enable row level security;
alter table public.grand_prix_bonus_predictions enable row level security;
alter table public.grand_prix_bonus_answers enable row level security;
alter table public.grand_prix_bonus_prediction_scores enable row level security;

-- Questions are safe for authenticated players to read; admin writes are checked by profile role.
drop policy if exists "grand_prix_bonus_questions_select_authenticated" on public.grand_prix_bonus_questions;
create policy "grand_prix_bonus_questions_select_authenticated"
on public.grand_prix_bonus_questions
for select
using (auth.uid() is not null);

drop policy if exists "grand_prix_bonus_questions_admin_all" on public.grand_prix_bonus_questions;
create policy "grand_prix_bonus_questions_admin_all"
on public.grand_prix_bonus_questions
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Players can manage only their own bonus predictions.
drop policy if exists "grand_prix_bonus_predictions_select_own" on public.grand_prix_bonus_predictions;
create policy "grand_prix_bonus_predictions_select_own"
on public.grand_prix_bonus_predictions
for select
using (auth.uid() = user_id);

drop policy if exists "grand_prix_bonus_predictions_select_league_after_deadline" on public.grand_prix_bonus_predictions;
create policy "grand_prix_bonus_predictions_select_league_after_deadline"
on public.grand_prix_bonus_predictions
for select
using (
  exists (
    select 1
    from public.grand_prix_bonus_questions gbq
    join public.league_members lm_requester on lm_requester.user_id = auth.uid()
    join public.league_members lm_target
      on lm_target.league_id = lm_requester.league_id
     and lm_target.user_id = grand_prix_bonus_predictions.user_id
    join public.grand_prix gp on gp.id = gbq.grand_prix_id
    where gbq.id = grand_prix_bonus_predictions.grand_prix_bonus_question_id
      and gp.deadline <= now()
  )
);

drop policy if exists "grand_prix_bonus_predictions_insert_own" on public.grand_prix_bonus_predictions;
create policy "grand_prix_bonus_predictions_insert_own"
on public.grand_prix_bonus_predictions
for insert
with check (auth.uid() = user_id);

drop policy if exists "grand_prix_bonus_predictions_update_own" on public.grand_prix_bonus_predictions;
create policy "grand_prix_bonus_predictions_update_own"
on public.grand_prix_bonus_predictions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Official answers and score rows are visible to authenticated users; admin writes are checked by role.
drop policy if exists "grand_prix_bonus_answers_select_authenticated" on public.grand_prix_bonus_answers;
create policy "grand_prix_bonus_answers_select_authenticated"
on public.grand_prix_bonus_answers
for select
using (auth.uid() is not null);

drop policy if exists "grand_prix_bonus_answers_admin_all" on public.grand_prix_bonus_answers;
create policy "grand_prix_bonus_answers_admin_all"
on public.grand_prix_bonus_answers
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "grand_prix_bonus_prediction_scores_select_authenticated" on public.grand_prix_bonus_prediction_scores;
create policy "grand_prix_bonus_prediction_scores_select_authenticated"
on public.grand_prix_bonus_prediction_scores
for select
using (auth.uid() is not null);

drop policy if exists "grand_prix_bonus_prediction_scores_admin_all" on public.grand_prix_bonus_prediction_scores;
create policy "grand_prix_bonus_prediction_scores_admin_all"
on public.grand_prix_bonus_prediction_scores
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
