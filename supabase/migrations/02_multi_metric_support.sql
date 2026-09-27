-- Add new columns for multi-metric support (Goals Scored / Conceded and prior-year baselines)
ALTER TABLE team_trajectories 
  RENAME COLUMN current_points TO cumulative_points;

ALTER TABLE team_trajectories 
  RENAME COLUMN last_year_points TO baseline_points;

ALTER TABLE team_trajectories
  ADD COLUMN is_completed BOOLEAN DEFAULT TRUE,
  ADD COLUMN cumulative_goals_for INTEGER DEFAULT 0,
  ADD COLUMN cumulative_goals_against INTEGER DEFAULT 0,
  ADD COLUMN baseline_goals_for INTEGER,
  ADD COLUMN baseline_goals_against INTEGER;
