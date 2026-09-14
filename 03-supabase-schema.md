```markdown
# Component: Supabase Database Schema & RLS
**Location:** Database Migrations (`/supabase/migrations/20260913000001_football_schema.sql`)

```sql
-- 1. Teams Table
CREATE TABLE teams (
    id INTEGER PRIMARY KEY, -- Matches football-data.org ID
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    tla VARCHAR(3) NOT NULL,
    crest_url TEXT NOT NULL,
    is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Replacement Mapping Table for Promoted/Relegated Teams
CREATE TABLE relegated_replacements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    season VARCHAR(9) NOT NULL, -- e.g., '2026/2027'
    promoted_team_id INTEGER NOT NULL REFERENCES teams(id),
    relegated_team_id INTEGER NOT NULL, -- Historical reference
    finish_position VARCHAR(20) NOT NULL, -- 'PLAYOFF_WINNER', 'SECOND', 'FIRST'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(season, promoted_team_id)
);

-- 3. Fixtures Table
CREATE TABLE fixtures (
    id INTEGER PRIMARY KEY, -- Matches football-data.org ID
    season VARCHAR(9) NOT NULL,
    matchday INTEGER NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES teams(id),
    away_team_id INTEGER NOT NULL REFERENCES teams(id),
    home_score INTEGER,
    away_score INTEGER,
    venue_status VARCHAR(10) NOT NULL DEFAULT 'FINISHED',
    status VARCHAR(20) NOT NULL, -- SCHEDULED, FINISHED, POSTPONED
    kickoff TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Precomputed Point Trajectories Table (Fast Client Reads)
CREATE TABLE team_trajectories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    season VARCHAR(9) NOT NULL,
    games_played INTEGER NOT NULL CHECK (games_played BETWEEN 1 AND 38),
    current_points INTEGER NOT NULL,
    last_year_points INTEGER, -- NULL for promoted teams
    same_opponent_points INTEGER, -- NULL for promoted teams
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, season, games_played)
);

-- Indexes for lightning-fast reads
CREATE INDEX idx_trajectories_lookup ON team_trajectories(team_id, season, games_played);
CREATE INDEX idx_fixtures_status ON fixtures(status, kickoff);

-- Row Level Security (RLS)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE relegated_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_trajectories ENABLE ROW LEVEL SECURITY;

-- Public read-only policy for client consumption
CREATE POLICY "Public read-only teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read-only replacements" ON relegated_replacements FOR SELECT USING (true);
CREATE POLICY "Public read-only fixtures" ON fixtures FOR SELECT USING (true);
CREATE POLICY "Public read-only trajectories" ON team_trajectories FOR SELECT USING (true);