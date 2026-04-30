-- Ensure sprint-weekend flag exists before any future/manual cleanup action uses it.
alter table public.grand_prix
  add column if not exists is_sprint_weekend boolean not null default false;

-- Safety guard:
-- This migration intentionally does not mutate grand_prix_scores/grand_prix_score_details.
-- Automatic cleanup based on default is_sprint_weekend=false can affect real sprint weekends
-- before curated backfill is complete.
-- If cleanup is required, execute it later as an explicit manual/admin task
-- with a verified list of non-sprint grand_prix ids.
