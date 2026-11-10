'use client';

import React, { useId } from 'react';
import { PlayerSeasonAggregatesData } from '@/lib/queries/players';

export interface SeasonTelemetryCardProps {
  aggregates: PlayerSeasonAggregatesData;
}

export const SeasonTelemetryCard: React.FC<SeasonTelemetryCardProps> = ({ aggregates }) => {
  const sectionId = useId();
  const nineties = aggregates.minutes_played > 0 ? aggregates.minutes_played / 90 : 0;
  const xAPer90 = nineties > 0 ? aggregates.xa / nineties : 0;

  // Determine Passing Risk / Creativity Profile
  const getPassingRiskProfile = () => {
    const kp90 = aggregates.key_passes_per_90;
    const passPct = aggregates.pass_completion_pct;

    if (kp90 >= 2.0 || xAPer90 >= 0.22) {
      return {
        badge: 'High-Risk Progressive Playmaker',
        badgeClasses: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
        explanation:
          'High final-third creative volume (key passes & line-breaking balls) naturally lowers raw completion % while maximizing xA threat.',
      };
    }
    if (kp90 >= 1.2 || xAPer90 >= 0.14) {
      return {
        badge: 'Balanced Creative Distributor',
        badgeClasses: 'border-cyan-500/35 bg-cyan-950/35 text-cyan-300',
        explanation:
          'Combines progressive chance creation with measured ball retention across midfield and attacking zones.',
      };
    }
    if (passPct >= 86) {
      return {
        badge: 'High-Retention Metronome',
        badgeClasses: 'border-emerald-500/35 bg-emerald-950/35 text-emerald-300',
        explanation:
          'Prioritizes secure possession recycling and build-up stability with minimal turnover risk.',
      };
    }
    return {
      badge: 'Direct / Vertical Distributor',
      badgeClasses: 'border-zinc-700 bg-zinc-800/80 text-zinc-300',
      explanation:
        'Standard distribution profile mixed between direct progression and positional possession.',
    };
  };

  const passingProfile = getPassingRiskProfile();
  const goalDelta = aggregates.goals - aggregates.npxg;
  const assistDelta = aggregates.assists - aggregates.xa;

  return (
    <section
      aria-labelledby={`${sectionId}-heading`}
      className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 sm:p-6 backdrop-blur-md shadow-lg"
    >
      <div className="mb-5 flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
        <div>
          <h2
            id={`${sectionId}-heading`}
            className="text-base font-bold tracking-tight text-zinc-100"
          >
            Season Telemetry & Per-90 Output
          </h2>
          <p className="text-xs text-zinc-400">
            Underlying volume, expected threat, and distribution context ({aggregates.season})
          </p>
        </div>
        <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-0.5 font-mono text-[11px] font-bold text-zinc-300">
          {nineties.toFixed(1)} 90s
        </span>
      </div>

      {/* 1. Playing Time & Availability */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3 text-center">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Matches
          </div>
          <div className="mt-1 font-mono text-xl font-black text-white">
            {aggregates.matches_played}
          </div>
          <div className="font-mono text-[10px] text-zinc-500">Appearances</div>
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3 text-center">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Starts
          </div>
          <div className="mt-1 font-mono text-xl font-black text-white">{aggregates.starts}</div>
          <div className="font-mono text-[10px] text-zinc-500">
            {aggregates.matches_played > 0
              ? `${Math.round((aggregates.starts / aggregates.matches_played) * 100)}% XI Rate`
              : '0% XI Rate'}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3 text-center">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Minutes
          </div>
          <div className="mt-1 font-mono text-xl font-black text-emerald-400">
            {aggregates.minutes_played}
          </div>
          <div className="font-mono text-[10px] text-zinc-500">
            {aggregates.matches_played > 0
              ? `${Math.round(aggregates.minutes_played / aggregates.matches_played)}m / app`
              : '0m / app'}
          </div>
        </div>
      </div>

      {/* 2. Attacking Output: Goals/npxG & Assists/xA */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span>Goals vs npxG</span>
            <span
              className={`font-mono text-[11px] font-bold ${
                goalDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {goalDelta >= 0 ? `+${goalDelta.toFixed(2)}` : goalDelta.toFixed(2)} diff
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="font-mono text-2xl font-black text-white">{aggregates.goals}</span>
              <span className="ml-1.5 text-xs text-zinc-500">Goals</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-bold text-cyan-400">
                {aggregates.npxg.toFixed(2)}
              </span>
              <span className="ml-1 text-xs text-zinc-500">npxG</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-zinc-800/60 pt-2 font-mono text-[11px] text-zinc-400">
            <span>Shots: {aggregates.shots_total} ({aggregates.shots_per_90.toFixed(2)}/90)</span>
            <span>SoT: {aggregates.shot_accuracy_pct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span>Assists vs xA</span>
            <span
              className={`font-mono text-[11px] font-bold ${
                assistDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {assistDelta >= 0 ? `+${assistDelta.toFixed(2)}` : assistDelta.toFixed(2)} diff
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="font-mono text-2xl font-black text-white">
                {aggregates.assists}
              </span>
              <span className="ml-1.5 text-xs text-zinc-500">Assists</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-bold text-cyan-400">
                {aggregates.xa.toFixed(2)}
              </span>
              <span className="ml-1 text-xs text-zinc-500">xA</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-zinc-800/60 pt-2 font-mono text-[11px] text-zinc-400">
            <span>Key Passes: {aggregates.key_passes}</span>
            <span>Box Touches: {aggregates.touches_in_box}</span>
          </div>
        </div>
      </div>

      {/* 3. Passing Risk Indicator & Distribution Context */}
      <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Passing Risk & Creative Context
          </span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${passingProfile.badgeClasses}`}
          >
            {passingProfile.badge}
          </span>
        </div>

        <p className="mb-3.5 text-xs leading-relaxed text-zinc-400">
          {passingProfile.explanation}
        </p>

        <div className="grid grid-cols-3 gap-2.5 border-t border-zinc-800/80 pt-3">
          <div>
            <div className="text-[10px] font-semibold uppercase text-zinc-500">
              Pass Completion
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-zinc-100">
              {aggregates.pass_completion_pct.toFixed(1)}%
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              {aggregates.passes_completed}/{aggregates.passes_attempted}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase text-zinc-500">
              Key Passes / 90
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-amber-300">
              {aggregates.key_passes_per_90.toFixed(2)}
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              {aggregates.key_passes} total KP
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase text-zinc-500">
              Creative xA / 90
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-cyan-300">
              {xAPer90.toFixed(2)}
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              {aggregates.passes_completed_long} long passes
            </div>
          </div>
        </div>
      </div>

      {/* 4. Duels, Progression & Defensive Activity */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
          <div className="text-[10px] font-semibold uppercase text-zinc-500">Ground Duels</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-zinc-200">
            {aggregates.ground_duel_win_pct.toFixed(1)}%
          </div>
          <div className="font-mono text-[10px] text-zinc-500">
            {aggregates.ground_duels_won} won
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
          <div className="text-[10px] font-semibold uppercase text-zinc-500">Prog. Carries</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-zinc-200">
            {aggregates.progressive_carries_per_90.toFixed(2)}/90
          </div>
          <div className="font-mono text-[10px] text-zinc-500">
            {aggregates.progressive_carries} total
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
          <div className="text-[10px] font-semibold uppercase text-zinc-500">Tackles Won</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-zinc-200">
            {aggregates.tackles_per_90.toFixed(2)}/90
          </div>
          <div className="font-mono text-[10px] text-zinc-500">
            {aggregates.tackle_success_pct.toFixed(0)}% win rate
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
          <div className="text-[10px] font-semibold uppercase text-zinc-500">Def. Actions</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-zinc-200">
            {aggregates.interceptions + aggregates.clearances + aggregates.blocks}
          </div>
          <div className="font-mono text-[10px] text-zinc-500">
            {aggregates.interceptions} int • {aggregates.clearances} clr
          </div>
        </div>
      </div>
    </section>
  );
};

export default SeasonTelemetryCard;
