import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamMetricPoint {
  gameweek: number;
  match_date: string;
  opponent_name: string;
  is_home: boolean;
  score_display: string;
  match_goals: number;
  match_conceded: number;
  match_xg: number;
  match_axg: number;
  match_points: number;
  cum_xg: number;
  cum_axg: number;
  cum_goals: number;
  cum_conceded: number;
  cum_points: number;
  cum_shots_on_target: number;
  cum_shots_off_target: number;
  cum_corners: number;
}

export type TeamMetricKey =
  | 'cum_xg'
  | 'cum_axg'
  | 'cum_goals'
  | 'cum_conceded'
  | 'cum_points'
  | 'cum_shots_on_target'
  | 'cum_shots_off_target'
  | 'cum_corners';

export interface MetricChipConfig {
  key: TeamMetricKey;
  label: string;
  shortLabel: string;
  color: string;
  unit: string;
  isFloat?: boolean;
}

export const TEAM_METRIC_CHIPS: MetricChipConfig[] = [
  { key: 'cum_xg', label: 'Cum. xG', shortLabel: 'xG', color: '#10b981', unit: 'xG', isFloat: true },
  { key: 'cum_axg', label: 'Cum. aXG', shortLabel: 'aXG', color: '#f43f5e', unit: 'aXG', isFloat: true },
  { key: 'cum_goals', label: 'Goals Scored', shortLabel: 'GF', color: '#0ea5e9', unit: 'goals' },
  { key: 'cum_conceded', label: 'Goals Conceded', shortLabel: 'GA', color: '#f59e0b', unit: 'goals' },
  { key: 'cum_points', label: 'Points', shortLabel: 'PTS', color: '#8b5cf6', unit: 'pts' },
  { key: 'cum_shots_on_target', label: 'Shots on Target', shortLabel: 'SoT', color: '#06b6d4', unit: 'shots' },
  { key: 'cum_shots_off_target', label: 'Shots Off Target', shortLabel: 'Off Target', color: '#64748b', unit: 'shots' },
  { key: 'cum_corners', label: 'Corners', shortLabel: 'Corners', color: '#eab308', unit: 'corners' },
];

export const DEFAULT_ACTIVE_METRICS: TeamMetricKey[] = ['cum_xg', 'cum_goals', 'cum_points'];

export function getCanonicalTeamName(rawName: string): string {
  if (!rawName) return '';
  const clean = rawName.trim();
  const map: Record<string, string> = {
    'Arsenal FC': 'Arsenal',
    'Aston Villa FC': 'Aston Villa',
    'AFC Bournemouth': 'Bournemouth',
    'Bournemouth': 'Bournemouth',
    'Brentford FC': 'Brentford',
    'Brighton & Hove Albion FC': 'Brighton & Hove Albion',
    'Brighton Hove': 'Brighton & Hove Albion',
    'Brighton and Hove Albion': 'Brighton & Hove Albion',
    'Chelsea FC': 'Chelsea',
    'Coventry City FC': 'Coventry City',
    'Crystal Palace FC': 'Crystal Palace',
    'Everton FC': 'Everton',
    'Fulham FC': 'Fulham',
    'Hull City AFC': 'Hull City',
    'Ipswich Town FC': 'Ipswich Town',
    'Leeds United FC': 'Leeds United',
    'Liverpool FC': 'Liverpool',
    'Manchester City FC': 'Manchester City',
    'Man City': 'Manchester City',
    'Manchester United FC': 'Manchester United',
    'Man United': 'Manchester United',
    'Newcastle United FC': 'Newcastle United',
    'Nottingham Forest FC': 'Nottingham Forest',
    'Sunderland AFC': 'Sunderland',
    'Tottenham Hotspur FC': 'Tottenham Hotspur',
    'Spurs': 'Tottenham Hotspur',
  };
  if (map[clean]) return map[clean];
  return clean.replace(/ (FC|AFC)$/, '').trim();
}

export async function fetchTeamMetrics(
  supabase: SupabaseClient,
  rawTeamName: string
): Promise<TeamMetricPoint[]> {
  const canonicalName = getCanonicalTeamName(rawTeamName);
  if (!canonicalName) return [];

  // 1. Fetch team's match raw stats ordered chronologically
  const { data: teamRows, error: teamErr } = await supabase
    .from('match_raw_stats')
    .select('fixture_id, match_date, team_name, opponent_name, is_home, goals, expected_goals, possession_pct, shots_total, shots_on_target, shots_off_target, shots_blocked, corners')
    .eq('team_name', canonicalName)
    .order('match_date', { ascending: true });

  if (teamErr || !teamRows || teamRows.length === 0) {
    return [];
  }

  // 2. Fetch opponent match raw stats for these fixtures to extract conceded goals and aXG
  const fixtureIds = teamRows.map((r: any) => r.fixture_id);
  const { data: oppRows, error: oppErr } = await supabase
    .from('match_raw_stats')
    .select('fixture_id, team_name, goals, expected_goals')
    .in('fixture_id', fixtureIds)
    .neq('team_name', canonicalName);

  const oppMap = new Map<number, any>();
  if (oppRows) {
    oppRows.forEach((o: any) => {
      oppMap.set(o.fixture_id, o);
    });
  }

  // 3. Compute running cumulative metrics per gameweek
  let runningXg = 0;
  let runningAxg = 0;
  let runningGoals = 0;
  let runningConceded = 0;
  let runningPoints = 0;
  let runningShotsOnTarget = 0;
  let runningShotsOffTarget = 0;
  let runningCorners = 0;

  return teamRows.map((r: any, idx: number) => {
    const opp = oppMap.get(r.fixture_id);
    const mGoals = Number(r.goals) || 0;
    const mConceded = Number(opp?.goals) || 0;
    const mXg = Number(r.expected_goals) || 0;
    const mAxg = Number(opp?.expected_goals) || 0;
    const mPts = mGoals > mConceded ? 3 : mGoals === mConceded ? 1 : 0;
    const mSot = Number(r.shots_on_target) || 0;
    const mSoff = Number(r.shots_off_target) || 0;
    const mCorners = Number(r.corners) || 0;

    runningXg = +(runningXg + mXg).toFixed(2);
    runningAxg = +(runningAxg + mAxg).toFixed(2);
    runningGoals += mGoals;
    runningConceded += mConceded;
    runningPoints += mPts;
    runningShotsOnTarget += mSot;
    runningShotsOffTarget += mSoff;
    runningCorners += mCorners;

    const oppName = r.opponent_name || opp?.team_name || 'Opponent';
    const venue = r.is_home ? 'H' : 'A';
    const scoreDisplay = `${mGoals}-${mConceded} vs ${oppName} (${venue})`;

    return {
      gameweek: idx + 1,
      match_date: r.match_date,
      opponent_name: oppName,
      is_home: Boolean(r.is_home),
      score_display: scoreDisplay,
      match_goals: mGoals,
      match_conceded: mConceded,
      match_xg: mXg,
      match_axg: mAxg,
      match_points: mPts,
      cum_xg: runningXg,
      cum_axg: runningAxg,
      cum_goals: runningGoals,
      cum_conceded: runningConceded,
      cum_points: runningPoints,
      cum_shots_on_target: runningShotsOnTarget,
      cum_shots_off_target: runningShotsOffTarget,
      cum_corners: runningCorners,
    };
  });
}

