alter table public.grand_prix
  add column if not exists is_sprint_weekend boolean not null default false;
