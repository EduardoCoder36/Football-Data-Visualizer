import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import TeamSelectorBar, { TeamOption } from "../components/analytics/TeamSelectorBar";
import TrajectoryChart, { TrajectoryDataRow } from "../components/analytics/TrajectoryChart";
import FixtureResultsTable from "../components/analytics/FixtureResultsTable";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ARSENAL_ID = 57;
const CURRENT_SEASON = "2026/2027";

export default function DashboardPage() {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [trajectories, setTrajectories] = useState<TrajectoryDataRow[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([ARSENAL_ID]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // 1. Identify active clubs in the current campaign
      const { data: activeFixtures } = await supabase
        .from("fixtures")
        .select("home_team_id")
        .eq("season", CURRENT_SEASON);

      const activeTeamIds = new Set((activeFixtures || []).map((f) => f.home_team_id));

      // 2. Fetch all teams
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, name, short_name, tla, crest_url, is_promoted")
        .order("name", { ascending: true });

      // 3. Fetch trajectories
      const { data: trajectoryRows } = await supabase
        .from("team_trajectories")
        .select("team_id, games_played, is_completed, cumulative_points, cumulative_goals_for, cumulative_goals_against, baseline_points, baseline_goals_for, baseline_goals_against, same_opponent_points, same_opponent_goals_for, same_opponent_goals_against")
        .order("games_played", { ascending: true });

      if (teamRows) {
        // Filter out any historic or relegated clubs not active in the current season
        const activeClubs = teamRows.filter((t) =>
          activeTeamIds.size > 0 ? activeTeamIds.has(t.id) : true
        );

        setTeams(
          activeClubs.map((t) => ({
            id: t.id,
            name: t.name,
            shortName: t.short_name,
            tla: t.tla,
            crestUrl: t.crest_url,
            isPromoted: t.is_promoted,
          }))
        );
      }

      if (trajectoryRows) {
        setTrajectories(trajectoryRows);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const handleToggleTeam = (teamId: number) => {
    setSelectedTeamIds((prev) => {
      if (prev.includes(teamId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== teamId);
      } else {
        if (prev.length >= 4) return prev;
        return [...prev, teamId];
      }
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading Premier League Trajectories...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <TeamSelectorBar
        teams={teams}
        selectedTeamIds={selectedTeamIds}
        onToggleTeam={handleToggleTeam}
      />
      <div className="flex-1 w-full overflow-y-auto">
        <TrajectoryChart
          teams={teams}
          selectedTeamIds={selectedTeamIds}
          trajectories={trajectories}
        />
        
        {/* Fixture Results Table Section */}
        <div className="w-full mt-2 pb-12 px-4 border-t border-slate-900 pt-6">
          {selectedTeamIds.length === 1 ? (
            <FixtureResultsTable teamId={selectedTeamIds[0]} season={CURRENT_SEASON} />
          ) : (
            <div className="w-full max-w-3xl mx-auto bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center shadow-sm">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-200 mb-2">Select a single team</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Select exactly one team in the top bar to view match-by-match results, score breakdowns, and prior-season equivalents.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}