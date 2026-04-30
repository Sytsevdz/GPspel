alter table public.grand_prix_driver_results
  add column if not exists sprint_quali_position integer,
  add column if not exists sprint_race_position integer;
