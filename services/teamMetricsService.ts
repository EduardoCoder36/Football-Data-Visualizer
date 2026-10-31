import { SupabaseClient } from '@supabase/supabase-js';

export interface SeasonPair {
  currentSeason: string;
  previousSeason: string;
}

export interface TeamMetricPoint {
  gameweek: number;
  is_completed: boolean;
  match_date: string | null;
  opponent_name: string | null;
  is_home: boolean | null;
  score_display: string | null;
  baseline_score_display?: string | null;
  same_opp_score_display?: string | null;
  match_goals: number | null;
  match_conceded: number | null;
  match_xg: number | null;
  match_axg: number | null;
  match_points: number | null;
  // Current Progress (Cumulative)
  cum_xg: number | null;
  cum_axg: number | null;
  cum_goals: number | null;
  cum_conceded: number | null;
  cum_points: number | null;
  cum_shots_on_target: number | null;
  cum_shots_off_target: number | null;
  cum_corners: number | null;
  // Last Year's Pace / Same Stage Baseline (Cumulative)
  cum_xg_baseline: number | null;
  cum_axg_baseline: number | null;
  cum_goals_baseline: number | null;
  cum_conceded_baseline: number | null;
  cum_points_baseline: number | null;
  cum_shots_on_target_baseline: number | null;
  cum_shots_off_target_baseline: number | null;
  cum_corners_baseline: number | null;
  // Same Opponents / Equivalent Opponents Baseline (Cumulative)
  cum_xg_same_opp: number | null;
  cum_axg_same_opp: number | null;
  cum_goals_same_opp: number | null;
  cum_conceded_same_opp: number | null;
  cum_points_same_opp: number | null;
  cum_shots_on_target_same_opp: number | null;
  cum_shots_off_target_same_opp: number | null;
  cum_corners_same_opp: number | null;
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

export function deriveSeasonPairFromDate(now: Date = new Date()): SeasonPair {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const startYear = month >= 7 ? year : year - 1;
  return {
    currentSeason: `${startYear}/${startYear + 1}`,
    previousSeason: `${startYear - 1}/${startYear}`,
  };
}

export async function getSeasonPair(supabase?: SupabaseClient): Promise<SeasonPair> {
  if (supabase) {
    const { data: rawStatRow } = await supabase
      .from('match_raw_stats')
      .select('season')
      .not('season', 'is', null)
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle();

    const seasonStr = rawStatRow?.season;
    if (seasonStr && typeof seasonStr === 'string' && seasonStr.includes('/')) {
      const startYear = parseInt(seasonStr.split('/')[0], 10);
      if (!Number.isNaN(startYear)) {
        return {
          currentSeason: `${startYear}/${startYear + 1}`,
          previousSeason: `${startYear - 1}/${startYear}`,
        };
      }
    }

    const { data: fixtureRow } = await supabase
      .from('fixtures')
      .select('season')
      .not('season', 'is', null)
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fixSeasonStr = fixtureRow?.season;
    if (fixSeasonStr && typeof fixSeasonStr === 'string' && fixSeasonStr.includes('/')) {
      const startYear = parseInt(fixSeasonStr.split('/')[0], 10);
      if (!Number.isNaN(startYear)) {
        return {
          currentSeason: `${startYear}/${startYear + 1}`,
          previousSeason: `${startYear - 1}/${startYear}`,
        };
      }
    }
  }

  return deriveSeasonPairFromDate();
}

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
    'Burnley FC': 'Burnley',
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
    'West Ham United FC': 'West Ham United',
    'Wolverhampton Wanderers FC': 'Wolverhampton Wanderers',
    'Wolves': 'Wolverhampton Wanderers',
  };
  if (map[clean]) return map[clean];
  return clean.replace(/ (FC|AFC)$/, '').trim();
}

interface ParsedMatchMetrics {
  fixture_id: number;
  match_date: string;
  opponent_canonical: string;
  is_home: boolean;
  goals: number;
  conceded: number;
  xg: number;
  axg: number;
  points: number;
  shots_on_target: number;
  shots_off_target: number;
  corners: number;
  score_display: string;
}

export async function fetchTeamMetrics(
  supabase: SupabaseClient,
  rawTeamName: string
): Promise<TeamMetricPoint[]> {
  const canonicalName = getCanonicalTeamName(rawTeamName);
  if (!canonicalName) return [];

  // 1. Dynamically derive currentSeason and previousSeason
  const { currentSeason, previousSeason } = await getSeasonPair(supabase);

  // 2. Fetch teams & relegated_replacements for currentSeason to build Equivalent Opponent map
  const [{ data: teamCatalog }, { data: replacementRows }] = await Promise.all([
    supabase.from('teams').select('id, name'),
    supabase
      .from('relegated_replacements')
      .select('promoted_team_id, relegated_team_id')
      .eq('season', currentSeason),
  ]);

  const idToCanonicalName = new Map<number, string>();
  (teamCatalog || []).forEach((t: any) => {
    idToCanonicalName.set(t.id, getCanonicalTeamName(t.name));
  });

  // promoted canonical team name -> relegated canonical team name
  const promotedToRelegatedMap = new Map<string, string>();
  (replacementRows || []).forEach((r: any) => {
    const promotedName = idToCanonicalName.get(r.promoted_team_id);
    const relegatedName = idToCanonicalName.get(r.relegated_team_id);
    if (promotedName && relegatedName) {
      promotedToRelegatedMap.set(promotedName, relegatedName);
    }
  });

  const isSelectedClubPromoted = promotedToRelegatedMap.has(canonicalName);

  // 3. Fetch team's match_raw_stats for both currentSeason and previousSeason ordered chronologically
  const { data: teamRows, error: teamErr } = await supabase
    .from('match_raw_stats')
    .select(
      'fixture_id, season, match_date, team_name, opponent_name, is_home, goals, expected_goals, possession_pct, shots_total, shots_on_target, shots_off_target, shots_blocked, corners'
    )
    .eq('team_name', canonicalName)
    .in('season', [currentSeason, previousSeason])
    .order('match_date', { ascending: true });

  if (teamErr || !teamRows || teamRows.length === 0) {
    return [];
  }

  // 4. Fetch opponent match_raw_stats for these fixtures to extract conceded goals and aXG
  const fixtureIds = teamRows.map((r: any) => r.fixture_id);
  const { data: oppRows } = await supabase
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

  const parseRow = (r: any): ParsedMatchMetrics => {
    const opp = oppMap.get(r.fixture_id);
    const mGoals = Number(r.goals) || 0;
    const mConceded = Number(opp?.goals) || 0;
    const mXg = Number(r.expected_goals) || 0;
    const mAxg = Number(opp?.expected_goals) || 0;
    const mPts = mGoals > mConceded ? 3 : mGoals === mConceded ? 1 : 0;
    const mSot = Number(r.shots_on_target) || 0;
    const mSoff = Number(r.shots_off_target) || 0;
    const mCorners = Number(r.corners) || 0;

    const oppName = getCanonicalTeamName(r.opponent_name || opp?.team_name || 'Opponent');
    const isHome = Boolean(r.is_home);
    const venue = isHome ? 'H' : 'A';
    const scoreDisplay = `${mGoals}-${mConceded} vs ${oppName} (${venue})`;

    return {
      fixture_id: r.fixture_id,
      match_date: r.match_date,
      opponent_canonical: oppName,
      is_home: isHome,
      goals: mGoals,
      conceded: mConceded,
      xg: mXg,
      axg: mAxg,
      points: mPts,
      shots_on_target: mSot,
      shots_off_target: mSoff,
      corners: mCorners,
      score_display: scoreDisplay,
    };
  };

  const currentMatches: ParsedMatchMetrics[] = [];
  const previousMatches: ParsedMatchMetrics[] = [];

  teamRows.forEach((r: any) => {
    if (r.season === currentSeason) {
      currentMatches.push(parseRow(r));
    } else if (r.season === previousSeason) {
      previousMatches.push(parseRow(r));
    }
  });

  // 5. Build running cumulative series across up to 38 gameweeks
  const totalSlots = Math.max(currentMatches.length, previousMatches.length);
  if (totalSlots === 0) return [];

  let curXg = 0;
  let curAxg = 0;
  let curGoals = 0;
  let curConceded = 0;
  let curPoints = 0;
  let curSot = 0;
  let curSoff = 0;
  let curCorners = 0;

  let baseXg = 0;
  let baseAxg = 0;
  let baseGoals = 0;
  let baseConceded = 0;
  let basePoints = 0;
  let baseSot = 0;
  let baseSoff = 0;
  let baseCorners = 0;

  let eqXg = 0;
  let eqAxg = 0;
  let eqGoals = 0;
  let eqConceded = 0;
  let eqPoints = 0;
  let eqSot = 0;
  let eqSoff = 0;
  let eqCorners = 0;

  const hasPreviousSeason = !isSelectedClubPromoted && previousMatches.length > 0;
  const usedPrevFixtureIds = new Set<number>();

  const points: TeamMetricPoint[] = [];

  for (let i = 0; i < totalSlots; i++) {
    const cur = currentMatches[i];
    const prev = hasPreviousSeason ? previousMatches[i] : undefined;

    // A. Current Progress (only defined for completed matches in currentSeason)
    if (cur) {
      curXg = +(curXg + cur.xg).toFixed(2);
      curAxg = +(curAxg + cur.axg).toFixed(2);
      curGoals += cur.goals;
      curConceded += cur.conceded;
      curPoints += cur.points;
      curSot += cur.shots_on_target;
      curSoff += cur.shots_off_target;
      curCorners += cur.corners;
    }

    // B. Last Year's Pace (Same Stage Gameweek in previousSeason)
    if (prev) {
      baseXg = +(baseXg + prev.xg).toFixed(2);
      baseAxg = +(baseAxg + prev.axg).toFixed(2);
      baseGoals += prev.goals;
      baseConceded += prev.conceded;
      basePoints += prev.points;
      baseSot += prev.shots_on_target;
      baseSoff += prev.shots_off_target;
      baseCorners += prev.corners;
    }

    // C. Same Opponents (Equivalent Opponents in previousSeason up to completed matchday N)
    let matchedEq: ParsedMatchMetrics | undefined;
    if (cur && hasPreviousSeason) {
      const targetOpponent =
        promotedToRelegatedMap.get(cur.opponent_canonical) || cur.opponent_canonical;

      // Prefer exact venue (is_home) match not yet used, then exact venue match, then any H2H match
      matchedEq =
        previousMatches.find(
          (m) =>
            m.opponent_canonical === targetOpponent &&
            m.is_home === cur.is_home &&
            !usedPrevFixtureIds.has(m.fixture_id)
        ) ||
        previousMatches.find(
          (m) => m.opponent_canonical === targetOpponent && m.is_home === cur.is_home
        ) ||
        previousMatches.find((m) => m.opponent_canonical === targetOpponent);

      if (matchedEq) {
        usedPrevFixtureIds.add(matchedEq.fixture_id);
        eqXg = +(eqXg + matchedEq.xg).toFixed(2);
        eqAxg = +(eqAxg + matchedEq.axg).toFixed(2);
        eqGoals += matchedEq.goals;
        eqConceded += matchedEq.conceded;
        eqPoints += matchedEq.points;
        eqSot += matchedEq.shots_on_target;
        eqSoff += matchedEq.shots_off_target;
        eqCorners += matchedEq.corners;
      }
    }

    const hasCur = Boolean(cur);
    const hasBase = Boolean(prev);
    const hasEq = Boolean(cur && hasPreviousSeason);

    points.push({
      gameweek: i + 1,
      is_completed: hasCur,
      match_date: cur?.match_date ?? prev?.match_date ?? null,
      opponent_name: cur?.opponent_canonical ?? null,
      is_home: cur ? cur.is_home : null,
      score_display: cur?.score_display ?? null,
      baseline_score_display: prev?.score_display ?? null,
      same_opp_score_display: matchedEq?.score_display ?? null,
      match_goals: cur ? cur.goals : null,
      match_conceded: cur ? cur.conceded : null,
      match_xg: cur ? cur.xg : null,
      match_axg: cur ? cur.axg : null,
      match_points: cur ? cur.points : null,
      // Current Progress
      cum_xg: hasCur ? curXg : null,
      cum_axg: hasCur ? curAxg : null,
      cum_goals: hasCur ? curGoals : null,
      cum_conceded: hasCur ? curConceded : null,
      cum_points: hasCur ? curPoints : null,
      cum_shots_on_target: hasCur ? curSot : null,
      cum_shots_off_target: hasCur ? curSoff : null,
      cum_corners: hasCur ? curCorners : null,
      // Last Year's Pace
      cum_xg_baseline: hasBase ? baseXg : null,
      cum_axg_baseline: hasBase ? baseAxg : null,
      cum_goals_baseline: hasBase ? baseGoals : null,
      cum_conceded_baseline: hasBase ? baseConceded : null,
      cum_points_baseline: hasBase ? basePoints : null,
      cum_shots_on_target_baseline: hasBase ? baseSot : null,
      cum_shots_off_target_baseline: hasBase ? baseSoff : null,
      cum_corners_baseline: hasBase ? baseCorners : null,
      // Same Opponents
      cum_xg_same_opp: hasEq ? eqXg : null,
      cum_axg_same_opp: hasEq ? eqAxg : null,
      cum_goals_same_opp: hasEq ? eqGoals : null,
      cum_conceded_same_opp: hasEq ? eqConceded : null,
      cum_points_same_opp: hasEq ? eqPoints : null,
      cum_shots_on_target_same_opp: hasEq ? eqSot : null,
      cum_shots_off_target_same_opp: hasEq ? eqSoff : null,
      cum_corners_same_opp: hasEq ? eqCorners : null,
    });
  }

  return points;
}

