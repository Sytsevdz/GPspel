-- Schema-only: pitstop must be explicitly selected like other bonus questions.
-- No default question, backfill, result update or score recalculation.
alter type public.grand_prix_bonus_question_type
  add value if not exists 'fastest_pitstop_team';
