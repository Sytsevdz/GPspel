begin;

-- No historical save receipt exists. Grandfather ALL existing GPs, as agreed,
-- without changing their timing, weekend type or status. Adding with a true
-- default backfills existing rows only when the column is first introduced.
alter table public.grand_prix
  add column if not exists settings_completed boolean not null default true;

-- New GPs must explicitly save settings, even when all inputs are prefilled.
alter table public.grand_prix
  alter column settings_completed set default false;

comment on column public.grand_prix.settings_completed is
  'Explicit settings save receipt; pre-migration GPs are grandfathered as complete.';

-- No new table or policy is needed: this column uses the existing grand_prix
-- SELECT/UPDATE permissions. The checked-in schema intentionally has no RLS
-- on grand_prix. Both application write paths authenticate and require admin.
-- Preserve any additional deployed table-level RLS policies unchanged.
commit;
