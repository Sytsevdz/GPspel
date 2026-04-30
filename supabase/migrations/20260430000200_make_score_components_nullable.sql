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

-- Backfill: convert clearly unpublished sprint zeros to NULL on non-sprint weekends.
UPDATE grand_prix_scores s
SET
  team_sprint_quali_points = NULL,
  team_sprint_race_points = NULL
FROM grand_prix g
WHERE s.grand_prix_id = g.id
  AND COALESCE(g.is_sprint_weekend, false) = false
  AND s.team_sprint_quali_points = 0
  AND s.team_sprint_race_points = 0;

UPDATE grand_prix_score_details d
SET
  team_sprint_quali_points = NULL,
  team_sprint_race_points = NULL
FROM grand_prix g
WHERE d.grand_prix_id = g.id
  AND COALESCE(g.is_sprint_weekend, false) = false
  AND d.team_sprint_quali_points = 0
  AND d.team_sprint_race_points = 0;
