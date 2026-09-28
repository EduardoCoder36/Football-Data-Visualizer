ALTER TABLE fixtures
  ADD COLUMN half_time_home_score INTEGER,
  ADD COLUMN half_time_away_score INTEGER,
  ADD COLUMN prior_home_score INTEGER,
  ADD COLUMN prior_away_score INTEGER,
  ADD COLUMN is_promoted_replacement BOOLEAN DEFAULT FALSE;
