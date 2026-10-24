import React from 'react';

export interface MatchPrediction {
    id: string;
    match_date: string;
    gameweek?: string;
    home_team: string;
    away_team: string;
    prob_home: number | null;
    prob_draw: number | null;
    prob_away: number | null;
    favored: string;
    clash_type?: string | null;
    actual_score?: string | null;
    actual_result?: 'H' | 'D' | 'A' | null;
}

export default function MatchPredictionCard({ match }: { match: MatchPrediction }) {
    const rawDate = match.match_date ? new Date(match.match_date) : null;
    const formattedDate = rawDate && !isNaN(rawDate.getTime())
        ? rawDate.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
        })
        : 'TBD';

    const pHome = Math.max(0, Math.min(100, Number(match.prob_home ?? 0)));
    const pDraw = Math.max(0, Math.min(100, Number(match.prob_draw ?? 0)));
    const pAway = Math.max(0, Math.min(100, Number(match.prob_away ?? 0)));
    const hasData = match.prob_home !== null && match.prob_draw !== null && match.prob_away !== null;

    // Check if match is completed
    const isCompleted = Boolean(match.actual_score);
    const formattedScore = match.actual_score
        ? match.actual_score.replace(/\s*[-–—:\u2212]\s*/g, ' - ')
        : null;

    // Accuracy evaluation for completed matches
    const favoredCode = match.favored === 'Home' ? 'H' : (match.favored === 'Away' ? 'A' : (match.favored === 'Draw' ? 'D' : ''));
    
    let outcomeBadge: { label: string; style: string } | null = null;
    if (isCompleted && match.actual_result) {
        const isHit = favoredCode === match.actual_result;
        
        // Double chance check: actual was draw or actual was secondary highest probability
        const sortedProbs = [
            { code: 'H', p: pHome },
            { code: 'D', p: pDraw },
            { code: 'A', p: pAway },
        ].sort((a, b) => b.p - a.p);
        const secondPick = sortedProbs[1]?.code;
        const isDoubleChance = !isHit && (match.actual_result === 'D' || match.actual_result === secondPick);

        if (isHit) {
            outcomeBadge = {
                label: '✓ Hit',
                style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
            };
        } else if (isDoubleChance) {
            outcomeBadge = {
                label: '½ Double Chance',
                style: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            };
        } else {
            outcomeBadge = {
                label: '✗ Miss',
                style: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
            };
        }
    }

    return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-5 shadow-sm backdrop-blur-md transition-all hover:border-neutral-700 flex flex-col justify-between">
            {/* Header: Date & Badges (Archetype Clash + Outcome Accuracy) */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
                <span className="font-medium tracking-wide uppercase">{formattedDate}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                    {match.clash_type && (
                        <span 
                            className="max-w-[180px] sm:max-w-xs truncate rounded-full bg-neutral-800 px-2.5 py-0.5 text-[11px] font-medium text-neutral-300"
                            title={match.clash_type}
                        >
                            {match.clash_type}
                        </span>
                    )}
                    {outcomeBadge && (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${outcomeBadge.style}`}>
                            {outcomeBadge.label}
                        </span>
                    )}
                </div>
            </div>

            {/* Main Area: Teams, Odds & Final Score */}
            {isCompleted ? (
                /* Completed Match View */
                <div className="mb-4 grid grid-cols-3 items-center gap-2 text-center">
                    <div className="min-w-0 text-left">
                        <p 
                            className={`truncate text-sm sm:text-base font-bold ${
                                match.actual_result === 'H' ? 'text-white' : 'text-neutral-300'
                            }`}
                            title={match.home_team}
                        >
                            {match.home_team}
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-emerald-400">
                            {hasData ? `${pHome.toFixed(1)}%` : '--'}
                        </p>
                    </div>

                    <div className="flex flex-col items-center justify-center min-w-0">
                        <div className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
                            {formattedScore}
                        </div>
                        <span className="mt-0.5 inline-flex items-center rounded bg-neutral-800/90 border border-neutral-700/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                            FT
                        </span>
                    </div>

                    <div className="min-w-0 text-right">
                        <p 
                            className={`truncate text-sm sm:text-base font-bold ${
                                match.actual_result === 'A' ? 'text-white' : 'text-neutral-300'
                            }`}
                            title={match.away_team}
                        >
                            {match.away_team}
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-sky-400">
                            {hasData ? `${pAway.toFixed(1)}%` : '--'}
                        </p>
                    </div>
                </div>
            ) : (
                /* Upcoming Fixture View */
                <div className="mb-4 grid grid-cols-3 items-center gap-2 text-center">
                    <div className="min-w-0 text-left">
                        <p className="truncate text-sm sm:text-base font-bold text-neutral-100" title={match.home_team}>
                            {match.home_team}
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-emerald-400">
                            {hasData ? `${pHome.toFixed(1)}%` : '--'}
                        </p>
                    </div>

                    <div className="flex justify-center min-w-0">
                        <span className="whitespace-nowrap rounded-md bg-neutral-800/80 px-2 py-1 text-[11px] sm:text-xs font-semibold text-amber-400">
                            Draw {hasData ? `${pDraw.toFixed(1)}%` : '--'}
                        </span>
                    </div>

                    <div className="min-w-0 text-right">
                        <p className="truncate text-sm sm:text-base font-bold text-neutral-100" title={match.away_team}>
                            {match.away_team}
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-sky-400">
                            {hasData ? `${pAway.toFixed(1)}%` : '--'}
                        </p>
                    </div>
                </div>
            )}

            {/* Tri-Tone Softmax Probability Bar */}
            <div className="space-y-1.5">
                <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-neutral-800 ring-1 ring-neutral-700/50">
                    {hasData ? (
                        <>
                            <div
                                style={{ width: `${pHome}%` }}
                                className="bg-emerald-500 transition-all duration-700 ease-out"
                                title={`${match.home_team}: ${pHome.toFixed(1)}%`}
                            />
                            <div
                                style={{ width: `${pDraw}%` }}
                                className="bg-amber-400 transition-all duration-700 ease-out"
                                title={`Draw: ${pDraw.toFixed(1)}%`}
                            />
                            <div
                                style={{ width: `${pAway}%` }}
                                className="bg-sky-500 transition-all duration-700 ease-out"
                                title={`${match.away_team}: ${pAway.toFixed(1)}%`}
                            />
                        </>
                    ) : (
                        <div className="w-full bg-neutral-800 text-[10px] text-neutral-500 text-center flex items-center justify-center">
                            Probabilities Pending
                        </div>
                    )}
                </div>

                {/* Legend / Callout */}
                <div className="flex flex-wrap justify-between gap-1 text-[10px] sm:text-[11px] font-medium text-neutral-500">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Home Win {hasData && isCompleted ? `(${pHome.toFixed(1)}%)` : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Draw {hasData && isCompleted ? `(${pDraw.toFixed(1)}%)` : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        Away Win {hasData && isCompleted ? `(${pAway.toFixed(1)}%)` : ''}
                    </span>
                </div>
            </div>
        </div>
    );
}