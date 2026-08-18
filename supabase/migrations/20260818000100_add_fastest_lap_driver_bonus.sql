-- Add the second generic bonus-question type and driver-valued answers.
alter type public.grand_prix_bonus_question_type add value if not exists 'fastest_lap_driver';

alter table public.grand_prix_bonus_questions
  alter column question_text drop not null;

alter table public.grand_prix_bonus_predictions
  add column if not exists answer_driver_id uuid references public.drivers(id) on delete restrict;

alter table public.grand_prix_bonus_answers
  add column if not exists answer_driver_id uuid references public.drivers(id) on delete restrict;

