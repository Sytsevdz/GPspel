alter table public.predictions
  add column if not exists sprint_quali_p1 uuid references public.drivers(id) on delete restrict,
  add column if not exists sprint_quali_p2 uuid references public.drivers(id) on delete restrict,
  add column if not exists sprint_quali_p3 uuid references public.drivers(id) on delete restrict,
  add column if not exists sprint_race_p1 uuid references public.drivers(id) on delete restrict,
  add column if not exists sprint_race_p2 uuid references public.drivers(id) on delete restrict,
  add column if not exists sprint_race_p3 uuid references public.drivers(id) on delete restrict;

alter table public.predictions
  drop constraint if exists predictions_sprint_quali_unique_check,
  drop constraint if exists predictions_sprint_race_unique_check;

alter table public.predictions
  add constraint predictions_sprint_quali_unique_check check (
    (sprint_quali_p1 is null and sprint_quali_p2 is null and sprint_quali_p3 is null)
    or (sprint_quali_p1 is not null and sprint_quali_p2 is not null and sprint_quali_p3 is not null and sprint_quali_p1 <> sprint_quali_p2 and sprint_quali_p1 <> sprint_quali_p3 and sprint_quali_p2 <> sprint_quali_p3)
  ),
  add constraint predictions_sprint_race_unique_check check (
    (sprint_race_p1 is null and sprint_race_p2 is null and sprint_race_p3 is null)
    or (sprint_race_p1 is not null and sprint_race_p2 is not null and sprint_race_p3 is not null and sprint_race_p1 <> sprint_race_p2 and sprint_race_p1 <> sprint_race_p3 and sprint_race_p2 <> sprint_race_p3)
  );
