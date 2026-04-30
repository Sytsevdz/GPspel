alter table public.predictions
  add column if not exists sprint_quali_p1 uuid references public.drivers(id) on delete set null,
  add column if not exists sprint_quali_p2 uuid references public.drivers(id) on delete set null,
  add column if not exists sprint_quali_p3 uuid references public.drivers(id) on delete set null,
  add column if not exists sprint_race_p1 uuid references public.drivers(id) on delete set null,
  add column if not exists sprint_race_p2 uuid references public.drivers(id) on delete set null,
  add column if not exists sprint_race_p3 uuid references public.drivers(id) on delete set null;
