import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface HistoricalMatch {
  matchday: number;
  opponent_name: string;
  opponent_crest: string;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
}

interface FixtureDetail {
  id: string;
  matchday: number;
  kickoff: string;
  opponent_name: string;
  opponent_crest: string;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
  half_time_home_score: number | null;
  half_time_away_score: number | null;
  status: string;
  paceMatch: HistoricalMatch | null;
  sameOpponentMatch: HistoricalMatch | null;
  is_promoted_replacement: boolean;
  currentPts?: number | null;
  pacePts?: number | null;
  eqPts?: number | null;
  gwDelta?: number | null;
  eqDelta?: number | null;
  cumulativeGwDelta?: number | null;
  cumulativeEqDelta?: number | null;
}

export const FixtureResultsTable: React.FC<{ teamId: number; season: string }> = ({ teamId, season }) => {
  const [fixtures, setFixtures] = useState<FixtureDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchFixtures = async () => {
      setLoading(true);
      const prevSeason = (parseInt(season.split('/')[0]) - 1) + '/' + (parseInt(season.split('/')[1]) - 1);
      
      const [currentRes, prevRes, replacementsRes] = await Promise.all([
        supabase
          .from('fixtures')
          .select(`
            id, matchday, kickoff, status, home_team_id, away_team_id,
            home_score, away_score, half_time_home_score, half_time_away_score,
            home_team:teams!home_team_id (id, name, crest_url),
            away_team:teams!away_team_id (id, name, crest_url)
          `)
          .eq('season', season)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .order('kickoff', { ascending: true }),
        supabase
          .from('fixtures')
          .select(`
            id, matchday, kickoff, status, home_team_id, away_team_id,
            home_score, away_score,
            home_team:teams!home_team_id (id, name, crest_url),
            away_team:teams!away_team_id (id, name, crest_url)
          `)
          .eq('season', prevSeason)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .eq('status', 'FINISHED'),
        supabase
          .from('relegated_replacements')
          .select('*')
          .eq('season', season)
      ]);

      if (!isMounted) return;

      const currentMatches = currentRes.data || [];
      const prevMatches = prevRes.data || [];
      const replacements = replacementsRes.data || [];

      const promotedToRelegatedMap = new Map<number, number>();
      replacements.forEach(r => {
        promotedToRelegatedMap.set(r.promoted_team_id, r.relegated_team_id);
      });

      const formatted = currentMatches.map((m: any) => {
        const isHome = m.home_team_id === teamId;
        const opponentId = isHome ? m.away_team_id : m.home_team_id;
        const opponent = isHome ? m.away_team : m.home_team;
        
        // Compute Last Year's Pace Match
        const rawPaceMatch = prevMatches.find(p => p.matchday === m.matchday);
        let paceMatch: HistoricalMatch | null = null;
        if (rawPaceMatch) {
          const pIsHome = rawPaceMatch.home_team_id === teamId;
          const pOpponent = (pIsHome ? rawPaceMatch.away_team : rawPaceMatch.home_team) as any;
          paceMatch = {
            matchday: rawPaceMatch.matchday,
            opponent_name: pOpponent.name,
            opponent_crest: pOpponent.crest_url,
            is_home: pIsHome,
            home_score: rawPaceMatch.home_score,
            away_score: rawPaceMatch.away_score
          };
        }

        // Compute Same Opponent Match
        const targetOpponentId = promotedToRelegatedMap.get(opponentId) ?? opponentId;
        const isPromotedReplacement = promotedToRelegatedMap.has(opponentId);
        
        const rawSameOppMatch = prevMatches.find(p => 
          (isHome && p.home_team_id === teamId && p.away_team_id === targetOpponentId) ||
          (!isHome && p.away_team_id === teamId && p.home_team_id === targetOpponentId)
        );

        let sameOpponentMatch: HistoricalMatch | null = null;
        if (rawSameOppMatch) {
          const soIsHome = rawSameOppMatch.home_team_id === teamId;
          const soOpponent = (soIsHome ? rawSameOppMatch.away_team : rawSameOppMatch.home_team) as any;
          sameOpponentMatch = {
            matchday: rawSameOppMatch.matchday,
            opponent_name: soOpponent.name,
            opponent_crest: soOpponent.crest_url,
            is_home: soIsHome,
            home_score: rawSameOppMatch.home_score,
            away_score: rawSameOppMatch.away_score
          };
        }

        return {
          id: m.id,
          matchday: m.matchday,
          kickoff: m.kickoff,
          opponent_name: opponent.name,
          opponent_crest: opponent.crest_url,
          is_home: isHome,
          home_score: m.home_score,
          away_score: m.away_score,
          half_time_home_score: m.half_time_home_score,
          half_time_away_score: m.half_time_away_score,
          status: m.status,
          paceMatch,
          sameOpponentMatch,
          is_promoted_replacement: isPromotedReplacement
        };
      });

      // Calculate deltas
      let cumulativeGw = 0;
      let cumulativeEq = 0;

      const getPts = (myScore: number | null, oppScore: number | null) => {
        if (myScore === null || oppScore === null) return null;
        if (myScore > oppScore) return 3;
        if (myScore === oppScore) return 1;
        return 0;
      };

      const enhancedFixtures = formatted.map(f => {
        let currentPts: number | null = null;
        if (f.status === 'FINISHED' && f.home_score !== null && f.away_score !== null) {
          currentPts = getPts(f.is_home ? f.home_score : f.away_score, f.is_home ? f.away_score : f.home_score);
        }

        let pacePts: number | null = null;
        if (f.paceMatch && f.paceMatch.home_score !== null && f.paceMatch.away_score !== null) {
          pacePts = getPts(f.paceMatch.is_home ? f.paceMatch.home_score : f.paceMatch.away_score, f.paceMatch.is_home ? f.paceMatch.away_score : f.paceMatch.home_score);
        }

        let eqPts: number | null = null;
        if (f.sameOpponentMatch && f.sameOpponentMatch.home_score !== null && f.sameOpponentMatch.away_score !== null) {
          eqPts = getPts(f.sameOpponentMatch.is_home ? f.sameOpponentMatch.home_score : f.sameOpponentMatch.away_score, f.sameOpponentMatch.is_home ? f.sameOpponentMatch.away_score : f.sameOpponentMatch.home_score);
        }

        let gwDelta: number | null = null;
        let cumulativeGwDelta: number | null = null;
        if (currentPts !== null && pacePts !== null) {
          gwDelta = currentPts - pacePts;
          cumulativeGw += gwDelta;
          cumulativeGwDelta = cumulativeGw;
        }

        let eqDelta: number | null = null;
        let cumulativeEqDelta: number | null = null;
        if (currentPts !== null && eqPts !== null) {
          eqDelta = currentPts - eqPts;
          cumulativeEq += eqDelta;
          cumulativeEqDelta = cumulativeEq;
        }

        return {
          ...f,
          currentPts,
          pacePts,
          eqPts,
          gwDelta,
          eqDelta,
          cumulativeGwDelta,
          cumulativeEqDelta
        };
      });

      setFixtures(enhancedFixtures);
      setLoading(false);
    };

    fetchFixtures();
    return () => { isMounted = false; };
  }, [teamId, season]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading fixtures...</div>;
  }

  const formatDelta = (delta: number | null | undefined) => {
    if (delta === null || delta === undefined) return '-';
    if (delta > 0) return `+${delta}`;
    return delta.toString();
  };

  const getDeltaColor = (delta: number | null | undefined) => {
    if (delta === null || delta === undefined) return 'text-slate-600';
    if (delta > 0) return 'text-emerald-500';
    if (delta < 0) return 'text-red-500';
    return 'text-slate-400';
  };

  const renderResultBadge = (myScore: number | null, oppScore: number | null, status = 'FINISHED') => {
    if (status === 'POSTPONED') return <span className="text-xs font-bold text-amber-500 w-4 text-center">P</span>;
    if (myScore === null || oppScore === null) return <span className="text-xs font-bold text-slate-600 w-4 text-center">-</span>;
    if (myScore > oppScore) return <span className="text-xs font-bold text-emerald-500 w-4 text-center">W</span>;
    if (myScore < oppScore) return <span className="text-xs font-bold text-red-500 w-4 text-center">L</span>;
    return <span className="text-xs font-bold text-slate-400 w-4 text-center">D</span>;
  };

  const renderMatchInfo = (name: string, crest: string, isHome: boolean, myScore: number | null, oppScore: number | null, status = 'FINISHED', textClass = 'text-slate-200') => {
    const displayHomeScore = isHome ? myScore : oppScore;
    const displayAwayScore = isHome ? oppScore : myScore;
    
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <img src={crest} alt={name} className="w-5 h-5 object-contain" />
          <span className={`text-sm font-medium ${textClass}`}>{name}</span>
          <span className="text-[10px] text-slate-500 px-1 py-0.5 bg-slate-800 rounded">{isHome ? 'H' : 'A'}</span>
        </div>
        <div className="flex items-center gap-2 pl-7">
          <span className={`text-xs font-mono font-bold ${textClass}`}>
            {status === 'FINISHED' && displayHomeScore !== null ? `${displayHomeScore} - ${displayAwayScore}` : (status === 'POSTPONED' ? 'P - P' : '-')}
          </span>
          {renderResultBadge(myScore, oppScore, status)}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full mx-auto flex flex-col bg-slate-950 text-slate-200">
      <div className="overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-700 rounded-lg border border-slate-800">
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400">GW</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400">Current Match</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400">Last Season (GW)</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400">Equivalent Fixture</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400">Match Pts Δ</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400">Cumul. Pts Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {fixtures.map((f) => {
              const myScore = f.is_home ? f.home_score : f.away_score;
              const oppScore = f.is_home ? f.away_score : f.home_score;
              
              const pMyScore = f.paceMatch ? (f.paceMatch.is_home ? f.paceMatch.home_score : f.paceMatch.away_score) : null;
              const pOppScore = f.paceMatch ? (f.paceMatch.is_home ? f.paceMatch.away_score : f.paceMatch.home_score) : null;

              const eqMyScore = f.sameOpponentMatch ? (f.sameOpponentMatch.is_home ? f.sameOpponentMatch.home_score : f.sameOpponentMatch.away_score) : null;
              const eqOppScore = f.sameOpponentMatch ? (f.sameOpponentMatch.is_home ? f.sameOpponentMatch.away_score : f.sameOpponentMatch.home_score) : null;

              return (
                <tr key={f.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-300 align-top pt-4">{f.matchday}</td>
                  
                  <td className="px-4 py-3 align-top pt-3">
                    {renderMatchInfo(f.opponent_name, f.opponent_crest, f.is_home, myScore, oppScore, f.status, 'text-slate-200')}
                  </td>
                  
                  <td className="px-4 py-3 align-top pt-3">
                    {f.paceMatch ? (
                      renderMatchInfo(f.paceMatch.opponent_name, f.paceMatch.opponent_crest, f.paceMatch.is_home, pMyScore, pOppScore, 'FINISHED', 'text-slate-400')
                    ) : (
                      <span className="text-xs text-slate-600 italic">No match</span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 align-top pt-3">
                    {f.sameOpponentMatch ? (
                      renderMatchInfo(f.sameOpponentMatch.opponent_name, f.sameOpponentMatch.opponent_crest, f.sameOpponentMatch.is_home, eqMyScore, eqOppScore, 'FINISHED', 'text-zinc-400')
                    ) : (
                      <span className="text-xs text-slate-600 italic">No equivalent</span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 font-mono tabular-nums text-sm align-top pt-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-4 font-sans uppercase">GW</span>
                        <span className={`${getDeltaColor(f.gwDelta)} font-bold`}>{formatDelta(f.gwDelta)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-4 font-sans uppercase">Eq</span>
                        <span className={`${getDeltaColor(f.eqDelta)} font-bold`}>{formatDelta(f.eqDelta)}</span>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-3 font-mono tabular-nums text-sm align-top pt-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-4 font-sans uppercase">GW</span>
                        <span className={`${getDeltaColor(f.cumulativeGwDelta)} font-bold`}>{formatDelta(f.cumulativeGwDelta)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-4 font-sans uppercase">Eq</span>
                        <span className={`${getDeltaColor(f.cumulativeEqDelta)} font-bold`}>{formatDelta(f.cumulativeEqDelta)}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FixtureResultsTable;
