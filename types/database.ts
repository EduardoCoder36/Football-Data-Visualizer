export interface TeamRow {
  id: number;
  name: string;
  short_name: string;
  tla: string;
  crest_url: string;
  is_promoted: boolean;
  created_at: string;
}

export interface RelegatedReplacementRow {
  id: number;
  season: string;
  promoted_team_id: number;
  relegated_team_id: number;
  finish_position: 'FIRST' | 'SECOND' | 'PLAYOFF_WINNER';
  created_at: string;
}

export interface FixtureRow {
  id: number;
  season: string;
  matchday: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  venue_status: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  kickoff: string;
  created_at: string;
}

export interface TeamTrajectoryRow {
  id: number;
  team_id: number;
  season: string;
  games_played: number;
  is_completed: boolean;
  cumulative_points: number;
  cumulative_goals_for: number;
  cumulative_goals_against: number;
  baseline_points: number | null;
  baseline_goals_for: number | null;
  baseline_goals_against: number | null;
  same_opponent_points: number | null;
  same_opponent_goals_for: number | null;
  same_opponent_goals_against: number | null;
  updated_at: string;
}