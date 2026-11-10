import React from 'react';
import Link from 'next/link';
import { getPlayerProfile } from '@/lib/queries/players';
import { PlayerHeroHeader } from '@/components/player/PlayerHeroHeader';
import { RadarChart } from '@/components/player/RadarChart';
import { SeasonTelemetryCard } from '@/components/player/SeasonTelemetryCard';
import { AttributeGrid } from '@/components/player/AttributeGrid';

export const dynamic = 'force-dynamic';

interface PlayerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PlayerDetailPage({ params }: PlayerDetailPageProps) {
  const { id } = await params;
  const player = await getPlayerProfile(id);

  if (!player) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center shadow-xl">
          <h1 className="text-xl font-bold text-white">Player Profile Not Found</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Could not locate a Premier League player matching identifier{' '}
            <code className="font-mono text-emerald-400">{id}</code>.
          </p>
          <Link
            href="/players"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-neutral-950 hover:bg-emerald-400 transition-colors"
          >
            <span>←</span>
            <span>Back to Player Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  const teamColor = player.team?.primary_color || '#10b981';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Ambient Background Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(ellipse 75% 50% at 50% -15%, ${teamColor}, transparent)`,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Breadcrumb Navigation */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/"
              className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 font-medium text-zinc-400 hover:border-zinc-700 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-zinc-700">/</span>
            <Link
              href="/players"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 font-semibold text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
            >
              <span>←</span>
              <span>Player Directory</span>
            </Link>
            {player.team && (
              <>
                <span className="text-zinc-700">/</span>
                <Link
                  href={`/players?teamId=${player.team.id}`}
                  className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2.5 py-1.5 font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
                >
                  {player.team.short_name}
                </Link>
              </>
            )}
            <span className="text-zinc-700">/</span>
            <span className="font-mono font-bold text-emerald-400">{player.web_name}</span>
          </nav>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/players?position=${player.primary_position}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-mono font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
            >
              Compare {player.primary_position} Cohort →
            </Link>
          </div>
        </header>

        {/* Main 3-Card Layout */}
        <main className="space-y-6">
          {/* Top Card: PlayerHeroHeader */}
          <PlayerHeroHeader player={player} />

          {/* Two-Column Body: Left (RadarChart + SeasonTelemetryCard), Right (AttributeGrid) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Left Column (5 cols on desktop) */}
            <div className="space-y-6 lg:col-span-5">
              <RadarChart ratings={player.ratings} playerName={player.full_name} />
              <SeasonTelemetryCard aggregates={player.aggregates} />
            </div>

            {/* Right Column (7 cols on desktop) */}
            <div className="lg:col-span-7">
              <AttributeGrid ratings={player.ratings} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
