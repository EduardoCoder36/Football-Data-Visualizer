import { createClient } from '@supabase/supabase-js';
import { TEAM_COLORS, getTeamColor } from '@/constants/teamColors';
import {
  resolveCanonicalTla,
  getClubCrestStyle,
} from '@/components/analytics/GenericTeamCrest';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
});

const supabaseDev = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'dev' },
});

export type PlayerPosition = 'GKP' | 'DEF' | 'MID' | 'FWD';

export interface PlayerTeamInfo {
  id: number;
  name: string;
  short_name: string;
  tla: string;
  crest_url: string | null;
  primary_color: string;
}

export interface PlayerRatingsData {
  season: string;
  overall_rating: number;
  sample_minutes: number;
  cohort_position: PlayerPosition;
  stat_speed: number;
  stat_strength: number;
  stat_jumping: number;
  stat_acceleration: number;
  stat_stamina: number;
  stat_touch: number;
  stat_vision: number;
  stat_positioning: number;
  stat_short_passing: number;
  stat_long_passing: number;
  stat_shots: number;
  stat_long_shots: number;
  stat_crossing: number;
  stat_heading: number;
  stat_tackling: number;
  stat_defensive_positioning: number;
  radar_shooting: number;
  radar_passing: number;
  radar_dribbling: number;
  radar_defending: number;
  radar_physical: number;
  radar_aerial: number;
}

export interface PlayerSeasonAggregatesData {
  season: string;
  matches_played: number;
  starts: number;
  minutes_played: number;
  goals: number;
  npxg: number;
  shots_total: number;
  shots_on_target: number;
  shots_outside_box: number;
  shots_per_90: number;
  shot_accuracy_pct: number;
  assists: number;
  xa: number;
  key_passes: number;
  key_passes_per_90: number;
  passes_completed: number;
  passes_attempted: number;
  pass_completion_pct: number;
  passes_completed_short: number;
  pass_short_completion_pct: number;
  passes_completed_long: number;
  pass_long_completion_pct: number;
  crosses_completed: number;
  cross_completion_pct: number;
  through_balls: number;
  touches: number;
  touches_in_box: number;
  progressive_carries: number;
  progressive_carries_per_90: number;
  take_ons_won: number;
  take_on_success_pct: number;
  dispossessed_per_90: number;
  miscontrols_per_90: number;
  tackles_won: number;
  tackles_per_90: number;
  tackle_success_pct: number;
  interceptions: number;
  interceptions_per_90: number;
  blocks: number;
  clearances: number;
  ground_duels_won: number;
  ground_duel_win_pct: number;
  aerial_duels_won: number;
  aerial_duels_lost: number;
  aerial_win_pct: number;
  fouls_committed: number;
  fouls_drawn: number;
  fpl_total_points: number;
  fpl_bonus_points: number;
  fpl_clean_sheets: number;
}

export interface PlayerListItem {
  id: string;
  fpl_id: number | null;
  web_name: string;
  full_name: string;
  primary_position: PlayerPosition;
  team_id: number | null;
  fpl_cost: number | null;
  is_injured: boolean;
  chance_of_playing_next_round: number | null;
  news: string | null;
  face_seed: string;
  shirt_number: number | null;
  overall_rating: number;
  sample_minutes: number;
  team: PlayerTeamInfo | null;
}

export interface PlayerProfileData {
  id: string;
  fpl_id: number | null;
  fbref_id: string | null;
  web_name: string;
  first_name: string | null;
  second_name: string | null;
  full_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  primary_position: PlayerPosition;
  detailed_position: string | null;
  shirt_number: number | null;
  fpl_cost: number | null;
  is_injured: boolean;
  news: string | null;
  chance_of_playing_next_round: number | null;
  face_seed: string;
  team_id: number | null;
  team: PlayerTeamInfo | null;
  ratings: PlayerRatingsData;
  aggregates: PlayerSeasonAggregatesData;
}

export interface GetPlayersListParams {
  search?: string;
  position?: string;
  teamId?: number | string | null;
  page?: number;
  limit?: number;
}

export interface GetPlayersListResult {
  players: PlayerListItem[];
  teams: PlayerTeamInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const TARGET_SEASON = '2026/2027';

function normalizeSearchText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ø/g, 'O')
    .replace(/ø/g, 'o')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .replace(/Ł/g, 'L')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .trim();
}

function createBaselineRatings(position: PlayerPosition = 'MID'): PlayerRatingsData {
  return {
    season: TARGET_SEASON,
    overall_rating: 50,
    sample_minutes: 0,
    cohort_position: position,
    stat_speed: 50,
    stat_strength: 50,
    stat_jumping: 50,
    stat_acceleration: 50,
    stat_stamina: 50,
    stat_touch: 50,
    stat_vision: 50,
    stat_positioning: 50,
    stat_short_passing: 50,
    stat_long_passing: 50,
    stat_shots: 50,
    stat_long_shots: 50,
    stat_crossing: 50,
    stat_heading: 50,
    stat_tackling: 50,
    stat_defensive_positioning: 50,
    radar_shooting: 50,
    radar_passing: 50,
    radar_dribbling: 50,
    radar_defending: 50,
    radar_physical: 50,
    radar_aerial: 50,
  };
}

function createBaselineAggregates(): PlayerSeasonAggregatesData {
  return {
    season: TARGET_SEASON,
    matches_played: 0,
    starts: 0,
    minutes_played: 0,
    goals: 0,
    npxg: 0,
    shots_total: 0,
    shots_on_target: 0,
    shots_outside_box: 0,
    shots_per_90: 0,
    shot_accuracy_pct: 0,
    assists: 0,
    xa: 0,
    key_passes: 0,
    key_passes_per_90: 0,
    passes_completed: 0,
    passes_attempted: 0,
    pass_completion_pct: 0,
    passes_completed_short: 0,
    pass_short_completion_pct: 0,
    passes_completed_long: 0,
    pass_long_completion_pct: 0,
    crosses_completed: 0,
    cross_completion_pct: 0,
    through_balls: 0,
    touches: 0,
    touches_in_box: 0,
    progressive_carries: 0,
    progressive_carries_per_90: 0,
    take_ons_won: 0,
    take_on_success_pct: 0,
    dispossessed_per_90: 0,
    miscontrols_per_90: 0,
    tackles_won: 0,
    tackles_per_90: 0,
    tackle_success_pct: 0,
    interceptions: 0,
    interceptions_per_90: 0,
    blocks: 0,
    clearances: 0,
    ground_duels_won: 0,
    ground_duel_win_pct: 0,
    aerial_duels_won: 0,
    aerial_duels_lost: 0,
    aerial_win_pct: 0,
    fouls_committed: 0,
    fouls_drawn: 0,
    fpl_total_points: 0,
    fpl_bonus_points: 0,
    fpl_clean_sheets: 0,
  };
}

async function fetchTeamsMap(): Promise<Map<number, PlayerTeamInfo>> {
  const { data, error } = await supabasePublic
    .from('teams')
    .select('id, name, short_name, tla, crest_url')
    .order('name');

  const map = new Map<number, PlayerTeamInfo>();
  if (error || !data) {
    return map;
  }

  data.forEach((row: any, idx: number) => {
    const canonicalTla = resolveCanonicalTla({
      id: row.id,
      name: row.name,
      tla: row.tla,
    });
    const crestStyle = getClubCrestStyle({
      id: row.id,
      name: row.name,
      tla: canonicalTla,
    });
    const color =
      TEAM_COLORS[row.id]?.hex || crestStyle.primary || getTeamColor(row.id, idx);
    const shortDisplay =
      TEAM_COLORS[row.id]?.name ||
      row.short_name?.replace(/\s+(FC|AFC)$/i, '') ||
      row.name.replace(/\s+(FC|AFC)$/i, '');

    map.set(row.id, {
      id: row.id,
      name: row.name,
      short_name: shortDisplay,
      tla: canonicalTla,
      crest_url: null,
      primary_color: color,
    });
  });

  return map;
}

/**
 * Fetches paginated, filtered player list ordered by overall_rating descending.
 */
export async function getPlayersList({
  search = '',
  position = 'ALL',
  teamId = null,
  page = 1,
  limit = 36,
}: GetPlayersListParams = {}): Promise<GetPlayersListResult> {
  const [teamsMap, playersResponse] = await Promise.all([
    fetchTeamsMap(),
    supabaseDev
      .from('players')
      .select(
        'id, fpl_id, web_name, full_name, primary_position, team_id, fpl_cost, is_injured, chance_of_playing_next_round, news, face_seed, shirt_number, is_active, player_ratings(overall_rating, sample_minutes, season)'
      )
      .eq('is_active', true)
      .limit(1000),
  ]);

  if (playersResponse.error) {
    throw new Error(`Failed to fetch players list: ${playersResponse.error.message}`);
  }

  const rawPlayers = playersResponse.data || [];

  // Track which teams actually have active players in dev.players
  const activeTeamIds = new Set<number>();
  for (const p of rawPlayers) {
    if (p.team_id) activeTeamIds.add(p.team_id);
  }

  const activeTeams = Array.from(teamsMap.values())
    .filter((t) => activeTeamIds.has(t.id))
    .sort((a, b) => a.short_name.localeCompare(b.short_name));

  // Normalize & join
  const normalizedQuery = search ? normalizeSearchText(search) : '';
  const posFilter = position && position.toUpperCase() !== 'ALL' ? position.toUpperCase() : null;
  const parsedTeamId =
    teamId !== null && teamId !== undefined && teamId !== '' && teamId !== 'ALL'
      ? Number(teamId)
      : null;

  const items: PlayerListItem[] = [];

  for (const row of rawPlayers as any[]) {
    const pos = (row.primary_position || 'MID') as PlayerPosition;

    if (posFilter && pos !== posFilter) {
      continue;
    }

    if (parsedTeamId && row.team_id !== parsedTeamId) {
      continue;
    }

    if (normalizedQuery) {
      const webNorm = normalizeSearchText(row.web_name || '');
      const fullNorm = normalizeSearchText(row.full_name || '');
      const teamNameNorm = row.team_id
        ? normalizeSearchText(teamsMap.get(row.team_id)?.short_name || '')
        : '';
      if (
        !webNorm.includes(normalizedQuery) &&
        !fullNorm.includes(normalizedQuery) &&
        !teamNameNorm.includes(normalizedQuery)
      ) {
        continue;
      }
    }

    const ratingsArr: any[] = Array.isArray(row.player_ratings)
      ? row.player_ratings
      : row.player_ratings
      ? [row.player_ratings]
      : [];

    const seasonRating =
      ratingsArr.find((r) => r.season === TARGET_SEASON) || ratingsArr[0] || null;

    const overallRating = seasonRating?.overall_rating ?? 50;
    const sampleMinutes = seasonRating?.sample_minutes ?? 0;

    items.push({
      id: row.id,
      fpl_id: row.fpl_id ?? null,
      web_name: row.web_name,
      full_name: row.full_name,
      primary_position: pos,
      team_id: row.team_id ?? null,
      fpl_cost: row.fpl_cost !== null && row.fpl_cost !== undefined ? Number(row.fpl_cost) : null,
      is_injured: Boolean(row.is_injured),
      chance_of_playing_next_round: row.chance_of_playing_next_round ?? null,
      news: row.news ?? null,
      face_seed: row.face_seed || `fpl-${row.fpl_id || row.id}-${row.web_name}`,
      shirt_number: row.shirt_number ?? null,
      overall_rating: Number(overallRating),
      sample_minutes: Number(sampleMinutes),
      team: row.team_id ? teamsMap.get(row.team_id) || null : null,
    });
  }

  // Sort by overall_rating DESC, then sample_minutes DESC, then fpl_cost DESC
  items.sort((a, b) => {
    if (b.overall_rating !== a.overall_rating) {
      return b.overall_rating - a.overall_rating;
    }
    if (b.sample_minutes !== a.sample_minutes) {
      return b.sample_minutes - a.sample_minutes;
    }
    return (b.fpl_cost ?? 0) - (a.fpl_cost ?? 0);
  });

  const total = items.length;
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * safeLimit;
  const paginatedPlayers = items.slice(startIdx, startIdx + safeLimit);

  return {
    players: paginatedPlayers,
    teams: activeTeams,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

/**
 * Fetches full player profile by UUID (`id`) or numeric `fpl_id`.
 */
export async function getPlayerProfile(idOrFplId: string): Promise<PlayerProfileData | null> {
  const cleanId = idOrFplId.trim();
  if (!cleanId) return null;

  const isNumericFplId = /^\d+$/.test(cleanId);

  let query = supabaseDev
    .from('players')
    .select('*, player_ratings(*), player_season_aggregates(*)');

  if (isNumericFplId) {
    query = query.eq('fpl_id', Number(cleanId));
  } else {
    query = query.eq('id', cleanId);
  }

  const [teamsMap, playerRes] = await Promise.all([
    fetchTeamsMap(),
    query.maybeSingle(),
  ]);

  if (playerRes.error || !playerRes.data) {
    return null;
  }

  const row: any = playerRes.data;
  const pos = (row.primary_position || 'MID') as PlayerPosition;

  const ratingsArr: any[] = Array.isArray(row.player_ratings)
    ? row.player_ratings
    : row.player_ratings
    ? [row.player_ratings]
    : [];
  const rawRating =
    ratingsArr.find((r) => r.season === TARGET_SEASON) || ratingsArr[0] || null;

  const baselineRatings = createBaselineRatings(pos);
  const ratings: PlayerRatingsData = rawRating
    ? {
        season: rawRating.season || TARGET_SEASON,
        overall_rating: Number(rawRating.overall_rating ?? 50),
        sample_minutes: Number(rawRating.sample_minutes ?? 0),
        cohort_position: (rawRating.cohort_position || pos) as PlayerPosition,
        stat_speed: Number(rawRating.stat_speed ?? 50),
        stat_strength: Number(rawRating.stat_strength ?? 50),
        stat_jumping: Number(rawRating.stat_jumping ?? 50),
        stat_acceleration: Number(rawRating.stat_acceleration ?? 50),
        stat_stamina: Number(rawRating.stat_stamina ?? 50),
        stat_touch: Number(rawRating.stat_touch ?? 50),
        stat_vision: Number(rawRating.stat_vision ?? 50),
        stat_positioning: Number(rawRating.stat_positioning ?? 50),
        stat_short_passing: Number(rawRating.stat_short_passing ?? 50),
        stat_long_passing: Number(rawRating.stat_long_passing ?? 50),
        stat_shots: Number(rawRating.stat_shots ?? 50),
        stat_long_shots: Number(rawRating.stat_long_shots ?? 50),
        stat_crossing: Number(rawRating.stat_crossing ?? 50),
        stat_heading: Number(rawRating.stat_heading ?? 50),
        stat_tackling: Number(rawRating.stat_tackling ?? 50),
        stat_defensive_positioning: Number(rawRating.stat_defensive_positioning ?? 50),
        radar_shooting: Number(rawRating.radar_shooting ?? 50),
        radar_passing: Number(rawRating.radar_passing ?? 50),
        radar_dribbling: Number(rawRating.radar_dribbling ?? 50),
        radar_defending: Number(rawRating.radar_defending ?? 50),
        radar_physical: Number(rawRating.radar_physical ?? 50),
        radar_aerial: Number(rawRating.radar_aerial ?? 50),
      }
    : baselineRatings;

  const aggArr: any[] = Array.isArray(row.player_season_aggregates)
    ? row.player_season_aggregates
    : row.player_season_aggregates
    ? [row.player_season_aggregates]
    : [];
  const rawAgg = aggArr.find((a) => a.season === TARGET_SEASON) || aggArr[0] || null;

  const baselineAgg = createBaselineAggregates();
  const aggregates: PlayerSeasonAggregatesData = rawAgg
    ? {
        season: rawAgg.season || TARGET_SEASON,
        matches_played: Number(rawAgg.matches_played ?? 0),
        starts: Number(rawAgg.starts ?? 0),
        minutes_played: Number(rawAgg.minutes_played ?? 0),
        goals: Number(rawAgg.goals ?? 0),
        npxg: Number(rawAgg.npxg ?? 0),
        shots_total: Number(rawAgg.shots_total ?? 0),
        shots_on_target: Number(rawAgg.shots_on_target ?? 0),
        shots_outside_box: Number(rawAgg.shots_outside_box ?? 0),
        shots_per_90: Number(rawAgg.shots_per_90 ?? 0),
        shot_accuracy_pct: Number(rawAgg.shot_accuracy_pct ?? 0),
        assists: Number(rawAgg.assists ?? 0),
        xa: Number(rawAgg.xa ?? 0),
        key_passes: Number(rawAgg.key_passes ?? 0),
        key_passes_per_90: Number(rawAgg.key_passes_per_90 ?? 0),
        passes_completed: Number(rawAgg.passes_completed ?? 0),
        passes_attempted: Number(rawAgg.passes_attempted ?? 0),
        pass_completion_pct: Number(rawAgg.pass_completion_pct ?? 0),
        passes_completed_short: Number(rawAgg.passes_completed_short ?? 0),
        pass_short_completion_pct: Number(rawAgg.pass_short_completion_pct ?? 0),
        passes_completed_long: Number(rawAgg.passes_completed_long ?? 0),
        pass_long_completion_pct: Number(rawAgg.pass_long_completion_pct ?? 0),
        crosses_completed: Number(rawAgg.crosses_completed ?? 0),
        cross_completion_pct: Number(rawAgg.cross_completion_pct ?? 0),
        through_balls: Number(rawAgg.through_balls ?? 0),
        touches: Number(rawAgg.touches ?? 0),
        touches_in_box: Number(rawAgg.touches_in_box ?? 0),
        progressive_carries: Number(rawAgg.progressive_carries ?? 0),
        progressive_carries_per_90: Number(rawAgg.progressive_carries_per_90 ?? 0),
        take_ons_won: Number(rawAgg.take_ons_won ?? 0),
        take_on_success_pct: Number(rawAgg.take_on_success_pct ?? 0),
        dispossessed_per_90: Number(rawAgg.dispossessed_per_90 ?? 0),
        miscontrols_per_90: Number(rawAgg.miscontrols_per_90 ?? 0),
        tackles_won: Number(rawAgg.tackles_won ?? 0),
        tackles_per_90: Number(rawAgg.tackles_per_90 ?? 0),
        tackle_success_pct: Number(rawAgg.tackle_success_pct ?? 0),
        interceptions: Number(rawAgg.interceptions ?? 0),
        interceptions_per_90: Number(rawAgg.interceptions_per_90 ?? 0),
        blocks: Number(rawAgg.blocks ?? 0),
        clearances: Number(rawAgg.clearances ?? 0),
        ground_duels_won: Number(rawAgg.ground_duels_won ?? 0),
        ground_duel_win_pct: Number(rawAgg.ground_duel_win_pct ?? 0),
        aerial_duels_won: Number(rawAgg.aerial_duels_won ?? 0),
        aerial_duels_lost: Number(rawAgg.aerial_duels_lost ?? 0),
        aerial_win_pct: Number(rawAgg.aerial_win_pct ?? 0),
        fouls_committed: Number(rawAgg.fouls_committed ?? 0),
        fouls_drawn: Number(rawAgg.fouls_drawn ?? 0),
        fpl_total_points: Number(rawAgg.fpl_total_points ?? 0),
        fpl_bonus_points: Number(rawAgg.fpl_bonus_points ?? 0),
        fpl_clean_sheets: Number(rawAgg.fpl_clean_sheets ?? 0),
      }
    : baselineAgg;

  return {
    id: row.id,
    fpl_id: row.fpl_id ?? null,
    fbref_id: row.fbref_id ?? null,
    web_name: row.web_name,
    first_name: row.first_name ?? null,
    second_name: row.second_name ?? null,
    full_name: row.full_name,
    date_of_birth: row.date_of_birth ?? null,
    nationality: row.nationality ?? null,
    primary_position: pos,
    detailed_position: row.detailed_position ?? null,
    shirt_number: row.shirt_number ?? null,
    fpl_cost: row.fpl_cost !== null && row.fpl_cost !== undefined ? Number(row.fpl_cost) : null,
    is_injured: Boolean(row.is_injured),
    news: row.news ?? null,
    chance_of_playing_next_round: row.chance_of_playing_next_round ?? null,
    face_seed: row.face_seed || `fpl-${row.fpl_id || row.id}-${row.web_name}`,
    team_id: row.team_id ?? null,
    team: row.team_id ? teamsMap.get(row.team_id) || null : null,
    ratings,
    aggregates,
  };
}
