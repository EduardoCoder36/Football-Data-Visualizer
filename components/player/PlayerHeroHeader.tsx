'use client';

import React from 'react';
import { PlayerProfileData, PlayerPosition } from '@/lib/queries/players';
import GenericTeamCrest, { getClubCrestStyle } from '@/components/analytics/GenericTeamCrest';
import { getFmOvrRingClasses, getFmOvrTierLabel } from '@/lib/utils/fmRating';
import { RegenAvatar } from './RegenAvatar';

export interface PlayerHeroHeaderProps {
  player: PlayerProfileData;
}

const POSITION_STYLES: Record<PlayerPosition, { label: string; classes: string }> = {
  GKP: {
    label: 'Goalkeeper (GKP)',
    classes: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  },
  DEF: {
    label: 'Defender (DEF)',
    classes: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  },
  MID: {
    label: 'Midfielder (MID)',
    classes: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  },
  FWD: {
    label: 'Forward (FWD)',
    classes: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
  },
};

export const PlayerHeroHeader: React.FC<PlayerHeroHeaderProps> = ({ player }) => {
  const posMeta = POSITION_STYLES[player.primary_position] || POSITION_STYLES.MID;
  const ovr = player.ratings.overall_rating;
  const crestStyle = player.team ? getClubCrestStyle(player.team) : null;
  const teamColor = crestStyle?.primary || player.team?.primary_color || '#10b981';

  const ovrRingClasses = getFmOvrRingClasses(ovr);

  const isDoubtful =
    player.is_injured &&
    player.chance_of_playing_next_round !== null &&
    player.chance_of_playing_next_round > 0 &&
    player.chance_of_playing_next_round < 100;

  return (
    <header className="relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/75 p-6 sm:p-8 backdrop-blur-md shadow-xl">
      {/* Subtle club-colored ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: teamColor }}
      />

      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        {/* Left: RegenAvatar + Player Identity + Custom Club Crest & Position */}
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <RegenAvatar
            faceSeed={player.face_seed || player.web_name || 'player'}
            fallbackName={player.web_name}
            size={104}
            alt={`${player.full_name} pixel regen avatar`}
            team={player.team}
            teamColor={teamColor}
            showClubBadge
            priority
          />

          <div>
            {/* Position & Shirt Number Badges */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold tracking-wide ${posMeta.classes}`}
              >
                {posMeta.label}
              </span>

              {player.shirt_number && (
                <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 font-mono text-xs font-bold text-zinc-300">
                  #{player.shirt_number}
                </span>
              )}

              <span className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                Season {player.ratings.season}
              </span>
            </div>

            {/* Player Web Name & Full Name */}
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
              {player.web_name}
            </h1>
            {player.full_name && player.full_name !== player.web_name && (
              <p className="mt-0.5 text-sm font-medium text-zinc-400">{player.full_name}</p>
            )}

            {/* Club Name & Custom SVG Club Badge */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div
                className="inline-flex items-center gap-2.5 rounded-xl border bg-zinc-950/80 px-3 py-1.5 shadow-sm"
                style={{
                  borderColor: crestStyle ? `${crestStyle.trim}44` : 'rgba(39,39,42,0.9)',
                }}
              >
                {player.team ? (
                  <GenericTeamCrest
                    team={{
                      id: player.team.id,
                      name: player.team.name,
                      tla: player.team.tla,
                    }}
                    size={26}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: teamColor }}
                  />
                )}
                <span className="text-sm font-semibold text-zinc-100">
                  {player.team?.name || 'Premier League Club'}
                </span>
                {player.team?.tla && (
                  <span className="font-mono text-xs font-bold text-zinc-400">
                    ({player.team.tla})
                  </span>
                )}
              </div>

              {player.nationality && (
                <span className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1 text-xs font-medium text-zinc-400">
                  {player.nationality}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right: Overall Rating Circle Badge, FPL Cost & Injury/Availability Indicator */}
        <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800/80 pt-5 lg:border-t-0 lg:pt-0">
          {/* Availability / Injury Indicator */}
          <div className="flex flex-col items-start lg:items-end">
            {!player.is_injured ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-3.5 py-2 text-xs font-bold text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>Available for Selection</span>
              </div>
            ) : (
              <div
                className={`max-w-xs rounded-xl border px-3.5 py-2 text-xs ${
                  isDoubtful
                    ? 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                    : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isDoubtful ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                  />
                  <span>
                    {isDoubtful
                      ? `Doubtful (${player.chance_of_playing_next_round}% Chance)`
                      : 'Injured / Unavailable'}
                  </span>
                </div>
                {player.news && (
                  <p className="mt-1 line-clamp-2 text-[11px] opacity-90">{player.news}</p>
                )}
              </div>
            )}

            <span className="mt-1.5 font-mono text-[11px] text-zinc-500">
              Sample: {player.ratings.sample_minutes} mins ({player.aggregates.matches_played}{' '}
              apps)
            </span>
          </div>

          {/* FPL Cost Card */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              FPL Valuation
            </span>
            <span className="mt-0.5 font-mono text-lg font-black text-white">
              {player.fpl_cost !== null ? `£${player.fpl_cost.toFixed(1)}m` : 'N/A'}
            </span>
            {player.aggregates.fpl_total_points > 0 && (
              <span className="font-mono text-[10px] font-semibold text-emerald-400">
                {player.aggregates.fpl_total_points} pts
              </span>
            )}
          </div>

          {/* Overall Rating Circle Badge */}
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-2.5">
            <div className="text-right">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                FM Overall
              </div>
              <div className="text-xs font-medium text-zinc-500">
                {getFmOvrTierLabel(ovr)}
              </div>
            </div>
            <div
              className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 shadow-lg ${ovrRingClasses}`}
            >
              <span className="font-mono text-2xl font-black leading-none">{ovr}</span>
              <span className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-widest opacity-75">
                OVR
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default PlayerHeroHeader;
