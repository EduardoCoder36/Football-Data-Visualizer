import React from 'react';
import Link from 'next/link';
import { getPlayersList } from '@/lib/queries/players';
import { PlayerDirectoryClient } from '@/components/player/PlayerDirectoryClient';

export const dynamic = 'force-dynamic';

interface PlayersPageProps {
  searchParams?: Promise<{
    search?: string;
    position?: string;
    teamId?: string;
  }>;
}

export default async function PlayersDirectoryPage({ searchParams }: PlayersPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialSearch = typeof resolvedParams?.search === 'string' ? resolvedParams.search : '';
  const initialPosition =
    typeof resolvedParams?.position === 'string' ? resolvedParams.position : 'ALL';
  const initialTeamId =
    typeof resolvedParams?.teamId === 'string' && resolvedParams.teamId !== 'ALL'
      ? Number(resolvedParams.teamId)
      : null;

  // Fetch complete active Premier League player pool so client filtering is instant
  const { players, teams } = await getPlayersList({
    limit: 1000,
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Ambient Background Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.14),rgba(255,255,255,0))]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Navigation Bar */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
            >
              <span>←</span>
              <span>Dashboard Home</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              Squad Scouting & Player Profiles
            </span>
          </div>

          <nav aria-label="Quick navigation" className="flex items-center gap-2 text-xs">
            <Link
              href="/v2"
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-semibold text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
            >
              Tactical Engine V2
            </Link>
            <Link
              href="/visualizer"
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
            >
              Trajectory Visualizer
            </Link>
          </nav>
        </header>

        {/* Hero Section */}
        <main>
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span>🎮</span>
              <span>FM 1–100 ATTRIBUTE ENGINE • 2026/2027 SEASON</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              Premier League Player Profiles
            </h1>
            <p className="mt-2.5 max-w-3xl text-sm sm:text-base text-zinc-400 leading-relaxed">
              Positional percentile scouting across {players.length} active Premier League players.
              Filter by role cohort or club to inspect 6-axis tactical polygons, 16 calibrated FM
              attributes, and procedural retro avatars.
            </p>
          </div>

          <PlayerDirectoryClient
            initialPlayers={players}
            teams={teams}
            initialSearch={initialSearch}
            initialPosition={initialPosition}
            initialTeamId={initialTeamId}
          />
        </main>
      </div>
    </div>
  );
}
