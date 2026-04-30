-- Make score component publication fields nullable so NULL = unpublished.
ALTER TABLE grand_prix_scores
  ALTER COLUMN team_sprint_quali_points DROP NOT NULL,
  ALTER COLUMN team_sprint_quali_points DROP DEFAULT,
  ALTER COLUMN team_sprint_race_points DROP NOT NULL,
  ALTER COLUMN team_sprint_race_points DROP DEFAULT,
  ALTER COLUMN team_quali_points DROP NOT NULL,
  ALTER COLUMN team_quali_points DROP DEFAULT,
  ALTER COLUMN team_race_points DROP NOT NULL,
  ALTER COLUMN team_race_points DROP DEFAULT;

ALTER TABLE grand_prix_score_details
  ALTER COLUMN team_sprint_quali_points DROP NOT NULL,
  ALTER COLUMN team_sprint_quali_points DROP DEFAULT,
  ALTER COLUMN team_sprint_race_points DROP NOT NULL,
  ALTER COLUMN team_sprint_race_points DROP DEFAULT,
  ALTER COLUMN team_quali_points DROP NOT NULL,
  ALTER COLUMN team_quali_points DROP DEFAULT,
  ALTER COLUMN team_race_points DROP NOT NULL,
  ALTER COLUMN team_race_points DROP DEFAULT;

-- NOTE:
-- Intentionally no data cleanup UPDATE here.
-- Setting is_sprint_weekend defaults to false for existing rows until explicitly backfilled,
-- so automatic cleanup could mutate legitimate sprint-weekend data.
-- Any sprint-score cleanup must run later as a manual/admin action with curated GP ids.
