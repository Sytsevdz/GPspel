-- Cleanup legacy non-sprint GP score rows.
-- Older rows used 0 for sprint-related score fields even when no sprint results existed.
-- NULL now represents "not published", so we clear those legacy zeros only for GPs
-- that have no sprint results stored.

WITH non_sprint_grand_prix AS (
  SELECT g.id
  FROM grand_prix g
  WHERE NOT EXISTS (
    SELECT 1
    FROM grand_prix_driver_results r
    WHERE r.grand_prix_id = g.id
      AND (
        r.sprint_quali_position IS NOT NULL
        OR r.sprint_race_position IS NOT NULL
      )
  )
)
UPDATE grand_prix_scores s
SET
  team_sprint_quali_points = NULL,
  team_sprint_race_points = NULL,
  sprint_quali_prediction_points = NULL,
  sprint_race_prediction_points = NULL
WHERE s.grand_prix_id IN (SELECT id FROM non_sprint_grand_prix)
  AND (
    s.team_sprint_quali_points = 0
    OR s.team_sprint_race_points = 0
    OR s.sprint_quali_prediction_points = 0
    OR s.sprint_race_prediction_points = 0
  );

WITH non_sprint_grand_prix AS (
  SELECT g.id
  FROM grand_prix g
  WHERE NOT EXISTS (
    SELECT 1
    FROM grand_prix_driver_results r
    WHERE r.grand_prix_id = g.id
      AND (
        r.sprint_quali_position IS NOT NULL
        OR r.sprint_race_position IS NOT NULL
      )
  )
)
UPDATE grand_prix_score_details d
SET
  team_sprint_quali_points = NULL,
  team_sprint_race_points = NULL
WHERE d.grand_prix_id IN (SELECT id FROM non_sprint_grand_prix)
  AND (
    d.team_sprint_quali_points = 0
    OR d.team_sprint_race_points = 0
  );
