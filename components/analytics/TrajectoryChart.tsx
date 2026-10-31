import React, { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TeamOption } from "./TeamSelectorBar";
import { getTeamColor } from "../../constants/teamColors";
import { MetricType } from "../../types/trajectory";
import { MetricToggle } from "../charts/MetricToggle";
import { TeamMetricChips } from "../charts/TeamMetricChips";
import {
  fetchTeamMetrics,
  TeamMetricPoint,
  TeamMetricKey,
  TEAM_METRIC_CHIPS,
  DEFAULT_ACTIVE_METRICS,
} from "../../services/teamMetricsService";
import { supabase } from "../../lib/supabaseClient";

export interface TrajectoryDataRow {
  team_id: number;
  games_played: number;
  is_completed: boolean;
  cumulative_points: number;
  cumulative_goals_for: number;
  cumulative_goals_against: number;
  baseline_points: number | null;
  baseline_goals_for: number | null;
  baseline_goals_against: number | null;
  same_opponent_points: number | null;
  same_opponent_goals_for: number | null;
  same_opponent_goals_against: number | null;
}

export type ViewMode = "comparison" | "team_metrics";

export interface TrajectoryChartProps {
  teams: TeamOption[];
  selectedTeamIds: number[];
  trajectories: TrajectoryDataRow[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onSelectSingleTeam?: (teamId: number) => void;
}

export const TrajectoryChart: React.FC<TrajectoryChartProps> = ({
  teams,
  selectedTeamIds,
  trajectories,
  viewMode: controlledViewMode,
  onViewModeChange,
  onSelectSingleTeam,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("comparison");
  const viewMode = controlledViewMode ?? internalViewMode;

  const handleSetViewMode = (mode: ViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  // Zoom control
  const [isZoomed, setIsZoomed] = useState(true);

  // Comparison mode metric state
  const [activeComparisonMetric, setActiveComparisonMetric] = useState<MetricType>("PTS");

  // Team Metrics mode states
  const [activeMetricKeys, setActiveMetricKeys] = useState<TeamMetricKey[]>(DEFAULT_ACTIVE_METRICS);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetricPoint[]>([]);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(false);

  // Current primary single team (for Team Metrics mode)
  const primaryTeamId = selectedTeamIds[0] ?? teams[0]?.id ?? 57;
  const primaryTeam = useMemo(
    () => teams.find((t) => t.id === primaryTeamId) ?? teams[0],
    [teams, primaryTeamId]
  );

  // Fetch match_raw_stats when in team_metrics mode or when primary team changes
  useEffect(() => {
    if (viewMode !== "team_metrics" || !primaryTeam) return;

    let isMounted = true;
    setMetricsLoading(true);

    fetchTeamMetrics(supabase, primaryTeam.name)
      .then((data) => {
        if (isMounted) {
          setTeamMetrics(data);
          setMetricsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load match_raw_stats:", err);
        if (isMounted) setMetricsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [viewMode, primaryTeam?.name]);

  const handleToggleMetricKey = (key: TeamMetricKey) => {
    setActiveMetricKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleSelectAllMetrics = () => {
    setActiveMetricKeys(TEAM_METRIC_CHIPS.map((c) => c.key));
  };

  const handleResetMetrics = () => {
    setActiveMetricKeys(DEFAULT_ACTIVE_METRICS);
  };

  const handleSelectPrimaryTeam = (teamId: number) => {
    if (onSelectSingleTeam) {
      onSelectSingleTeam(teamId);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Comparison Mode Chart Data & Scales
  // ---------------------------------------------------------------------------
  const { maxComparisonGamesPlayed, maxComparisonMetricValue } = useMemo(() => {
    let maxGP = 1;
    let maxVal = activeComparisonMetric === "PTS" ? 3 : 2;

    trajectories.forEach((traj) => {
      if (!selectedTeamIds.includes(traj.team_id)) return;

      if (traj.games_played > maxGP) {
        maxGP = traj.games_played;
      }

      let val = 0;
      if (activeComparisonMetric === "PTS") {
        val = Math.max(
          traj.cumulative_points ?? 0,
          traj.baseline_points ?? 0,
          traj.same_opponent_points ?? 0
        );
      } else if (activeComparisonMetric === "GF") {
        val = Math.max(
          traj.cumulative_goals_for ?? 0,
          traj.baseline_goals_for ?? 0,
          traj.same_opponent_goals_for ?? 0
        );
      } else if (activeComparisonMetric === "GA") {
        val = Math.max(
          traj.cumulative_goals_against ?? 0,
          traj.baseline_goals_against ?? 0,
          traj.same_opponent_goals_against ?? 0
        );
      }

      if (val > maxVal) {
        maxVal = val;
      }
    });

    return { maxComparisonGamesPlayed: maxGP, maxComparisonMetricValue: maxVal };
  }, [trajectories, selectedTeamIds, activeComparisonMetric]);

  const comparisonChartData = useMemo(() => {
    const slots = Array.from({ length: 38 }, (_, i) => ({
      gamesPlayed: i + 1,
    }));

    trajectories.forEach((traj) => {
      if (!selectedTeamIds.includes(traj.team_id)) return;
      const index = traj.games_played - 1;
      if (slots[index]) {
        if (activeComparisonMetric === "PTS") {
          // @ts-ignore
          slots[index][`team_${traj.team_id}_current`] = traj.cumulative_points;
          if (traj.baseline_points !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_baseline`] = traj.baseline_points;
          }
          if (traj.same_opponent_points !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_sameOpponent`] = traj.same_opponent_points;
          }
        } else if (activeComparisonMetric === "GF") {
          // @ts-ignore
          slots[index][`team_${traj.team_id}_current`] = traj.cumulative_goals_for;
          if (traj.baseline_goals_for !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_baseline`] = traj.baseline_goals_for;
          }
          if (traj.same_opponent_goals_for !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_sameOpponent`] = traj.same_opponent_goals_for;
          }
        } else if (activeComparisonMetric === "GA") {
          // @ts-ignore
          slots[index][`team_${traj.team_id}_current`] = traj.cumulative_goals_against;
          if (traj.baseline_goals_against !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_baseline`] = traj.baseline_goals_against;
          }
          if (traj.same_opponent_goals_against !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_sameOpponent`] = traj.same_opponent_goals_against;
          }
        }
      }
    });

    return slots;
  }, [trajectories, selectedTeamIds, activeComparisonMetric]);

  const activeTeams = useMemo(() => {
    return teams.filter((t) => selectedTeamIds.includes(t.id));
  }, [teams, selectedTeamIds]);

  // ---------------------------------------------------------------------------
  // 2. Team Metrics Mode Chart Data & Scales
  // ---------------------------------------------------------------------------
  const { maxTeamMetricsGamesPlayed, maxTeamMetricsValue } = useMemo(() => {
    let maxGP = teamMetrics.length > 0 ? teamMetrics[teamMetrics.length - 1].gameweek : 1;
    let maxVal = 5;

    teamMetrics.forEach((pt) => {
      activeMetricKeys.forEach((key) => {
        const val = pt[key];
        if (typeof val === "number" && val > maxVal) {
          maxVal = val;
        }
      });
    });

    return { maxTeamMetricsGamesPlayed: maxGP, maxTeamMetricsValue: maxVal };
  }, [teamMetrics, activeMetricKeys]);

  const teamMetricsChartData = useMemo(() => {
    const slots: any[] = Array.from({ length: 38 }, (_, i) => ({
      gamesPlayed: i + 1,
    }));

    teamMetrics.forEach((pt) => {
      const idx = pt.gameweek - 1;
      if (slots[idx]) {
        slots[idx] = {
          ...slots[idx],
          ...pt,
        };
      }
    });

    return slots;
  }, [teamMetrics]);

  // ---------------------------------------------------------------------------
  // 3. Domains & Labels
  // ---------------------------------------------------------------------------
  const comparisonXDomain = isZoomed
    ? [1, Math.max(5, Math.min(38, maxComparisonGamesPlayed + 1))]
    : [1, 38];

  const comparisonYDomain: any = isZoomed
    ? [
        0,
        Math.max(
          activeComparisonMetric === "PTS" ? 9 : 3,
          maxComparisonMetricValue + Math.ceil(maxComparisonMetricValue * 0.1)
        ),
      ]
    : [0, "auto"];

  const comparisonYLabel =
    activeComparisonMetric === "PTS"
      ? "Points"
      : activeComparisonMetric === "GF"
      ? "Goals Scored"
      : "Goals Conceded";

  const comparisonUnitSuffix = activeComparisonMetric === "PTS" ? "pts" : "goals";

  const teamMetricsXDomain = isZoomed
    ? [1, Math.max(5, Math.min(38, maxTeamMetricsGamesPlayed + 1))]
    : [1, 38];

  const teamMetricsYDomain: any = isZoomed
    ? [0, Math.max(10, Math.ceil(maxTeamMetricsValue * 1.15))]
    : [0, "auto"];

  return (
    <div className="w-full flex flex-col p-4 bg-slate-950">
      {/* High-Level View Mode Switcher Pill */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-900 mb-4">
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-sm">
          <button
            onClick={() => handleSetViewMode("comparison")}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === "comparison"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <span>⇄</span>
            <span>Team Comparison</span>
          </button>
          <button
            onClick={() => handleSetViewMode("team_metrics")}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === "team_metrics"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <span>📊</span>
            <span>Team Metrics</span>
          </button>
        </div>

        {/* Zoom & Full Season Toggle Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsZoomed((prev) => !prev)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition shadow-sm"
          >
            {isZoomed ? "Switch to Full Season (38 GW)" : "Zoom to Current Matchday"}
          </button>
          <span className="text-slate-500 text-xs italic hidden sm:inline">
            {isZoomed
              ? `Zoomed: GW 1–${viewMode === "comparison" ? comparisonXDomain[1] : teamMetricsXDomain[1]}`
              : "Full View (38 Matchdays)"}
          </span>
        </div>
      </div>

      {/* Mode Specific Controls */}
      {viewMode === "comparison" ? (
        <div className="mb-4">
          <MetricToggle
            selectedMetric={activeComparisonMetric}
            onChange={setActiveComparisonMetric}
          />
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Single Team Dropdown */}
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Club:</span>
              </label>
              <div className="relative">
                <select
                  value={primaryTeamId}
                  onChange={(e) => handleSelectPrimaryTeam(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isPromoted ? "(Promoted)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Series Actions */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                onClick={handleResetMetrics}
                className="hover:text-slate-200 hover:underline transition-colors"
              >
                Reset Defaults
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={handleSelectAllMetrics}
                className="hover:text-slate-200 hover:underline transition-colors"
              >
                Select All
              </button>
            </div>
          </div>

          {/* Interactive Multi-Select Metric Toggle Chips */}
          <div className="pt-1">
            <TeamMetricChips
              activeKeys={activeMetricKeys}
              onToggleKey={handleToggleMetricKey}
            />
          </div>
        </div>
      )}

      {/* Legend & Summary Sub-Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between pb-3 text-xs text-slate-400 border-b border-slate-900 mb-2">
        {viewMode === "comparison" ? (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-slate-200 inline-block"></span>
              <span>Current Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-400 inline-block"></span>
              <span>Last Year's Pace</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-t-2 border-dotted border-slate-400 inline-block"></span>
              <span>Same Opponents</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-semibold text-slate-200">{primaryTeam?.name}</span>
            <span>•</span>
            <span>
              Cumulative telemetry across {teamMetrics.length} completed fixtures from{" "}
              <code className="text-emerald-400 font-mono text-[11px]">match_raw_stats</code>
            </span>
          </div>
        )}

        {viewMode === "team_metrics" && (
          <div className="text-slate-500 italic text-[11px]">
            {activeMetricKeys.length} series active
          </div>
        )}
      </div>

      {/* Main Chart Canvas */}
      <div className="w-full h-[400px] sm:h-[500px] relative">
        {viewMode === "team_metrics" && metricsLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20 text-slate-400 text-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Loading club match telemetry...</span>
            </div>
          </div>
        ) : null}

        {viewMode === "team_metrics" && activeMetricKeys.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <p className="text-base font-medium text-slate-400 mb-1">No metrics active</p>
            <p className="text-xs">Click one or more chips above to render data lines on the chart.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "comparison" ? (
              <LineChart
                data={comparisonChartData}
                margin={{ top: 15, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
                <XAxis
                  dataKey="gamesPlayed"
                  type="number"
                  domain={comparisonXDomain}
                  allowDataOverflow={true}
                  stroke="#64748b"
                  tickCount={isZoomed ? (comparisonXDomain[1] as number) : 19}
                  label={{
                    value: "Matches Played",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#64748b",
                  }}
                />
                <YAxis
                  type="number"
                  domain={comparisonYDomain}
                  allowDataOverflow={true}
                  stroke="#64748b"
                  tickCount={isZoomed ? 6 : 10}
                  label={{
                    value: comparisonYLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: "#64748b",
                  }}
                />
                <Tooltip
                  cursor={{ stroke: "#334155", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl z-50">
                          <p className="text-slate-300 font-semibold mb-2 border-b border-slate-800 pb-1">
                            Matchday {label}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {payload.map((entry: any, index: number) => (
                              <div
                                key={`item-${index}`}
                                className="flex items-center gap-2 text-sm text-slate-100"
                              >
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-400 shadow-sm flex-shrink-0"
                                  style={{ backgroundColor: entry.color }}
                                ></span>
                                <span className="font-medium">{entry.name}:</span>
                                <span className="font-bold">
                                  {entry.value} {comparisonUnitSuffix}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {activeTeams.map((team, idx) => {
                  const baseColor = getTeamColor(team.id, idx);
                  const metricLabel =
                    activeComparisonMetric === "PTS"
                      ? "PTS"
                      : activeComparisonMetric === "GF"
                      ? "GF"
                      : "GA";

                  return (
                    <React.Fragment key={team.id}>
                      <Line
                        type="monotone"
                        dataKey={`team_${team.id}_current`}
                        name={`${team.shortName} (${metricLabel})`}
                        stroke={baseColor}
                        strokeWidth={3}
                        dot={{ r: 4, fill: baseColor }}
                        connectNulls
                      />
                      {!team.isPromoted && (
                        <>
                          <Line
                            type="monotone"
                            dataKey={`team_${team.id}_baseline`}
                            name={`${team.shortName} (Last Year ${metricLabel})`}
                            stroke={baseColor}
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            dot={{ r: 2 }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey={`team_${team.id}_sameOpponent`}
                            name={`${team.shortName} (Opponents Eq. ${metricLabel})`}
                            stroke={baseColor}
                            strokeWidth={1.5}
                            strokeDasharray="2 3"
                            dot={{ r: 2 }}
                            connectNulls
                          />
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </LineChart>
            ) : (
              <LineChart
                data={teamMetricsChartData}
                margin={{ top: 15, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
                <XAxis
                  dataKey="gamesPlayed"
                  type="number"
                  domain={teamMetricsXDomain}
                  allowDataOverflow={true}
                  stroke="#64748b"
                  tickCount={isZoomed ? (teamMetricsXDomain[1] as number) : 19}
                  label={{
                    value: "Matches Played",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#64748b",
                  }}
                />
                <YAxis
                  type="number"
                  domain={teamMetricsYDomain}
                  allowDataOverflow={true}
                  stroke="#64748b"
                  tickCount={isZoomed ? 6 : 10}
                  label={{
                    value: "Cumulative Total",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#64748b",
                  }}
                />
                <Tooltip
                  cursor={{ stroke: "#334155", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const pointData = payload[0]?.payload as TeamMetricPoint | undefined;
                      return (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl z-50 min-w-[210px]">
                          <div className="border-b border-slate-800 pb-2 mb-2">
                            <p className="text-slate-200 font-bold text-xs uppercase tracking-wider">
                              Matchday {label}
                            </p>
                            {pointData?.score_display && (
                              <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                                {pointData.score_display}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {payload.map((entry: any, index: number) => {
                              const chip = TEAM_METRIC_CHIPS.find(
                                (c) => c.key === entry.dataKey
                              );
                              const formattedVal = chip?.isFloat
                                ? Number(entry.value).toFixed(2)
                                : entry.value;
                              const unit = chip?.unit ? ` ${chip.unit}` : "";

                              return (
                                <div
                                  key={`metric-${index}`}
                                  className="flex items-center justify-between gap-4 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-slate-300 font-medium">
                                      {entry.name}:
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-slate-100">
                                    {formattedVal}
                                    {unit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {TEAM_METRIC_CHIPS.filter((chip) =>
                  activeMetricKeys.includes(chip.key)
                ).map((chip) => (
                  <Line
                    key={chip.key}
                    type="monotone"
                    dataKey={chip.key}
                    name={chip.label}
                    stroke={chip.color}
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: chip.color,
                      stroke: "#0f172a",
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default TrajectoryChart;
