import React, { useState } from 'react';
import GenericTeamCrest from '../analytics/GenericTeamCrest';

export interface V2MatchPrediction {
  id: string;
  match_id: number;
  home_team: string;
  away_team: string;
  matchday: number;
  utc_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  prob_home: number;
  prob_draw: number;
  prob_away: number;
  tactical_delta: number;
  chaos_rating: number;
  home_floor: number;
  home_ceiling: number;
  away_floor: number;
  away_ceiling: number;
}

export interface V1MatchPrediction {
  id: string;
  gameweek?: string;
  home_team: string;
  away_team: string;
  prob_home: number | null;
  prob_draw: number | null;
  prob_away: number | null;
  favored: string | null;
  clash_type?: string | null;
  actual_score?: string | null;
  actual_result?: 'H' | 'D' | 'A' | null;
}

export interface TeamTacticalProfileV2 {
  id: string;
  team: string;
  season: string;
  matches_played: number;
  possession_proxy: number;
  atk_box_aerial: number;
  atk_central_penetration: number;
  atk_transition_speed: number;
  atk_perimeter_chaos: number;
  def_box_aerial_suppression: number;
  def_central_space_denial: number;
  def_rest_defense: number;
  def_perimeter_suppression: number;
  floor: number;
  ceiling: number;
  chaos_index: number;
}

interface V2MatchCardProps {
  match: V2MatchPrediction;
  legacyMatch?: V1MatchPrediction | null;
  homeProfile?: TeamTacticalProfileV2 | null;
  awayProfile?: TeamTacticalProfileV2 | null;
  showComparison?: boolean;
}

function FootballSlot({ active, team }: { active: boolean; team: 'home' | 'away' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3.5 h-3.5 transition-all duration-300 ${
        active
          ? team === 'home'
            ? 'text-emerald-400 fill-emerald-400/25 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)] scale-110'
            : 'text-sky-400 fill-sky-400/25 drop-shadow-[0_0_6px_rgba(56,189,248,0.7)] scale-110'
          : 'text-zinc-700 opacity-25'
      }`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon
        points="12,7 16,10 14.5,15 9.5,15 8,10"
        fill="currentColor"
        fillOpacity={active ? 0.35 : 0.15}
      />
      <line x1="12" y1="7" x2="12" y2="2" />
      <line x1="16" y1="10" x2="20.5" y2="7.5" />
      <line x1="14.5" y1="15" x2="18.2" y2="19.5" />
      <line x1="9.5" y1="15" x2="5.8" y2="19.5" />
      <line x1="8" y1="10" x2="3.5" y2="7.5" />
    </svg>
  );
}

function MomentumMeter({
  netDelta,
  homeTeam,
  awayTeam,
  pillarName,
}: {
  netDelta: number;
  homeTeam: string;
  awayTeam: string;
  pillarName: string;
}) {
  const absDelta = Math.abs(netDelta);
  let intensity = 0;
  if (absDelta < 5) {
    intensity = 0;
  } else if (absDelta < 15) {
    intensity = 1;
  } else if (absDelta < 25) {
    intensity = 2;
  } else if (absDelta < 35) {
    intensity = 3;
  } else if (absDelta < 50) {
    intensity = 4;
  } else {
    intensity = 5;
  }

  const edge: 'home' | 'away' | 'neutral' =
    intensity === 0 || netDelta === 0 ? 'neutral' : netDelta > 0 ? 'home' : 'away';

  // Home slots (5): indices 0 to 4 (left to right, 4 is nearest center divider)
  // Expand outward from divider: (4 - i) < intensity
  const homeSlots = [0, 1, 2, 3, 4].map((i) => {
    const isActive = edge === 'home' && 4 - i < intensity;
    return <FootballSlot key={`home-${i}`} active={isActive} team="home" />;
  });

  // Away slots (5): indices 0 to 4 (left to right, 0 is nearest center divider)
  // Expand outward from divider: i < intensity
  const awaySlots = [0, 1, 2, 3, 4].map((i) => {
    const isActive = edge === 'away' && i < intensity;
    return <FootballSlot key={`away-${i}`} active={isActive} team="away" />;
  });

  const edgeLabel =
    edge === 'neutral'
      ? 'Balanced'
      : `${edge === 'home' ? homeTeam : awayTeam} advantage (${intensity}/5)`;

  return (
    <div
      className="flex items-center"
      role="meter"
      aria-label={`${pillarName}: ${edgeLabel}`}
      aria-valuenow={netDelta}
    >
      {/* 5 Home slots */}
      <div className="flex items-center gap-1.5">{homeSlots}</div>

      {/* Center divider */}
      <div className="h-4 w-[2px] bg-zinc-700 rounded-full mx-1.5" />

      {/* 5 Away slots */}
      <div className="flex items-center gap-1.5">{awaySlots}</div>
    </div>
  );
}

const TEAM_META: Record<string, { id: number; tla: string }> = {
  Arsenal: { id: 57, tla: 'ARS' },
  'Arsenal FC': { id: 57, tla: 'ARS' },
  'Aston Villa': { id: 58, tla: 'AVL' },
  'Aston Villa FC': { id: 58, tla: 'AVL' },
  Bournemouth: { id: 1044, tla: 'BOU' },
  'AFC Bournemouth': { id: 1044, tla: 'BOU' },
  Brentford: { id: 402, tla: 'BRE' },
  'Brentford FC': { id: 402, tla: 'BRE' },
  Brighton: { id: 397, tla: 'BHA' },
  'Brighton & Hove Albion': { id: 397, tla: 'BHA' },
  'Brighton & Hove Albion FC': { id: 397, tla: 'BHA' },
  'Brighton and Hove Albion': { id: 397, tla: 'BHA' },
  'Brighton Hove': { id: 397, tla: 'BHA' },
  Burnley: { id: 328, tla: 'BUR' },
  'Burnley FC': { id: 328, tla: 'BUR' },
  Chelsea: { id: 61, tla: 'CHE' },
  'Chelsea FC': { id: 61, tla: 'CHE' },
  Coventry: { id: 1076, tla: 'COV' },
  'Coventry City': { id: 1076, tla: 'COV' },
  'Crystal Palace': { id: 354, tla: 'CRY' },
  'Crystal Palace FC': { id: 354, tla: 'CRY' },
  Everton: { id: 62, tla: 'EVE' },
  'Everton FC': { id: 62, tla: 'EVE' },
  Fulham: { id: 63, tla: 'FUL' },
  'Fulham FC': { id: 63, tla: 'FUL' },
  Hull: { id: 322, tla: 'HUL' },
  'Hull City': { id: 322, tla: 'HUL' },
  Ipswich: { id: 349, tla: 'IPS' },
  'Ipswich Town': { id: 349, tla: 'IPS' },
  'Ipswich Town FC': { id: 349, tla: 'IPS' },
  Leeds: { id: 341, tla: 'LEE' },
  'Leeds United': { id: 341, tla: 'LEE' },
  'Leeds United FC': { id: 341, tla: 'LEE' },
  Leicester: { id: 338, tla: 'LEI' },
  'Leicester City': { id: 338, tla: 'LEI' },
  Liverpool: { id: 64, tla: 'LIV' },
  'Liverpool FC': { id: 64, tla: 'LIV' },
  'Man City': { id: 65, tla: 'MCI' },
  'Manchester City': { id: 65, tla: 'MCI' },
  'Manchester City FC': { id: 65, tla: 'MCI' },
  'Man United': { id: 66, tla: 'MUN' },
  'Man Utd': { id: 66, tla: 'MUN' },
  'Manchester Utd': { id: 66, tla: 'MUN' },
  'Manchester United': { id: 66, tla: 'MUN' },
  'Manchester United FC': { id: 66, tla: 'MUN' },
  Newcastle: { id: 67, tla: 'NEW' },
  'Newcastle United': { id: 67, tla: 'NEW' },
  'Newcastle United FC': { id: 67, tla: 'NEW' },
  Nottingham: { id: 351, tla: 'NFO' },
  'Nott\'m Forest': { id: 351, tla: 'NFO' },
  'Nottingham Forest': { id: 351, tla: 'NFO' },
  'Nottingham Forest FC': { id: 351, tla: 'NFO' },
  Southampton: { id: 340, tla: 'SOU' },
  'Southampton FC': { id: 340, tla: 'SOU' },
  Sunderland: { id: 71, tla: 'SUN' },
  Tottenham: { id: 73, tla: 'TOT' },
  'Tottenham Hotspur': { id: 73, tla: 'TOT' },
  'Tottenham Hotspur FC': { id: 73, tla: 'TOT' },
  Spurs: { id: 73, tla: 'TOT' },
  'West Ham': { id: 563, tla: 'WHU' },
  'West Ham United': { id: 563, tla: 'WHU' },
  'West Ham United FC': { id: 563, tla: 'WHU' },
  Wolves: { id: 76, tla: 'WOL' },
  Wolverhampton: { id: 76, tla: 'WOL' },
  'Wolverhampton Wanderers': { id: 76, tla: 'WOL' },
};

function getTeamInfo(teamName: string): { id: number; name: string; tla: string } {
  const meta = TEAM_META[teamName] || TEAM_META[teamName.trim()];
  if (meta) {
    return {
      id: meta.id,
      name: teamName,
      tla: meta.tla,
    };
  }
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = (hash << 5) - hash + teamName.charCodeAt(i);
    hash |= 0;
  }
  const clean = teamName.replace(/[^a-zA-Z]/g, '');
  return {
    id: Math.abs(hash) || 999,
    name: teamName,
    tla: clean.slice(0, 3).toUpperCase() || 'FC',
  };
}

function getTacticalAdvantageBadge(
  tacticalDelta: number,
  homeTeam: string,
  awayTeam: string
) {
  const homeInfo = getTeamInfo(homeTeam);
  const awayInfo = getTeamInfo(awayTeam);

  // Strong Home Edge (>= +15): Full circular frame showing the entire Home crest
  if (tacticalDelta >= 15) {
    return {
      label: `Strong ${homeTeam} Edge`,
      textColor: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]',
      icon: (
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center relative border border-emerald-500/50 bg-neutral-950 shadow-[0_0_12px_rgba(16,185,129,0.4)] shrink-0"
          aria-hidden="true"
        >
          <GenericTeamCrest team={homeInfo} size={36} />
        </div>
      ),
    };
  }

  // Slight Home Edge (+5 to +14.9): Half Crest (Left Half Only) with vertical seam
  if (tacticalDelta >= 5) {
    return {
      label: `Slight ${homeTeam} Edge`,
      textColor: 'text-emerald-400',
      icon: (
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex relative border border-emerald-500/35 bg-neutral-950/90 shadow-[0_0_8px_rgba(16,185,129,0.2)] shrink-0"
          aria-hidden="true"
        >
          {/* Left half: Home crest */}
          <div className="w-1/2 h-full overflow-hidden relative">
            <div className="absolute left-0 top-0">
              <GenericTeamCrest team={homeInfo} size={36} />
            </div>
          </div>
          {/* Vertical center seam */}
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-emerald-500/50 z-10 -translate-x-1/2" />
          {/* Right half: muted/empty */}
          <div className="w-1/2 h-full bg-zinc-950/80 relative" />
        </div>
      ),
    };
  }

  // Strong Away Edge (<= -15): Full circular frame showing the entire Away crest
  if (tacticalDelta <= -15) {
    return {
      label: `Strong ${awayTeam} Edge`,
      textColor: 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]',
      icon: (
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center relative border border-sky-500/50 bg-neutral-950 shadow-[0_0_12px_rgba(14,165,233,0.4)] shrink-0"
          aria-hidden="true"
        >
          <GenericTeamCrest team={awayInfo} size={36} />
        </div>
      ),
    };
  }

  // Slight Away Edge (-14.9 to -5): Half Crest (Right Half Only) with vertical seam
  if (tacticalDelta <= -5) {
    return {
      label: `Slight ${awayTeam} Edge`,
      textColor: 'text-sky-400',
      icon: (
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex relative border border-sky-500/35 bg-neutral-950/90 shadow-[0_0_8px_rgba(14,165,233,0.2)] shrink-0"
          aria-hidden="true"
        >
          {/* Left half: muted/empty */}
          <div className="w-1/2 h-full bg-zinc-950/80 relative" />
          {/* Vertical center seam */}
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-sky-500/50 z-10 -translate-x-1/2" />
          {/* Right half: Away crest */}
          <div className="w-1/2 h-full overflow-hidden relative">
            <div className="absolute right-0 top-0">
              <GenericTeamCrest team={awayInfo} size={36} />
            </div>
          </div>
        </div>
      ),
    };
  }

  // Tactical Parity (-4.9 to +4.9): Split Crest (50/50)
  return {
    label: 'Tactical Parity',
    textColor: 'text-zinc-300',
    icon: (
      <div
        className="w-9 h-9 rounded-full overflow-hidden flex relative border border-zinc-700 bg-neutral-950 shadow-[0_0_6px_rgba(113,113,122,0.2)] shrink-0"
        aria-hidden="true"
      >
        {/* Left half: Home crest */}
        <div className="w-1/2 h-full overflow-hidden relative">
          <div className="absolute left-0 top-0">
            <GenericTeamCrest team={homeInfo} size={36} />
          </div>
        </div>
        {/* Center seam */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-zinc-600 z-10 -translate-x-1/2" />
        {/* Right half: Away crest */}
        <div className="w-1/2 h-full overflow-hidden relative">
          <div className="absolute right-0 top-0">
            <GenericTeamCrest team={awayInfo} size={36} />
          </div>
        </div>
      </div>
    ),
  };
}

export default function V2MatchCard({
  match,
  legacyMatch,
  homeProfile,
  awayProfile,
  showComparison = false,
}: V2MatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse Date
  const rawDate = match.utc_date ? new Date(match.utc_date) : null;
  const formattedDate =
    rawDate && !isNaN(rawDate.getTime())
      ? rawDate.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC'
      : 'TBD';

  // Probabilities (0-100%)
  const pHomeV2 = Math.round(match.prob_home * 100);
  const pDrawV2 = Math.round(match.prob_draw * 100);
  const pAwayV2 = Math.round(match.prob_away * 100);

  // Legacy V1 Probabilities
  const pHomeV1 = legacyMatch?.prob_home !== null && legacyMatch?.prob_home !== undefined ? Math.round(Number(legacyMatch.prob_home)) : null;
  const pDrawV1 = legacyMatch?.prob_draw !== null && legacyMatch?.prob_draw !== undefined ? Math.round(Number(legacyMatch.prob_draw)) : null;
  const pAwayV1 = legacyMatch?.prob_away !== null && legacyMatch?.prob_away !== undefined ? Math.round(Number(legacyMatch.prob_away)) : null;

  // Determine V2 Favored outcome
  const maxPV2 = Math.max(match.prob_home, match.prob_draw, match.prob_away);
  const v2FavoredCode =
    maxPV2 === match.prob_home ? 'H' : maxPV2 === match.prob_away ? 'A' : 'D';
  const v2FavoredLabel =
    maxPV2 === match.prob_home
      ? match.home_team
      : maxPV2 === match.prob_away
      ? match.away_team
      : 'Draw';

  // Determine V1 Favored outcome
  const v1FavoredCode =
    legacyMatch?.favored === 'Home'
      ? 'H'
      : legacyMatch?.favored === 'Away'
      ? 'A'
      : legacyMatch?.favored === 'Draw'
      ? 'D'
      : null;

  // Check for Model Divergence
  const hasDivergence =
    v1FavoredCode !== null && v1FavoredCode !== v2FavoredCode;
  const v2HomeShift =
    pHomeV1 !== null ? pHomeV2 - pHomeV1 : null;

  // Accuracy evaluation for finished matches
  const isFinished = match.status === 'FINISHED' && match.home_score !== null && match.away_score !== null;
  let actualResult: 'H' | 'D' | 'A' | null = null;
  let outcomeBadge: { label: string; style: string } | null = null;

  if (isFinished && match.home_score !== null && match.away_score !== null) {
    if (match.home_score > match.away_score) actualResult = 'H';
    else if (match.home_score === match.away_score) actualResult = 'D';
    else actualResult = 'A';

    // Strict Double Chance logic against the active model's primary pick
    const isDirectHit = v2FavoredCode === actualResult;
    const isDoubleChanceHit = !isDirectHit && (
      (v2FavoredCode === 'H' && actualResult === 'D') ||
      (v2FavoredCode === 'A' && actualResult === 'D') ||
      (v2FavoredCode === 'D' && (actualResult === 'H' || actualResult === 'A'))
    );

    if (isDirectHit) {
      outcomeBadge = {
        label: '✓ Top Pick Hit',
        style: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      };
    } else if (isDoubleChanceHit) {
      outcomeBadge = {
        label: '½ Double Chance Hit',
        style: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      };
    } else {
      outcomeBadge = {
        label: '✗ Miss',
        style: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      };
    }
  }

  // 4-Pillar Net Matchup Deltas: (home_atk - away_def) - (away_atk - home_def)
  const netCentral =
    ((homeProfile?.atk_central_penetration ?? 0) - (awayProfile?.def_central_space_denial ?? 0)) -
    ((awayProfile?.atk_central_penetration ?? 0) - (homeProfile?.def_central_space_denial ?? 0));

  const netTransition =
    ((homeProfile?.atk_transition_speed ?? 0) - (awayProfile?.def_rest_defense ?? 0)) -
    ((awayProfile?.atk_transition_speed ?? 0) - (homeProfile?.def_rest_defense ?? 0));

  const netAerial =
    ((homeProfile?.atk_box_aerial ?? 0) - (awayProfile?.def_box_aerial_suppression ?? 0)) -
    ((awayProfile?.atk_box_aerial ?? 0) - (homeProfile?.def_box_aerial_suppression ?? 0));

  const netPerimeter =
    ((homeProfile?.atk_perimeter_chaos ?? 0) - (awayProfile?.def_perimeter_suppression ?? 0)) -
    ((awayProfile?.atk_perimeter_chaos ?? 0) - (homeProfile?.def_perimeter_suppression ?? 0));

  const pillars = [
    {
      name: 'Central Penetration vs Space Denial',
      netDelta: netCentral,
      dotColor: 'bg-emerald-400',
    },
    {
      name: 'Transition Speed vs Rest Defense',
      netDelta: netTransition,
      dotColor: 'bg-sky-400',
    },
    {
      name: 'Aerial / Cross Threat vs Aerial Suppression',
      netDelta: netAerial,
      dotColor: 'bg-amber-400',
    },
    {
      name: 'Distance Chaos vs Distance Suppression',
      netDelta: netPerimeter,
      dotColor: 'bg-rose-400',
    },
  ];

  const tacticalBadge = getTacticalAdvantageBadge(
    match.tactical_delta,
    match.home_team,
    match.away_team
  );

  return (
    <div className="group relative rounded-2xl border border-neutral-800/80 bg-neutral-900/60 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/90 hover:shadow-xl hover:shadow-black/40 overflow-hidden flex flex-col justify-between">
      {/* Top Bar: Kickoff, Badges, Divergence */}
      <div className="p-4 sm:p-5 border-b border-neutral-800/50 bg-neutral-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="font-mono text-[11px] text-neutral-400 tracking-wider">
              {formattedDate}
            </span>
            <span className="text-neutral-700">•</span>
            <span className="font-semibold text-neutral-300">
              GW {match.matchday}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tactical Narrative Advantage Badge (Vertical Stack, Flush) */}
            <div className="flex flex-col items-center justify-center text-center gap-1">
              {tacticalBadge.icon}
              <span
                className={`text-[11px] font-semibold tracking-wide leading-tight max-w-[140px] ${tacticalBadge.textColor}`}
              >
                {tacticalBadge.label}
              </span>
            </div>

            {/* Additional Badges */}
            {(showComparison && hasDivergence || outcomeBadge) && (
              <div className="flex flex-col gap-1.5 self-center">
                {showComparison && hasDivergence && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[11px] font-bold text-purple-300 animate-pulse">
                    <span>⚡ Model Divergence</span>
                  </span>
                )}
                {outcomeBadge && (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${outcomeBadge.style}`}
                  >
                    {outcomeBadge.label}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Card Body: Teams, Scores/Odds */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        {/* Teams and Score Area */}
        <div className="grid grid-cols-12 items-center gap-2 mb-6">
          {/* Home Team */}
          <div className="col-span-5 text-left">
            <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight">
              {match.home_team}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
              <span className="font-mono text-[11px] text-neutral-400">
                Floor {match.home_floor.toFixed(0)} - Ceil {match.home_ceiling.toFixed(0)}
              </span>
            </div>
          </div>

          {/* Center: Score or VS Badge */}
          <div className="col-span-2 text-center flex flex-col items-center justify-center">
            {isFinished ? (
              <div className="inline-flex items-center justify-center rounded-xl bg-neutral-950/80 border border-neutral-800 px-3 py-1 text-lg sm:text-xl font-black text-white tracking-wider shadow-inner">
                <span>{match.home_score}</span>
                <span className="mx-1.5 text-neutral-600">:</span>
                <span>{match.away_score}</span>
              </div>
            ) : (
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800/80 border border-neutral-700/80 text-xs font-bold text-neutral-400 font-mono">
                VS
              </div>
            )}
            <span className="mt-1 text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
              {match.status}
            </span>
          </div>

          {/* Away Team */}
          <div className="col-span-5 text-right">
            <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight">
              {match.away_team}
            </div>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-neutral-400">
              <span className="font-mono text-[11px] text-neutral-400">
                Floor {match.away_floor.toFixed(0)} - Ceil {match.away_ceiling.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Probability Bars (V2 Model) */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5 text-neutral-300">
            <div className="flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{pHomeV2}%</span>
              <span className="text-neutral-400 font-normal hidden sm:inline">Home</span>
            </div>
            <div className="flex items-center gap-1 text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>{pDrawV2}%</span>
              <span className="text-neutral-400 font-normal hidden sm:inline">Draw</span>
            </div>
            <div className="flex items-center gap-1 text-sky-400">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>{pAwayV2}%</span>
              <span className="text-neutral-400 font-normal hidden sm:inline">Away</span>
            </div>
          </div>

          {/* Segmented Bar */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800 flex shadow-inner">
            <div
              style={{ width: `${pHomeV2}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              title={`Home Win: ${pHomeV2}%`}
            />
            <div
              style={{ width: `${pDrawV2}%` }}
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
              title={`Draw: ${pDrawV2}%`}
            />
            <div
              style={{ width: `${pAwayV2}%` }}
              className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-500"
              title={`Away Win: ${pAwayV2}%`}
            />
          </div>
        </div>

        {/* Side-by-Side Comparison Box (When Enabled) */}
        {showComparison && (
          <div className="mb-4 rounded-xl border border-neutral-800/90 bg-neutral-950/60 p-3 sm:p-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 mb-2 border-b border-neutral-800/60 pb-1.5">
              <span>MODEL COMPARISON</span>
              {legacyMatch?.clash_type && (
                <span className="text-neutral-400 font-normal">
                  V1 Clash: {legacyMatch.clash_type}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* V1 Legacy Column */}
              <div className="rounded-lg bg-neutral-900/60 p-2.5 border border-neutral-800/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-neutral-400">V1 (Legacy Model)</span>
                  <span className="text-[11px] font-semibold text-neutral-300">
                    Pick: {legacyMatch?.favored || 'TBD'}
                  </span>
                </div>
                {pHomeV1 !== null ? (
                  <div className="flex items-center justify-between font-mono text-[11px] text-neutral-400">
                    <span>H: {pHomeV1}%</span>
                    <span>D: {pDrawV1}%</span>
                    <span>A: {pAwayV1}%</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-400 italic">No legacy data</div>
                )}
              </div>

              {/* V2 Tactical Column */}
              <div className="rounded-lg bg-emerald-950/20 p-2.5 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-emerald-400">V2 (Tactical Engine)</span>
                  <span className="text-[11px] font-semibold text-emerald-300">
                    Pick: {v2FavoredLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] text-neutral-300">
                  <span className={v2HomeShift && Math.abs(v2HomeShift) >= 8 ? 'text-emerald-300 font-bold' : ''}>
                    H: {pHomeV2}%
                  </span>
                  <span>D: {pDrawV2}%</span>
                  <span>A: {pAwayV2}%</span>
                </div>
              </div>
            </div>

            {/* Shift Annotation */}
            {v2HomeShift !== null && Math.abs(v2HomeShift) >= 5 && (
              <div className="mt-2 text-[11px] text-neutral-400 flex items-center justify-between">
                <span>V2 Home Shift:</span>
                <span className={`font-mono font-bold ${v2HomeShift > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {v2HomeShift > 0 ? `+${v2HomeShift}%` : `${v2HomeShift}%`} vs V1
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer Toggle Inspector Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 inline-flex w-full items-center justify-between rounded-xl bg-neutral-800/40 hover:bg-neutral-800/80 px-3.5 py-2 text-xs font-semibold text-neutral-300 transition-colors border border-neutral-800"
        >
          <span className="flex items-center gap-1.5">
            <span>📊</span>
            <span>{isExpanded ? 'Hide Tactical Inspector' : 'Inspect 4-Pillar Clash & Tendencies'}</span>
          </span>
          <span className="text-neutral-400 transition-transform duration-200">
            {isExpanded ? '▲' : '▼'}
          </span>
        </button>
      </div>

      {/* Expandable Tactical Breakdown Inspector */}
      {isExpanded && (
        <div className="border-t border-neutral-800 bg-neutral-950/80 p-5 sm:p-6 transition-all duration-300">
          {/* Header & Matchup Legend */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                4-Pillar Tactical Matchup Breakdown
              </h4>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {match.home_team}
              </span>
              <span className="text-neutral-600 font-mono text-[10px]">vs</span>
              <span className="text-sky-400 font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                {match.away_team}
              </span>
            </div>
          </div>

          {/* Obfuscated 5-Football Momentum Tug-of-War Rows */}
          <div className="space-y-2.5 text-xs">
            {pillars.map((pillar) => (
              <div
                key={pillar.name}
                className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
              >
                <span className="font-semibold text-neutral-200 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${pillar.dotColor}`} />
                  {pillar.name}
                </span>

                <div className="flex items-center justify-end">
                  <MomentumMeter
                    netDelta={pillar.netDelta}
                    homeTeam={match.home_team}
                    awayTeam={match.away_team}
                    pillarName={pillar.name}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer note & Chaos dynamic */}
          <div className="mt-3.5 flex items-center justify-between border-t border-neutral-800/60 pt-3 text-[11px] text-neutral-400">
            <span className="text-neutral-500">Tactical Phase Momentum Tug-of-War</span>
            <div className="font-mono text-neutral-400">
              Chaos Rating: <span className="text-neutral-200 font-semibold">{match.chaos_rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
