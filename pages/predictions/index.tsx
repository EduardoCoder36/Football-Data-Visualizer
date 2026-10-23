import { useMemo, useState } from 'react';
import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import MatchPredictionCard, { MatchPrediction } from '@/components/models/MatchPredictionCard';

interface PredictionsPageProps {
    predictions: MatchPrediction[];
}

export const getStaticProps: GetStaticProps<PredictionsPageProps> = async () => {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data, error } = await supabase
        .from('match_predictions')
        .select('*')
        .order('match_date', { ascending: true });

    if (error) {
        console.error('Failed to load predictions:', error);
        return {
            props: { predictions: [] },
            revalidate: 60,
        };
    }

    return {
        props: {
            predictions: (data as MatchPrediction[]) || [],
        },
        revalidate: 3600,
    };
};

export default function PredictionsPage({ predictions }: PredictionsPageProps) {
    // Extract unique gameweeks sorted numerically
    const availableGameweeks = useMemo(() => {
        const set = new Set<string>();
        predictions.forEach((p) => {
            if (p.gameweek) set.add(p.gameweek);
        });
        return Array.from(set).sort((a, b) => {
            const numA = parseInt(a, 10);
            const numB = parseInt(b, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
    }, [predictions]);

    // Determine the earliest upcoming/unplayed gameweek
    const earliestUpcomingGameweek = useMemo(() => {
        const upcoming = predictions.find((p) => !p.actual_score && p.gameweek);
        if (upcoming?.gameweek) return upcoming.gameweek;
        return availableGameweeks[availableGameweeks.length - 1] || '1';
    }, [predictions, availableGameweeks]);

    // Active gameweek state
    const [selectedGameweek, setSelectedGameweek] = useState<string>(earliestUpcomingGameweek);

    // Filter matches for the selected gameweek
    const filteredMatches = useMemo(() => {
        return predictions.filter((p) => p.gameweek === selectedGameweek);
    }, [predictions, selectedGameweek]);

    // Gameweek round classification
    const currentGwNum = parseInt(selectedGameweek, 10);
    const liveGwNum = parseInt(earliestUpcomingGameweek, 10);
    const isPastRound = !isNaN(currentGwNum) && !isNaN(liveGwNum) && currentGwNum < liveGwNum;
    const isFutureRound = !isNaN(currentGwNum) && !isNaN(liveGwNum) && currentGwNum > liveGwNum;
    const isLiveRound = selectedGameweek === earliestUpcomingGameweek;

    // Calculate accuracy statistics for completed rounds
    const accuracyStats = useMemo(() => {
        if (!isPastRound) return null;
        const completed = filteredMatches.filter((p) => p.actual_score && p.actual_result);
        if (completed.length === 0) return null;

        let hits = 0;
        let doubleChanceHits = 0;

        for (const m of completed) {
            const favoredCode = m.favored === 'Home' ? 'H' : (m.favored === 'Away' ? 'A' : (m.favored === 'Draw' ? 'D' : ''));
            const isHit = favoredCode === m.actual_result;

            const pHome = Number(m.prob_home ?? 0);
            const pDraw = Number(m.prob_draw ?? 0);
            const pAway = Number(m.prob_away ?? 0);
            const sorted = [
                { code: 'H', p: pHome },
                { code: 'D', p: pDraw },
                { code: 'A', p: pAway },
            ].sort((a, b) => b.p - a.p);
            const secondPick = sorted[1]?.code;
            const isDc = isHit || m.actual_result === 'D' || m.actual_result === secondPick;

            if (isHit) hits++;
            if (isDc) doubleChanceHits++;
        }

        return {
            hits,
            doubleChanceHits,
            total: completed.length,
            hitRate: Math.round((hits / completed.length) * 100),
            dcRate: Math.round((doubleChanceHits / completed.length) * 100),
        };
    }, [filteredMatches, isPastRound]);

    return (
        <main className="min-h-screen bg-neutral-950 px-4 py-12 text-neutral-100 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
                {/* Navigation Breadcrumb */}
                <div className="mb-8 flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-900 pb-4">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-1.5 font-medium text-neutral-300 hover:text-white transition-colors">
                            <span>←</span>
                            <span>Engine Hub</span>
                        </Link>
                        <span className="text-neutral-700">/</span>
                        <span className="text-neutral-200 font-semibold">Match Predictions</span>
                    </div>
                    <Link href="/visualizer" className="text-neutral-400 hover:text-emerald-400 transition-colors">
                        Trajectory Visualizer →
                    </Link>
                </div>

                {/* Header Section */}
                <div className="mb-8 text-center sm:text-left">
                    <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                        Match Predictions
                    </h1>
                    <p className="mt-2 text-base text-neutral-400">
                        18-month rolling performance baselines, Rock-Paper-Scissors tactical clash modifiers, and calibrated Softmax probabilities.
                    </p>
                </div>

                {/* Horizontal Scrollable Gameweek Pill Selector */}
                {availableGameweeks.length > 0 && (
                    <div className="mb-6">
                        <div className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-400">
                            <span>Select Matchweek</span>
                            <span>{filteredMatches.length} {isPastRound ? 'Completed Matches' : 'Fixtures'}</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-neutral-800">
                            {availableGameweeks.map((gw) => {
                                const isSelected = selectedGameweek === gw;
                                const isLive = gw === earliestUpcomingGameweek;
                                const gwNum = parseInt(gw, 10);
                                const isPast = !isNaN(gwNum) && !isNaN(liveGwNum) && gwNum < liveGwNum;

                                return (
                                    <button
                                        key={gw}
                                        type="button"
                                        onClick={() => setSelectedGameweek(gw)}
                                        className={`relative flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                                            isSelected
                                                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                                                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-100'
                                        }`}
                                    >
                                        <span>GW {gw}</span>
                                        {isLive && (
                                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                                                isSelected ? 'bg-neutral-950/20 text-neutral-950' : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                                Live
                                            </span>
                                        )}
                                        {isPast && !isSelected && (
                                            <span className="text-[10px] text-neutral-500 font-mono">✓</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Dynamic Contextual Banners */}
                {isFutureRound && (
                    <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 text-amber-200 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                            <span className="text-xl sm:text-2xl flex-shrink-0">⚠️</span>
                            <div>
                                <h4 className="text-sm sm:text-base font-bold text-amber-100">
                                    Future Projections
                                </h4>
                                <p className="mt-1 text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                                    These ratings are calculated from current 18-month rolling baselines. Probabilities will dynamically recalculate as intermediate matchday results are completed.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {isPastRound && accuracyStats && (
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-base">
                                ✓
                            </div>
                            <div>
                                <p className="text-xs uppercase font-semibold tracking-wider text-emerald-400">
                                    Gameweek {selectedGameweek} Historical Performance
                                </p>
                                <h4 className="text-base sm:text-lg font-bold text-white">
                                    Model Record: {accuracyStats.hits}/{accuracyStats.total} Top-Pick Hits ({accuracyStats.hitRate}%)
                                </h4>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-neutral-900/80 border border-neutral-700/60 px-3 py-1.5 text-xs text-neutral-300">
                                Double Chance: <strong className="text-amber-400 font-semibold">{accuracyStats.doubleChanceHits}/{accuracyStats.total}</strong> ({accuracyStats.dcRate}%)
                            </span>
                        </div>
                    </div>
                )}

                {isLiveRound && (
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2.5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            </span>
                            <span className="text-sm font-semibold text-neutral-200">
                                Active Matchweek (Gameweek {selectedGameweek}): <span className="font-normal text-neutral-400">Upcoming Fixtures Projected</span>
                            </span>
                        </div>
                        <span className="text-xs text-neutral-400 font-medium">
                            Calibrated Softmax & RPS Modifiers
                        </span>
                    </div>
                )}

                {/* Prediction Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                    {filteredMatches.map((match) => (
                        <MatchPredictionCard key={match.id} match={match} />
                    ))}
                </div>

                {filteredMatches.length === 0 && (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-neutral-400">
                        No fixtures found for Gameweek {selectedGameweek}.
                    </div>
                )}
            </div>
        </main>
    );
}
