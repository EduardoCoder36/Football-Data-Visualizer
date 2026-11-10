'use client';

import React, { useState, useMemo, useId } from 'react';
import Link from 'next/link';
import {
  PlayerListItem,
  PlayerTeamInfo,
  PlayerPosition,
} from '@/lib/queries/players';
import GenericTeamCrest, { getClubCrestStyle } from '@/components/analytics/GenericTeamCrest';
import { RegenAvatar } from './RegenAvatar';
import { getFmBadgeClasses } from './AttributeGrid';

export interface PlayerDirectoryClientProps {
  initialPlayers: PlayerListItem[];
  teams: PlayerTeamInfo[];
  initialSearch?: string;
  initialPosition?: string;
  initialTeamId?: number | null;
}

const POSITION_TABS: Array<{ id: 'ALL' | PlayerPosition; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'GKP', label: 'GKP' },
  { id: 'DEF', label: 'DEF' },
  { id: 'MID', label: 'MID' },
  { id: 'FWD', label: 'FWD' },
];

const POSITION_BADGE_CLASSES: Record<PlayerPosition, string> = {
  GKP: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  DEF: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  MID: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  FWD: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

const PAGE_SIZE = 36;

function normalizeText(str: string): string {
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

export const PlayerDirectoryClient: React.FC<PlayerDirectoryClientProps> = ({
  initialPlayers,
  teams,
  initialSearch = '',
  initialPosition = 'ALL',
  initialTeamId = null,
}) => {
  const searchInputId = useId();
  const teamSelectId = useId();

  const [search, setSearch] = useState(initialSearch);
  const [selectedPosition, setSelectedPosition] = useState<string>(
    initialPosition.toUpperCase() || 'ALL'
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    initialTeamId ? String(initialTeamId) : 'ALL'
  );
  const [page, setPage] = useState(1);

  const activeSelectedTeam = useMemo(() => {
    if (selectedTeamId === 'ALL') return null;
    return teams.find((t) => String(t.id) === selectedTeamId) || null;
  }, [teams, selectedTeamId]);

  const filteredPlayers = useMemo(() => {
    const query = normalizeText(search);
    const pos = selectedPosition !== 'ALL' ? selectedPosition : null;
    const tId = selectedTeamId !== 'ALL' ? Number(selectedTeamId) : null;

    return initialPlayers.filter((player) => {
      if (pos && player.primary_position !== pos) {
        return false;
      }
      if (tId && player.team_id !== tId) {
        return false;
      }
      if (query) {
        const webNorm = normalizeText(player.web_name || '');
        const fullNorm = normalizeText(player.full_name || '');
        const teamNorm = normalizeText(player.team?.short_name || player.team?.name || '');
        const tlaNorm = normalizeText(player.team?.tla || '');
        if (
          !webNorm.includes(query) &&
          !fullNorm.includes(query) &&
          !teamNorm.includes(query) &&
          !tlaNorm.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [initialPlayers, search, selectedPosition, selectedTeamId]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedPlayers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredPlayers.slice(start, start + PAGE_SIZE);
  }, [filteredPlayers, safePage]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedPosition('ALL');
    setSelectedTeamId('ALL');
    setPage(1);
  };

  return (
    <div>
      {/* Search & Filter Controls inside semantic <search> landmark */}
      <search className="mb-8 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 sm:p-5 backdrop-blur-md shadow-lg">
        <form
          action="/players"
          method="GET"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        >
          {/* Text Search Input */}
          <div className="flex-1">
            <label
              htmlFor={searchInputId}
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400"
            >
              Search Player or Club
            </label>
            <div className="relative">
              <input
                id={searchInputId}
                name="search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Haaland, Saka, Ødegaard, Arsenal..."
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Positional Cohort Tabs */}
          <div>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Position Cohort
            </span>
            <div
              role="group"
              aria-label="Filter by player position"
              className="inline-flex flex-wrap rounded-xl border border-zinc-800 bg-zinc-950/90 p-1"
            >
              {POSITION_TABS.map((tab) => {
                const isActive = selectedPosition === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedPosition(tab.id);
                      setPage(1);
                    }}
                    aria-pressed={isActive}
                    className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-neutral-950 shadow-sm shadow-emerald-500/30'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Club Filter Select with Active Custom Club Crest */}
          <div className="sm:w-64">
            <label
              htmlFor={teamSelectId}
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400"
            >
              Premier League Club
            </label>
            <div className="flex items-center gap-2">
              {activeSelectedTeam && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-950/90 p-1">
                  <GenericTeamCrest
                    team={{
                      id: activeSelectedTeam.id,
                      name: activeSelectedTeam.name,
                      tla: activeSelectedTeam.tla,
                    }}
                    size={28}
                  />
                </div>
              )}
              <select
                id={teamSelectId}
                name="teamId"
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="ALL">All Clubs ({teams.length})</option>
                {teams.map((team) => (
                  <option key={team.id} value={String(team.id)}>
                    {team.short_name} ({team.tla})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        {/* Scrollable Custom Club Badge Strip */}
        <div className="mt-4 border-t border-zinc-800/80 pt-3.5">
          <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-zinc-400">
              Filter by Club Crest
            </span>
            {activeSelectedTeam && (
              <span className="font-semibold text-emerald-400">
                Active: {activeSelectedTeam.short_name} ({activeSelectedTeam.tla})
              </span>
            )}
          </div>
          <div
            role="group"
            aria-label="Filter players by club crest"
            className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedTeamId('ALL');
                setPage(1);
              }}
              aria-pressed={selectedTeamId === 'ALL'}
              className={`flex shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-1.5 transition-all ${
                selectedTeamId === 'ALL'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-sm'
                  : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="flex h-7 items-center font-mono text-xs font-black">ALL</span>
              <span className="font-mono text-[10px] font-bold">CLUBS</span>
            </button>

            {teams.map((team) => {
              const isSelected = selectedTeamId === String(team.id);
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => {
                    setSelectedTeamId(isSelected ? 'ALL' : String(team.id));
                    setPage(1);
                  }}
                  aria-pressed={isSelected}
                  title={`${team.name} (${team.tla})`}
                  className={`flex shrink-0 flex-col items-center justify-center rounded-xl border px-2.5 py-1.5 transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-zinc-800/90 ring-1 ring-emerald-500/50 scale-105 shadow-md'
                      : 'border-zinc-800/70 bg-zinc-950/50 opacity-75 hover:opacity-100 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <GenericTeamCrest
                    team={{ id: team.id, name: team.name, tla: team.tla }}
                    size={28}
                  />
                  <span className="mt-1 font-mono text-[10px] font-bold tracking-wider text-zinc-200">
                    {team.tla}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Summary Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3 text-xs text-zinc-400">
          <div>
            Showing{' '}
            <span className="font-mono font-bold text-white">{paginatedPlayers.length}</span> of{' '}
            <span className="font-mono font-bold text-emerald-400">
              {filteredPlayers.length}
            </span>{' '}
            players • Sorted by <span className="font-semibold text-zinc-200">Overall Rating</span>
          </div>

          {(search || selectedPosition !== 'ALL' || selectedTeamId !== 'ALL') && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
            >
              Reset all filters
            </button>
          )}
        </div>
      </search>

      {/* Player Cards Grid */}
      {paginatedPlayers.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-12 text-center">
          <p className="text-base font-semibold text-zinc-300">
            No players matched your current search or filter criteria.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Try clearing the search query or switching positional cohorts.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="mt-4 inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-neutral-950 hover:bg-emerald-400 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {paginatedPlayers.map((player) => {
            const posClasses =
              POSITION_BADGE_CLASSES[player.primary_position] || POSITION_BADGE_CLASSES.MID;
            const ovrClasses = getFmBadgeClasses(player.overall_rating);
            const crestStyle = player.team ? getClubCrestStyle(player.team) : null;
            const teamColor = crestStyle?.primary || player.team?.primary_color || '#10b981';

            return (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-zinc-900/90 hover:shadow-xl hover:shadow-emerald-950/20"
              >
                {/* Top Row: Avatar + Name + Custom Club Crest + Overall Pill */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <RegenAvatar
                      faceSeed={player.face_seed}
                      size={56}
                      alt={`${player.web_name} avatar`}
                      team={player.team}
                      teamColor={teamColor}
                      showClubBadge
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {player.web_name}
                      </h2>
                      <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                        {player.team && (
                          <GenericTeamCrest
                            team={{
                              id: player.team.id,
                              name: player.team.name,
                              tla: player.team.tla,
                            }}
                            size={16}
                          />
                        )}
                        <p className="truncate text-xs text-zinc-400">
                          {player.team?.short_name || 'Premier League'}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${posClasses}`}
                        >
                          {player.primary_position}
                        </span>
                        {player.is_injured && (
                          <span
                            title={player.news || 'Injured / Doubtful'}
                            className="inline-flex items-center rounded border border-rose-500/40 bg-rose-950/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-300"
                          >
                            INJ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overall Rating Pill */}
                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`inline-flex h-10 w-11 items-center justify-center rounded-xl font-mono text-base tabular-nums shadow-sm ${ovrClasses}`}
                    >
                      {player.overall_rating}
                    </span>
                    <span className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                      OVR
                    </span>
                  </div>
                </div>

                {/* Bottom Footer Bar: FPL Price & Sample Minutes */}
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-200">
                      {player.fpl_cost !== null ? `£${player.fpl_cost.toFixed(1)}m` : '—'}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {player.sample_minutes} mins
                    </span>
                  </div>

                  <span className="font-mono text-[11px] font-bold text-emerald-400 opacity-80 group-hover:translate-x-0.5 group-hover:opacity-100 transition-all">
                    Scout →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <nav
          aria-label="Player directory pagination"
          className="mt-8 flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 text-xs"
        >
          <span className="font-mono text-zinc-400">
            Page <strong className="text-white">{safePage}</strong> of{' '}
            <strong className="text-white">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default PlayerDirectoryClient;
