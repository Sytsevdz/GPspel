alter type public.grand_prix_bonus_question_type add value if not exists 'best_team';

create table if not exists public.grand_prix_driver_entries (
  id uuid primary key default gen_random_uuid(),
  grand_prix_id uuid not null references public.grand_prix(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  constructor_team text not null,
  is_active boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grand_prix_id, driver_id)
);

alter table public.grand_prix_bonus_predictions add column if not exists answer_team text;
alter table public.grand_prix_bonus_answers add column if not exists answer_team text;
create index if not exists idx_grand_prix_driver_entries_gp on public.grand_prix_driver_entries(grand_prix_id);

alter table public.grand_prix_driver_entries enable row level security;
create policy "grand_prix_driver_entries_read" on public.grand_prix_driver_entries for select using (true);
create policy "grand_prix_driver_entries_admin_write" on public.grand_prix_driver_entries for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
