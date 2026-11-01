import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import TeamSelectorBar, { TeamOption } from "../components/analytics/TeamSelectorBar";
import TrajectoryChart, { TrajectoryDataRow, ViewMode } from "../components/analytics/TrajectoryChart";
import FixtureResultsTable from "../components/analytics/FixtureResultsTable";
import { deriveSeasonPairFromDate, getSeasonPair } from "../services/teamMetricsService";
import { supabase } from "../lib/supabaseClient";

const ARSENAL_ID = 57;
const MAX_COMPARISON_TEAMS = 2;

export default function VisualizerPage() {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [trajectories, setTrajectories] = useState<TrajectoryDataRow[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([ARSENAL_ID]);
  const [viewMode, setViewMode] = useState<ViewMode>("comparison");
  const [maxSelectionError, setMaxSelectionError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSeason, setActiveSeason] = useState<string>(
    () => deriveSeasonPairFromDate().currentSeason
  );
  const [loading, setLoading] = useState(true);

  const triggerSelectionError = (msg: string) => {
    setMaxSelectionError(msg);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setMaxSelectionError(null);
    }, 3500);
  };

  const clearSelectionError = () => {
    setMaxSelectionError(null);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { currentSeason } = await getSeasonPair(supabase);
      setActiveSeason(currentSeason);

      // 1. Identify active clubs in the current campaign
      const { data: activeFixtures } = await supabase
        .from("fixtures")
        .select("home_team_id")
        .eq("season", currentSeason);

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

  const handleViewModeChange = (mode: ViewMode) => {
    clearSelectionError();
    setViewMode(mode);
    if (mode === "team_metrics" && selectedTeamIds.length > 1) {
      setSelectedTeamIds([selectedTeamIds[0]]);
    }
  };

  const handleToggleTeam = (teamId: number) => {
    if (viewMode === "team_metrics") {
      // Single-team exclusive mode: clicking a new team deselects the existing team immediately
      clearSelectionError();
      setSelectedTeamIds([teamId]);
      return;
    }

    // Team Comparison mode (capped at 2 teams)
    if (selectedTeamIds.includes(teamId)) {
      clearSelectionError();
      if (selectedTeamIds.length === 1) return;
      setSelectedTeamIds((prev) => prev.filter((id) => id !== teamId));
    } else {
      if (selectedTeamIds.length >= MAX_COMPARISON_TEAMS) {
        triggerSelectionError(
          "Maximum of 2 teams can be selected. Please deselect an existing team first."
        );
        return;
      }
      clearSelectionError();
      setSelectedTeamIds((prev) => [...prev, teamId]);
    }
  };

  const handleSelectSingleTeam = (teamId: number) => {
    clearSelectionError();
    setSelectedTeamIds([teamId]);
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
      {/* Top Navigation Bar */}
      <div className="w-full bg-slate-950 border-b border-slate-900 px-4 py-2 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 font-medium text-slate-300 hover:text-white transition-colors">
            <span>←</span>
            <span>Engine Hub</span>
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-200 font-semibold">Trajectory Visualizer</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/predictions" className="text-slate-400 hover:text-emerald-400 transition-colors">
            Predictions Engine →
          </Link>
        </div>
      </div>

      {/* Unified Team Selector Bar (Shown in both Comparison and Team Metrics modes) */}
      <TeamSelectorBar
        teams={teams}
        selectedTeamIds={selectedTeamIds}
        onToggleTeam={handleToggleTeam}
        viewMode={viewMode}
        maxSelectionError={maxSelectionError}
        onDismissError={clearSelectionError}
      />

      <div className="flex-1 w-full overflow-y-auto">
        <TrajectoryChart
          teams={teams}
          selectedTeamIds={selectedTeamIds}
          trajectories={trajectories}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onSelectSingleTeam={handleSelectSingleTeam}
        />

        {/* Fixture Results Table Section */}
        <div className="w-full mt-2 pb-12 px-4 border-t border-slate-900 pt-6">
          {selectedTeamIds.length === 1 ? (
            <FixtureResultsTable teamId={selectedTeamIds[0]} season={activeSeason} />
          ) : (
            <div className="w-full max-w-3xl mx-auto bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center shadow-sm">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-200 mb-2">Select a single team</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Select exactly one team to view match-by-match results, score breakdowns, and prior-season equivalents.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
