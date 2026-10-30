import React, { useState } from 'react';

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

  // 4-Pillar Clash Calculations
  const aerialHome = homeProfile?.atk_box_aerial ?? 0;
  const aerialAwaySupp = awayProfile?.def_box_aerial_suppression ?? 0;
  const deltaAerialH = aerialHome - aerialAwaySupp;

  const centralHome = homeProfile?.atk_central_penetration ?? 0;
  const centralAwaySupp = awayProfile?.def_central_space_denial ?? 0;
  const deltaCentralH = centralHome - centralAwaySupp;

  const transitionHome = homeProfile?.atk_transition_speed ?? 0;
  const transitionAwaySupp = awayProfile?.def_rest_defense ?? 0;
  const deltaTransitionH = transitionHome - transitionAwaySupp;

  const perimeterHome = homeProfile?.atk_perimeter_chaos ?? 0;
  const perimeterAwaySupp = awayProfile?.def_perimeter_suppression ?? 0;
  const deltaPerimeterH = perimeterHome - perimeterAwaySupp;

  const aerialAway = awayProfile?.atk_box_aerial ?? 0;
  const aerialHomeSupp = homeProfile?.def_box_aerial_suppression ?? 0;
  const deltaAerialA = aerialAway - aerialHomeSupp;

  const centralAway = awayProfile?.atk_central_penetration ?? 0;
  const centralHomeSupp = homeProfile?.def_central_space_denial ?? 0;
  const deltaCentralA = centralAway - centralHomeSupp;

  const transitionAway = awayProfile?.atk_transition_speed ?? 0;
  const transitionHomeSupp = homeProfile?.def_rest_defense ?? 0;
  const deltaTransitionA = transitionAway - transitionHomeSupp;

  const perimeterAway = awayProfile?.atk_perimeter_chaos ?? 0;
  const perimeterHomeSupp = homeProfile?.def_perimeter_suppression ?? 0;
  const deltaPerimeterA = perimeterAway - perimeterHomeSupp;

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
            {/* Tactical Delta Badge */}
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                match.tactical_delta > 5
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : match.tactical_delta < -5
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                  : 'bg-neutral-800/80 text-neutral-300 border-neutral-700'
              }`}
            >
              {match.tactical_delta > 0 ? `+${match.tactical_delta}` : match.tactical_delta} Tactical Edge
            </span>

            {/* Model Divergence Highlight */}
            {showComparison && hasDivergence && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[11px] font-bold text-purple-300 animate-pulse">
                <span>⚡ Model Divergence</span>
              </span>
            )}

            {/* Hit/Miss Outcome Badge */}
            {outcomeBadge && (
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${outcomeBadge.style}`}
              >
                {outcomeBadge.label}
              </span>
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
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              4-Pillar Tactical Matchup Breakdown
            </h4>
            <div className="text-[11px] font-mono text-neutral-400">
              Chaos Rating: <span className="text-neutral-200 font-semibold">{match.chaos_rating.toFixed(1)}</span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Pillar 1: Central Penetration vs Space Denial */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Central Penetration vs Space Denial
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    deltaCentralH >= 0 ? 'text-emerald-400' : 'text-sky-400'
                  }`}
                >
                  Delta: {deltaCentralH >= 0 ? `+${deltaCentralH.toFixed(1)}` : deltaCentralH.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px] text-neutral-400">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.home_team} Atk:</span>
                    <span className="font-mono text-neutral-200">{centralHome.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.away_team} Def:</span>
                    <span className="font-mono text-neutral-200">{centralAwaySupp.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.away_team} Atk:</span>
                    <span className="font-mono text-neutral-200">{centralAway.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.home_team} Def:</span>
                    <span className="font-mono text-neutral-200">{centralHomeSupp.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 2: Transition Speed vs Rest Defense */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  Transition Speed vs Rest Defense
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    deltaTransitionH >= 0 ? 'text-emerald-400' : 'text-sky-400'
                  }`}
                >
                  Delta: {deltaTransitionH >= 0 ? `+${deltaTransitionH.toFixed(1)}` : deltaTransitionH.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px] text-neutral-400">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.home_team} Break:</span>
                    <span className="font-mono text-neutral-200">{transitionHome.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.away_team} Rest Def:</span>
                    <span className="font-mono text-neutral-200">{transitionAwaySupp.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.away_team} Break:</span>
                    <span className="font-mono text-neutral-200">{transitionAway.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.home_team} Rest Def:</span>
                    <span className="font-mono text-neutral-200">{transitionHomeSupp.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 3: Aerial & Set Piece Threat vs Aerial Suppression */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Aerial / Cross Threat vs Aerial Suppression
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    deltaAerialH >= 0 ? 'text-emerald-400' : 'text-sky-400'
                  }`}
                >
                  Delta: {deltaAerialH >= 0 ? `+${deltaAerialH.toFixed(1)}` : deltaAerialH.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px] text-neutral-400">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.home_team} Aerial:</span>
                    <span className="font-mono text-neutral-200">{aerialHome.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.away_team} Aerial Def:</span>
                    <span className="font-mono text-neutral-200">{aerialAwaySupp.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.away_team} Aerial:</span>
                    <span className="font-mono text-neutral-200">{aerialAway.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.home_team} Aerial Def:</span>
                    <span className="font-mono text-neutral-200">{aerialHomeSupp.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 4: Perimeter Chaos vs Perimeter Suppression */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Distance Chaos vs Distance Suppression
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    deltaPerimeterH >= 0 ? 'text-emerald-400' : 'text-sky-400'
                  }`}
                >
                  Delta: {deltaPerimeterH >= 0 ? `+${deltaPerimeterH.toFixed(1)}` : deltaPerimeterH.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px] text-neutral-400">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.home_team} Chaos:</span>
                    <span className="font-mono text-neutral-200">{perimeterHome.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.away_team} Perimeter Def:</span>
                    <span className="font-mono text-neutral-200">{perimeterAwaySupp.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>{match.away_team} Chaos:</span>
                    <span className="font-mono text-neutral-200">{perimeterAway.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{match.home_team} Perimeter Def:</span>
                    <span className="font-mono text-neutral-200">{perimeterHomeSupp.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
