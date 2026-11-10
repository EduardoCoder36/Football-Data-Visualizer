import React from 'react';
import Link from 'next/link';
import { getPlayersList, PlayerListItem } from '@/lib/queries/players';
import { RegenAvatar } from '@/components/player/RegenAvatar';
import { getFmBadgeClasses } from '@/components/player/AttributeGrid';
import GenericTeamCrest from '@/components/analytics/GenericTeamCrest';

export const dynamic = 'force-dynamic';

const FALLBACK_SPOTLIGHT: PlayerListItem[] = [
  {
    id: 'bcec1fd4-f461-4f04-98b0-7a0dee18a78a',
    fpl_id: 229,
    web_name: 'Tarkowski',
    full_name: 'James Tarkowski',
    primary_position: 'DEF',
    team_id: 62,
    fpl_cost: 6.2,
    is_injured: false,
    chance_of_playing_next_round: 100,
    news: null,
    face_seed: 'fpl-229-tarkowski',
    shirt_number: 6,
    overall_rating: 88,
    sample_minutes: 900,
    team: {
      id: 62,
      name: 'Everton FC',
      short_name: 'Everton',
      tla: 'EVE',
      crest_url: null,
      primary_color: '#003399',
    },
  },
  {
    id: '60029b3b-33ad-4c5a-8a6f-24e061ff60df',
    fpl_id: 449,
    web_name: 'Hall',
    full_name: 'Lewis Hall',
    primary_position: 'DEF',
    team_id: 67,
    fpl_cost: 5.2,
    is_injured: false,
    chance_of_playing_next_round: 100,
    news: null,
    face_seed: 'fpl-449-hall',
    shirt_number: 20,
    overall_rating: 84,
    sample_minutes: 815,
    team: {
      id: 67,
      name: 'Newcastle United FC',
      short_name: 'Newcastle United',
      tla: 'NEW',
      crest_url: null,
      primary_color: '#0F172A',
    },
  },
  {
    id: '15444431-c0ce-466b-ae58-cf1f17847361',
    fpl_id: 486,
    web_name: 'McAtee',
    full_name: 'James McAtee',
    primary_position: 'MID',
    team_id: 351,
    fpl_cost: 5.5,
    is_injured: false,
    chance_of_playing_next_round: 100,
    news: null,
    face_seed: 'fpl-486-mcatee',
    shirt_number: 10,
    overall_rating: 84,
    sample_minutes: 790,
    team: {
      id: 351,
      name: 'Nottingham Forest FC',
      short_name: 'Nottingham Forest',
      tla: 'NFO',
      crest_url: null,
      primary_color: '#DD0000',
    },
  },
  {
    id: '863655b7-f8e1-46c9-a39c-813aa5e60c65',
    fpl_id: 165,
    web_name: 'João Pedro',
    full_name: 'João Pedro Junqueira de Jesus',
    primary_position: 'FWD',
    team_id: 397,
    fpl_cost: 7.6,
    is_injured: false,
    chance_of_playing_next_round: 100,
    news: null,
    face_seed: 'fpl-165-joopedro',
    shirt_number: 9,
    overall_rating: 83,
    sample_minutes: 855,
    team: {
      id: 397,
      name: 'Brighton & Hove Albion FC',
      short_name: 'Brighton',
      tla: 'BHA',
      crest_url: null,
      primary_color: '#0057B8',
    },
  },
];

export default async function HomePage() {
  let spotlightPlayers: PlayerListItem[] = FALLBACK_SPOTLIGHT;
  try {
    const { players } = await getPlayersList({ limit: 6 });
    if (players.length > 0) {
      spotlightPlayers = players;
    }
  } catch {
    spotlightPlayers = FALLBACK_SPOTLIGHT;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-emerald-500 selection:text-neutral-950">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />

      {/* Main Container */}
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top Status Bar */}
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-900 pb-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-semibold tracking-wider uppercase text-neutral-300">
              2026/2027 Season Active
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-neutral-500 font-mono text-[11px] hidden sm:block">
              Engine v2.4 • Softmax Calibrated
            </div>
            <Link
              href="/players"
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/40 px-3 py-1 text-xs font-bold text-blue-300 hover:bg-blue-500/25 transition-all shadow-sm shadow-blue-500/10"
            >
              <span>🎮</span>
              <span>Player Profiles</span>
              <span>→</span>
            </Link>
            <Link
              href="/v2"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 transition-all shadow-sm shadow-emerald-500/10"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Tactical Engine V2</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Hero Section */}
        <section className="mb-16 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-6 backdrop-blur-md">
            <span>⚽</span>
            <span>ADVANCED FOOTBALL INTELLIGENCE</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl max-w-4xl leading-[1.1]">
            Premier League Tactical Analytics & Simulation Engine
          </h1>

          <p className="mt-5 max-w-3xl text-base sm:text-lg text-neutral-400 leading-relaxed">
            Form-weighted multi-pillar clash models, 18-month recency-decay baselines, FM 1–100
            player attribute scouting, and calibrated multinomial Softmax probability forecasting.
          </p>
        </section>

        {/* Main Portal Feature Cards (2x2 Responsive Grid) */}
        <section className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Card 1: Tactical Engine V2 (Featured Flagship) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 via-neutral-900/60 to-neutral-900/80 p-6 sm:p-8 backdrop-blur-md transition-all duration-300 hover:border-emerald-400/70 hover:shadow-2xl hover:shadow-emerald-950/30">
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-black text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  NEW • V2 Tactical Engine
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-neutral-950 transition-colors">
                  <span>⚡</span>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                Tactical Engine V2
              </h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                4-Pillar head-to-head tactical clash forecasting with exponential recency decay,
                side-by-side V1/V2 model comparison, and matchday tracking.
              </p>

              {/* Feature Highlights */}
              <ul className="mt-6 space-y-2.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>4-Pillar clash deltas: Central, Aerial, Transition & Perimeter</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Side-by-side Dual Model Comparison (V1 vs V2 divergence)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Matchday 1–38 history with live prediction accuracy tracking</span>
                </li>
              </ul>
            </div>

            {/* Action Link Button */}
            <div className="mt-8 pt-6 border-t border-emerald-500/20">
              <Link
                href="/v2"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-neutral-950 transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25"
              >
                <span>Launch Tactical Engine V2</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Player Profiles & Squad Scouting (NEW MVP) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-blue-500/40 bg-gradient-to-b from-blue-950/25 via-neutral-900/60 to-neutral-900/80 p-6 sm:p-8 backdrop-blur-md transition-all duration-300 hover:border-blue-400/70 hover:shadow-2xl hover:shadow-blue-950/30">
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/20 border border-blue-500/40 px-2.5 py-1 text-xs font-black text-blue-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  NEW • Squad Scouting MVP
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-neutral-950 transition-colors">
                  <span>🎮</span>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-blue-300 transition-colors">
                Player Profiles & Scouting
              </h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                Football Manager-style 1–100 attribute ratings, 6-axis spider polygons, procedural
                pixel regens, and per-90 creative risk telemetry.
              </p>

              {/* Feature Highlights */}
              <ul className="mt-6 space-y-2.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span>16 positional percentile FM attributes across GKP, DEF, MID & FWD</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span>Pure SVG 6-vertex tactical radar & passing risk indicator</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span>Deterministic DiceBear retro pixel avatars & FPL availability</span>
                </li>
              </ul>
            </div>

            {/* Action Link Button */}
            <div className="mt-8 pt-6 border-t border-blue-500/20">
              <Link
                href="/players"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-neutral-950 transition-all hover:bg-blue-400 hover:shadow-lg hover:shadow-blue-500/25"
              >
                <span>Open Player Scouting Directory</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          {/* Card 3: Team Trajectory & Metric Visualizer */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8 backdrop-blur-md transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/80 hover:shadow-xl hover:shadow-black/40">
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center rounded-md bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs font-bold text-neutral-300">
                  Interactive Charts
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300 group-hover:bg-neutral-700 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                    />
                  </svg>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-white transition-colors">
                Team Trajectory
              </h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                Interactive historical and rolling trajectory plots tracking team form, goal
                baselines, and performance swings.
              </p>

              {/* Feature Highlights */}
              <ul className="mt-6 space-y-2.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span>38-match pace comparisons vs prior season equivalents</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span>Goal baselines, scoring efficiency & defensive swings</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span>Multi-club overlay supporting up to 4 concurrent teams</span>
                </li>
              </ul>
            </div>

            {/* Action Link Button */}
            <div className="mt-8 pt-6 border-t border-neutral-800/80">
              <Link
                href="/visualizer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-800 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-neutral-700 hover:text-white"
              >
                <span>Launch Trajectory Visualizer</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          {/* Card 4: Matchday Predictions Engine (Legacy V1) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8 backdrop-blur-md transition-all duration-300 hover:border-sky-500/50 hover:bg-neutral-900/80 hover:shadow-xl hover:shadow-sky-950/20">
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-xs font-bold text-sky-400">
                  Legacy Archetypes
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300 group-hover:bg-sky-500/20 group-hover:text-sky-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-sky-300 transition-colors">
                Legacy Predictions
              </h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                Gameweek-by-gameweek forecasts using Control vs Direct vs Transition
                Rock-Paper-Scissors modifiers.
              </p>

              {/* Feature Highlights */}
              <ul className="mt-6 space-y-2.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span>Softmax multinomial probabilities (Home, Draw, Away)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span>Control vs Direct vs Transition clash modifiers</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span>V1 model history and accuracy tracking</span>
                </li>
              </ul>
            </div>

            {/* Action Link Button */}
            <div className="mt-8 pt-6 border-t border-neutral-800/80">
              <Link
                href="/predictions"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-800 px-5 py-3 text-sm font-bold text-white transition-all group-hover:bg-sky-500 group-hover:text-neutral-950 group-hover:shadow-lg group-hover:shadow-sky-500/25"
              >
                <span>Explore V1 Predictions</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Top-Rated Players Mini Spotlight Section */}
        <section className="mb-20 rounded-2xl border border-neutral-800/90 bg-neutral-900/40 p-6 sm:p-8 backdrop-blur-md">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span>2026/2027 Scouting Leaderboard</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
                Top-Rated Premier League Players
              </h3>
              <p className="mt-0.5 text-xs sm:text-sm text-neutral-400">
                Role-weighted FM 1–100 overall ratings calibrated across positional cohorts.
              </p>
            </div>

            <Link
              href="/players"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/90 px-4 py-2 text-xs font-bold text-white hover:border-blue-500/50 hover:bg-zinc-800 transition-colors"
            >
              <span>View All 670+ Players</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spotlightPlayers.slice(0, 6).map((player) => {
              const ovrClasses = getFmBadgeClasses(player.overall_rating);
              const teamColor = player.team?.primary_color || '#3b82f6';

              return (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-blue-500/50 hover:bg-zinc-900/80"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RegenAvatar
                      faceSeed={player.face_seed}
                      size={48}
                      alt={`${player.web_name} avatar`}
                      team={player.team}
                      teamColor={teamColor}
                      showClubBadge
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                        {player.web_name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-400">
                        {player.team && (
                          <GenericTeamCrest
                            team={{
                              id: player.team.id,
                              name: player.team.name,
                              tla: player.team.tla,
                            }}
                            size={15}
                          />
                        )}
                        <span className="truncate">
                          {player.team?.short_name || 'Premier League'}
                        </span>{' '}
                        •{' '}
                        <span className="font-mono font-semibold text-zinc-300">
                          {player.primary_position}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                        {player.fpl_cost !== null ? `£${player.fpl_cost.toFixed(1)}m` : ''} •{' '}
                        {player.sample_minutes} mins
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`inline-flex h-9 w-10 items-center justify-center rounded-lg font-mono text-sm tabular-nums ${ovrClasses}`}
                    >
                      {player.overall_rating}
                    </span>
                    <span className="mt-0.5 font-mono text-[9px] uppercase text-zinc-500">
                      OVR
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Methodology & Architecture Teaser (Bottom Section) */}
        <section className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-8 sm:p-10 backdrop-blur-sm">
          <div className="mb-8 text-center sm:text-left">
            <h3 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
              Engine Architecture & Methodology
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              A systematic quantitative framework designed to avoid both recency bias and
              historical inertia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Pillar 1 */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold mb-3">
                01
              </div>
              <h4 className="text-base font-bold text-white mb-2">18-Month Rolling Decay</h4>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Half-life exponential weighting prioritizing current form without losing long-term
                baselines. Matches are weighted with a 120-day half-life to balance immediate
                momentum with tactical pedigree.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 font-mono text-xs font-bold mb-3">
                02
              </div>
              <h4 className="text-base font-bold text-white mb-2">Tactical Clash Archetypes</h4>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Control, Transition, and Direct systems mapped with Rock-Paper-Scissors
                multipliers. Team profiles account for stylistic mismatches where playstyle
                matchups shift expected outcomes by up to 10 points.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 font-mono text-xs font-bold mb-3">
                03
              </div>
              <h4 className="text-base font-bold text-white mb-2">Calibrated Softmax</h4>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Regressed draw bands and scaled margins preventing extreme overconfidence. Logit
                outputs incorporate home-field advantages, draw decay parameters, and non-linear
                sensitivity scaling.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-neutral-900 pt-8 text-center text-xs text-neutral-500">
          <p>
            Premier League Tactical Analytics & Simulation Engine • Built with Next.js & Supabase
          </p>
        </footer>
      </div>
    </div>
  );
}
