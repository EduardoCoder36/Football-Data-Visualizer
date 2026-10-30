import React, { useMemo, useState, useEffect } from 'react';
import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import V2MatchCard, {
  V2MatchPrediction,
  V1MatchPrediction,
  TeamTacticalProfileV2,
} from '@/components/models/V2MatchCard';

interface V2PageProps {
  v2Predictions: V2MatchPrediction[];
  v1Predictions: V1MatchPrediction[];
  profiles: Record<string, TeamTacticalProfileV2>;
}

// Canonical team alias dictionary for joining V1 and V2
const V1_ALIASES: Record<string, string> = {
  'Nottingham': 'Nottingham Forest',
  "Nott'm Forest": 'Nottingham Forest',
  'Man City': 'Manchester City',
  'Man United': 'Manchester United',
  'Manchester Utd': 'Manchester United',
  'Tottenham': 'Tottenham Hotspur',
  'Spurs': 'Tottenham Hotspur',
  'Brighton': 'Brighton & Hove Albion',
  'Brighton Hove': 'Brighton & Hove Albion',
  'Newcastle': 'Newcastle United',
  'Wolves': 'Wolverhampton',
  'Bournemouth': 'Bournemouth',
};

// Client-side browser Supabase instance using public anon key
const browserSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const getStaticProps: GetStaticProps<V2PageProps> = async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  // Fetch V2 predictions
  const { data: v2Data, error: v2Error } = await supabase
    .from('match_predictions_v2')
    .select('*')
    .order('matchday', { ascending: true })
    .order('utc_date', { ascending: true });

  if (v2Error) {
    console.error('Failed to load V2 predictions:', v2Error);
  }

  // Fetch V2 tactical profiles
  const { data: profilesData, error: profilesError } = await supabase
    .from('team_tactical_profiles_v2')
    .select('*');

  if (profilesError) {
    console.error('Failed to load V2 tactical profiles:', profilesError);
  }

  // Fetch legacy V1 predictions for side-by-side comparison
  const { data: v1Data, error: v1Error } = await supabase
    .from('match_predictions')
    .select('*')
    .order('match_date', { ascending: true });

  if (v1Error) {
    console.error('Failed to load legacy V1 predictions:', v1Error);
  }

  const profilesMap: Record<string, TeamTacticalProfileV2> = {};
  (profilesData || []).forEach((p: TeamTacticalProfileV2) => {
    profilesMap[p.team] = p;
  });

  return {
    props: {
      v2Predictions: (v2Data as V2MatchPrediction[]) || [],
      v1Predictions: (v1Data as V1MatchPrediction[]) || [],
      profiles: profilesMap,
    },
    revalidate: 60,
  };
};

export default function V2DashboardPage({
  v2Predictions: initialV2Predictions = [],
  v1Predictions: initialV1Predictions = [],
  profiles: initialProfiles = {},
}: V2PageProps) {
  // Live state with initial props fallback
  const [v2Predictions, setV2Predictions] = useState<V2MatchPrediction[]>(initialV2Predictions);
  const [v1Predictions, setV1Predictions] = useState<V1MatchPrediction[]>(initialV1Predictions);
  const [profiles, setProfiles] = useState<Record<string, TeamTacticalProfileV2>>(initialProfiles);
  const [isLoadingGw, setIsLoadingGw] = useState(false);
  const [gwError, setGwError] = useState<string | null>(null);

  // Model Comparison Mode Toggle state
  const [showComparison, setShowComparison] = useState(false);

  // User manual matchday selection tracking
  const [userSelected, setUserSelected] = useState(false);

  // Determine the live/earliest upcoming matchday
  const earliestUpcomingMatchday = useMemo(() => {
    const upcoming = v2Predictions.find(
      (p) => p.status !== 'FINISHED' && p.matchday
    );
    if (upcoming && upcoming.matchday) return Number(upcoming.matchday);
    return 9;
  }, [v2Predictions]);

  // Active matchday state (default to next live round, parsed as integer)
  const [selectedMatchday, setSelectedMatchday] = useState<number>(() => {
    if (initialV2Predictions && initialV2Predictions.length > 0) {
      const upcoming = initialV2Predictions.find(
        (p) => p.status !== 'FINISHED' && p.matchday
      );
      if (upcoming && upcoming.matchday) return Number(upcoming.matchday);
    }
    return 9;
  });

  // Extract unique gameweeks sorted 1 to 38
  const availableMatchdays = useMemo(() => {
    const set = new Set<number>();
    v2Predictions.forEach((p) => {
      if (p.matchday) set.add(Number(p.matchday));
    });
    // Default to 1..38 so buttons are always clickable even before full dataset loads
    if (set.size === 0) {
      return Array.from({ length: 38 }, (_, i) => i + 1);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [v2Predictions]);

  // If predictions update and user hasn't clicked, track earliest upcoming
  useEffect(() => {
    if (!userSelected && v2Predictions.length > 0) {
      const upcoming = v2Predictions.find(
        (p) => p.status !== 'FINISHED' && p.matchday
      );
      if (upcoming && upcoming.matchday) {
        setSelectedMatchday(Number(upcoming.matchday));
      }
    }
  }, [v2Predictions, userSelected]);

  // Client-side Supabase fetch query for the active matchday:
  // Parses matchday as an integer Number(selectedMatchday), logs errors to console
  useEffect(() => {
    let isCancelled = false;

    async function fetchMatchdayPredictions() {
      const matchdayInt = Number(selectedMatchday);
      if (isNaN(matchdayInt)) {
        console.warn('[V2 Engine] Invalid selectedMatchday:', selectedMatchday);
        return;
      }

      setIsLoadingGw(true);
      setGwError(null);

      try {
        const { data, error } = await browserSupabase
          .from('match_predictions_v2')
          .select('*')
          .eq('matchday', matchdayInt)
          .order('utc_date', { ascending: true });

        if (error) {
          console.error(
            `[V2 Engine] Supabase error fetching match_predictions_v2 for matchday ${matchdayInt}:`,
            error
          );
          if (!isCancelled) {
            setGwError(error.message || 'Error fetching fixtures from Supabase.');
          }
          return;
        }

        if (!isCancelled && data && data.length > 0) {
          // Merge newly fetched fixtures into v2Predictions state
          setV2Predictions((prev) => {
            const map = new Map<string, V2MatchPrediction>();
            prev.forEach((p) => map.set(p.id, p));
            (data as V2MatchPrediction[]).forEach((p) => map.set(p.id, p));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error('[V2 Engine] Unexpected error fetching matchday:', err);
        if (!isCancelled) {
          setGwError(err instanceof Error ? err.message : 'Unknown query error');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingGw(false);
        }
      }
    }

    fetchMatchdayPredictions();

    return () => {
      isCancelled = true;
    };
  }, [selectedMatchday]);

  // On initial mount, also fetch full dataset and tactical profiles if missing
  useEffect(() => {
    async function fetchFullDataset() {
      // 1. If v2Predictions is empty or missing data, fetch all
      if (v2Predictions.length === 0) {
        const { data, error } = await browserSupabase
          .from('match_predictions_v2')
          .select('*')
          .order('matchday', { ascending: true })
          .order('utc_date', { ascending: true });

        if (error) {
          console.error('[V2 Engine] Supabase error fetching all match_predictions_v2:', error);
        } else if (data) {
          setV2Predictions(data as V2MatchPrediction[]);
        }
      }

      // 2. Tactical Profiles if missing
      if (Object.keys(profiles).length === 0) {
        const { data, error } = await browserSupabase
          .from('team_tactical_profiles_v2')
          .select('*');

        if (error) {
          console.error('[V2 Engine] Supabase error fetching tactical profiles:', error);
        } else if (data) {
          const map: Record<string, TeamTacticalProfileV2> = {};
          (data as TeamTacticalProfileV2[]).forEach((p) => {
            map[p.team] = p;
          });
          setProfiles(map);
        }
      }

      // 3. Legacy V1 predictions if missing
      if (v1Predictions.length === 0) {
        const { data, error } = await browserSupabase
          .from('match_predictions')
          .select('*')
          .order('match_date', { ascending: true });

        if (error) {
          console.error('[V2 Engine] Supabase error fetching legacy match_predictions:', error);
        } else if (data) {
          setV1Predictions(data as V1MatchPrediction[]);
        }
      }
    }

    fetchFullDataset();
  }, []);

  // Filter matches for selected matchday (strict integer comparison)
  const filteredMatches = useMemo(() => {
    const targetMatchday = Number(selectedMatchday);
    return v2Predictions.filter((p) => Number(p.matchday) === targetMatchday);
  }, [v2Predictions, selectedMatchday]);

  // Map V1 predictions by (matchday, home_team, away_team)
  const v1Map = useMemo(() => {
    const map = new Map<string, V1MatchPrediction>();
    v1Predictions.forEach((m) => {
      const gw = parseInt(m.gameweek || '0', 10);
      const h = V1_ALIASES[m.home_team] || m.home_team;
      const a = V1_ALIASES[m.away_team] || m.away_team;
      map.set(`${gw}_${h}_${a}`, m);
    });
    return map;
  }, [v1Predictions]);

  // Round classification
  const isPastRound = Number(selectedMatchday) < Number(earliestUpcomingMatchday);
  const isLiveRound = Number(selectedMatchday) === Number(earliestUpcomingMatchday);

  // Calculate cumulative accuracy across all finished matches up to current matchday
  const cumulativeAccuracy = useMemo(() => {
    const allFinished = v2Predictions.filter(
      (p) => p.status === 'FINISHED' && p.home_score !== null && p.away_score !== null
    );

    if (allFinished.length === 0) return null;

    let hits = 0;
    let doubleChanceHits = 0;

    allFinished.forEach((m) => {
      const actual =
        m.home_score! > m.away_score! ? 'H' : m.home_score! === m.away_score! ? 'D' : 'A';

      const maxP = Math.max(m.prob_home, m.prob_draw, m.prob_away);
      const topPick = maxP === m.prob_home ? 'H' : maxP === m.prob_away ? 'A' : 'D';

      // Strict Double Chance logic
      const isHit = topPick === actual;
      const isDoubleChanceHit = !isHit && (
        (topPick === 'H' && actual === 'D') ||
        (topPick === 'A' && actual === 'D') ||
        (topPick === 'D' && (actual === 'H' || actual === 'A'))
      );
      const isDc = isHit || isDoubleChanceHit;

      if (isHit) hits++;
      if (isDc) doubleChanceHits++;
    });

    return {
      total: allFinished.length,
      hits,
      doubleChanceHits,
      hitRate: Math.round((hits / allFinished.length) * 100),
      dcRate: Math.round((doubleChanceHits / allFinished.length) * 100),
    };
  }, [v2Predictions]);

  // Round-specific accuracy for finished round
  const roundAccuracy = useMemo(() => {
    if (!isPastRound) return null;
    const completed = filteredMatches.filter(
      (p) => p.status === 'FINISHED' && p.home_score !== null && p.away_score !== null
    );
    if (completed.length === 0) return null;

    let hits = 0;
    completed.forEach((m) => {
      const actual =
        m.home_score! > m.away_score! ? 'H' : m.home_score! === m.away_score! ? 'D' : 'A';
      const maxP = Math.max(m.prob_home, m.prob_draw, m.prob_away);
      const topPick = maxP === m.prob_home ? 'H' : maxP === m.prob_away ? 'A' : 'D';
      if (topPick === actual) hits++;
    });

    return {
      hits,
      total: completed.length,
      rate: Math.round((hits / completed.length) * 100),
    };
  }, [filteredMatches, isPastRound]);

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100 sm:px-6 lg:px-8 selection:bg-emerald-500 selection:text-neutral-950">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(16,185,129,0.12),rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-5xl">
        {/* Navigation Breadcrumbs & Top Bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-900 pb-4 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              <span>←</span>
              <span>Primary Dashboard</span>
            </Link>
            <span className="text-neutral-700">/</span>
            <span className="text-emerald-400 font-bold uppercase tracking-wider">
              Tactical Engine V2
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/predictions"
              className="font-medium text-neutral-400 hover:text-sky-400 transition-colors"
            >
              Legacy V1 Predictions →
            </Link>
            <Link
              href="/visualizer"
              className="font-medium text-neutral-400 hover:text-emerald-400 transition-colors"
            >
              Trajectory Visualizer →
            </Link>
          </div>
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 mb-4 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>V2 MULTI-PILLAR FORECASTING ENGINE</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Tactical Matchday Intelligence
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-neutral-400 leading-relaxed">
            Form-weighted (<code className="text-neutral-300 font-mono">λ = 0.90</code>), 4-pillar head-to-head clash telemetry (Aerial, Central Penetration, Transition Speed, and Perimeter Chaos), combined with chaos-dampened calibrated Softmax probability distributions.
          </p>
        </div>

        {/* Dual-Model Comparison Toggle Bar */}
        <div className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-5 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300">
              <span>⚖️</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">Dual-Model Comparison</div>
              <div className="text-xs text-neutral-400">
                Display parallel odds and clash divergence vs. Legacy V1 model
              </div>
            </div>
          </div>

          <div className="inline-flex items-center rounded-xl bg-neutral-950 p-1 border border-neutral-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setShowComparison(false)}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                !showComparison
                  ? 'bg-emerald-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              V2 Focus View
            </button>
            <button
              type="button"
              onClick={() => setShowComparison(true)}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                showComparison
                  ? 'bg-purple-600 text-white shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Side-by-Side (V1 vs V2)
            </button>
          </div>
        </div>

        {/* Cumulative Accuracy Banner (Across all completed matches) */}
        {cumulativeAccuracy && (
          <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Matches Evaluated
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-black text-white font-mono">
                {cumulativeAccuracy.total}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3.5">
              <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Top Pick Hit Rate
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {cumulativeAccuracy.hitRate}%
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                {cumulativeAccuracy.hits}/{cumulativeAccuracy.total} Outcomes
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3.5">
              <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                Double Chance Rate
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-black text-amber-400 font-mono">
                {cumulativeAccuracy.dcRate}%
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                {cumulativeAccuracy.doubleChanceHits}/{cumulativeAccuracy.total} Top 2 Picks
              </div>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-3.5">
              <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                Next Live Matchweek
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-black text-sky-400 font-mono">
                GW {earliestUpcomingMatchday}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                10 Scheduled Fixtures
              </div>
            </div>
          </div>
        )}

        {/* Gameweek Selector Horizontal Scroller */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold text-neutral-300">
              Select Matchweek (1 – 38)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUserSelected(true);
                  setSelectedMatchday(Number(earliestUpcomingMatchday));
                }}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Jump to Live Round (GW {earliestUpcomingMatchday}) →
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-neutral-800">
            {availableMatchdays.map((gw) => {
              const isSelected = Number(selectedMatchday) === Number(gw);
              const isLive = Number(gw) === Number(earliestUpcomingMatchday);
              const isPast = Number(gw) < Number(earliestUpcomingMatchday);

              return (
                <button
                  key={gw}
                  type="button"
                  onClick={() => {
                    setUserSelected(true);
                    setSelectedMatchday(Number(gw));
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/20'
                      : isLive
                      ? 'bg-neutral-900 border border-emerald-500/50 text-emerald-300 hover:bg-neutral-800'
                      : isPast
                      ? 'bg-neutral-900/60 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                      : 'bg-neutral-900/30 border border-neutral-900 text-neutral-400 hover:text-neutral-400'
                  }`}
                >
                  <span>GW {gw}</span>
                  {isLive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {isPast && <span className="text-[10px] text-neutral-400">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Forecast Notice on Upcoming Gameweeks */}
        {!isPastRound && (
          <div className="mb-6 rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 sm:p-4 text-xs text-sky-200 flex items-start gap-3">
            <span className="text-base">⚡</span>
            <div>
              <span className="font-bold">Dynamic Forecast Notice:</span> Probabilities dynamically recalibrate before kickoff based on latest team form, injury updates, and tactical shifts.
            </div>
          </div>
        )}

        {/* Round Performance Badge for Past Gameweeks */}
        {isPastRound && roundAccuracy && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 sm:p-4 text-xs text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <span>
                <strong className="text-white">Gameweek {selectedMatchday} Completed:</strong> Top pick correctly forecasted{' '}
                <strong className="text-emerald-400">{roundAccuracy.hits}/{roundAccuracy.total}</strong> outcomes ({roundAccuracy.rate}% Accuracy).
              </span>
            </div>
          </div>
        )}

        {/* Matches Grid */}
        <div className="space-y-4">
          {isLoadingGw && filteredMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/30 p-12 text-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
              <p className="text-sm text-neutral-300 font-medium">Loading Gameweek {selectedMatchday} fixtures...</p>
              <p className="text-xs text-neutral-500 mt-1">Connecting to Supabase match predictions database</p>
            </div>
          ) : filteredMatches.length > 0 ? (
            filteredMatches.map((m) => {
              const v1Key = `${m.matchday}_${m.home_team}_${m.away_team}`;
              const legacy = v1Map.get(v1Key) || null;
              const hProfile = profiles[m.home_team] || null;
              const aProfile = profiles[m.away_team] || null;

              return (
                <V2MatchCard
                  key={m.id}
                  match={m}
                  legacyMatch={legacy}
                  homeProfile={hProfile}
                  awayProfile={aProfile}
                  showComparison={showComparison}
                />
              );
            })
          ) : (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-12 text-center text-sm text-neutral-400">
              {gwError ? (
                <div className="text-rose-400">
                  <p className="font-bold">Error loading Gameweek {selectedMatchday} fixtures</p>
                  <p className="text-xs text-neutral-400 mt-1 font-mono">{gwError}</p>
                </div>
              ) : (
                <p>No fixtures scheduled for Gameweek {selectedMatchday}.</p>
              )}
            </div>
          )}
        </div>

        {/* Methodology Notes Footer */}
        <footer className="mt-16 border-t border-neutral-900 pt-8 text-center text-xs text-neutral-400 space-y-2">
          <p>
            V2 Multi-Pillar Tactical Engine • Calibrated Softmax • Form Weighting (<code className="text-neutral-400">λ = 0.90</code>)
          </p>
          <p>
            Built with Next.js, TailwindCSS & Supabase. Legacy V1 data preserved for side-by-side backtesting.
          </p>
        </footer>
      </div>
    </main>
  );
}
