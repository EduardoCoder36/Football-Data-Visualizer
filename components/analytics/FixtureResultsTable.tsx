import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
}

interface HistoricalMatch {
  matchday: number;
  opponent_name: string;
  opponent_crest: string;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
}

export const FixtureResultsTable: React.FC<{ teamId: number; season: string }> = ({ teamId, season }) => {
  const [fixtures, setFixtures] = useState<FixtureDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      setFixtures(formatted);
      setLoading(false);
    };

    fetchFixtures();
    return () => { isMounted = false; };
  }, [teamId, season]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading fixtures...</div>;
  }

  return (
    <div className="w-full mx-auto flex flex-col bg-slate-950 text-slate-200">
      <div className="overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-700 rounded-lg border border-slate-800">
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-sm font-semibold text-slate-400">GW</th>
              <th className="px-4 py-3 text-sm font-semibold text-slate-400">Date</th>
              <th className="px-4 py-3 text-sm font-semibold text-slate-400">Opponent</th>
              <th className="px-4 py-3 text-sm font-semibold text-slate-400">Score</th>
              <th className="px-4 py-3 text-sm font-semibold text-slate-400 text-center">Result</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {fixtures.map((f) => {
              const isExpanded = expandedId === f.id;
              let resultLabel = "-";
              let resultColor = "text-slate-500";
              
              if (f.status === "FINISHED" && f.home_score !== null && f.away_score !== null) {
                const myScore = f.is_home ? f.home_score : f.away_score;
                const oppScore = f.is_home ? f.away_score : f.home_score;
                if (myScore > oppScore) { resultLabel = "W"; resultColor = "text-emerald-500"; }
                else if (myScore < oppScore) { resultLabel = "L"; resultColor = "text-red-500"; }
                else { resultLabel = "D"; resultColor = "text-slate-400"; }
              } else if (f.status === "POSTPONED") {
                resultLabel = "P";
                resultColor = "text-amber-500";
              }

              return (
                <React.Fragment key={f.id}>
                  <tr 
                    className={`group hover:bg-slate-900/50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-900/30' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : f.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : f.id); } }}
                    tabIndex={0}
                    aria-expanded={isExpanded}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-300">{f.matchday}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {new Date(f.kickoff).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={f.opponent_crest} alt={f.opponent_name} className="w-6 h-6 object-contain" />
                        <span className="text-sm font-medium">{f.opponent_name}</span>
                        <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">{f.is_home ? 'H' : 'A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold tracking-wider">
                      {f.status === 'FINISHED' ? `${f.home_score} - ${f.away_score}` : (f.status === 'POSTPONED' ? 'P - P' : '-')}
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${resultColor}`}>
                      {resultLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-center">
                      <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="p-0 border-b border-slate-800 bg-slate-900/60 shadow-inner text-sm animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* Card 1: Current Season */}
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                              <h4 className="text-slate-400 font-semibold tracking-wider text-[10px] uppercase border-b border-slate-800/80 pb-2 mb-2">Current Season</h4>
                              {f.status === "POSTPONED" ? (
                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  <span className="font-semibold text-xs">Postponed / Rescheduled</span>
                                </div>
                              ) : f.status === "FINISHED" ? (
                                <div className="space-y-2 text-slate-300 text-xs">
                                  <div className="flex justify-between items-center bg-slate-900/50 px-2 py-1.5 rounded">
                                    <span className="text-slate-500">Half-Time</span>
                                    <span className="font-mono">({f.half_time_home_score ?? '-'} - {f.half_time_away_score ?? '-'})</span>
                                  </div>
                                  <div className="flex justify-between items-center bg-slate-900/50 px-2 py-1.5 rounded">
                                    <span className="text-slate-500">Full-Time</span>
                                    <span className="font-mono font-bold text-slate-200">{f.home_score} - {f.away_score}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-slate-500 italic text-xs">Match not yet played</div>
                              )}
                            </div>

                            {/* Card 2: Last Year's Pace */}
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-3 relative">
                              <h4 className="text-slate-400 font-semibold tracking-wider text-[10px] uppercase border-b border-slate-800/80 pb-2 mb-2">Last Year's Pace (GW {f.matchday})</h4>
                              {f.paceMatch ? (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <img src={f.paceMatch.opponent_crest} alt={f.paceMatch.opponent_name} className="w-5 h-5 object-contain" />
                                    <span className="text-xs font-medium text-slate-300">{f.paceMatch.opponent_name}</span>
                                    <span className="text-[10px] text-slate-500 px-1 py-0.5 bg-slate-800 rounded">{f.paceMatch.is_home ? 'H' : 'A'}</span>
                                  </div>
                                  <div className="font-mono font-bold text-slate-400 text-sm">{f.paceMatch.home_score}-{f.paceMatch.away_score}</div>
                                </div>
                              ) : (
                                <div className="text-slate-500 italic text-xs">No match found</div>
                              )}
                            </div>

                            {/* Card 3: Same Opponent Equivalent */}
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-3 relative">
                              <h4 className="text-slate-400 font-semibold tracking-wider text-[10px] uppercase border-b border-slate-800/80 pb-2 mb-2 flex items-center justify-between">
                                <span>Same Opponent</span>
                                {f.is_promoted_replacement && (
                                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded uppercase">Replaced</span>
                                )}
                              </h4>
                              
                              {f.sameOpponentMatch ? (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <img src={f.sameOpponentMatch.opponent_crest} alt={f.sameOpponentMatch.opponent_name} className="w-5 h-5 object-contain" />
                                    <span className="text-xs font-medium text-slate-300">{f.sameOpponentMatch.opponent_name}</span>
                                    <span className="text-[10px] text-slate-500 px-1 py-0.5 bg-slate-800 rounded">{f.sameOpponentMatch.is_home ? 'H' : 'A'}</span>
                                  </div>
                                  <div className="font-mono font-bold text-slate-400 text-sm">{f.sameOpponentMatch.home_score}-{f.sameOpponentMatch.away_score}</div>
                                </div>
                              ) : (
                                <div className="text-slate-500 italic text-xs">No historical equivalent</div>
                              )}
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FixtureResultsTable;
