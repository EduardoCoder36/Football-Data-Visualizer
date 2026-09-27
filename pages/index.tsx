import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import TeamSelectorBar, { TeamOption } from "../components/analytics/TeamSelectorBar";
import TrajectoryChart, { TrajectoryDataRow } from "../components/analytics/TrajectoryChart";

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
      <div className="flex-1 w-full overflow-hidden">
        <TrajectoryChart
          teams={teams}
          selectedTeamIds={selectedTeamIds}
          trajectories={trajectories}
        />
      </div>
    </div>
  );
}