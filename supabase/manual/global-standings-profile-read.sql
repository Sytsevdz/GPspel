-- Separate deployment prerequisite; not applied by this PR.
-- The checked-in profiles_select_own policy hides other players, including
-- players outside the viewer's leagues. Run only if no equivalent SELECT
-- policy already exists in the target database.
-- grand_prix_scores has no RLS enabled in the checked-in schema; no change needed.
-- RLS governs rows, so this permits reading all profile columns already granted
-- to authenticated users, not just id and display_name. It grants no writes.
begin;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);
commit;
