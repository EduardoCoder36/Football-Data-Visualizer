import React, { useMemo, useState } from "react";
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

export interface TrajectoryChartProps {
  teams: TeamOption[];
  selectedTeamIds: number[];
  trajectories: TrajectoryDataRow[];
}

export const TrajectoryChart: React.FC<TrajectoryChartProps> = ({
  teams,
  selectedTeamIds,
  trajectories,
}) => {
  const [isZoomed, setIsZoomed] = useState(true);
  const [activeMetric, setActiveMetric] = useState<MetricType>("PTS");

  // 1. Calculate the furthest game played among selected teams and the maximum metric value
  const { maxGamesPlayed, maxMetricValue } = useMemo(() => {
    let maxGP = 1;
    let maxVal = activeMetric === "PTS" ? 3 : 2;

    trajectories.forEach((traj) => {
      if (!selectedTeamIds.includes(traj.team_id)) return;

      if (traj.games_played > maxGP) {
        maxGP = traj.games_played;
      }

      let val = 0;
      if (activeMetric === "PTS") {
        val = Math.max(
          traj.cumulative_points ?? 0,
          traj.baseline_points ?? 0,
          traj.same_opponent_points ?? 0
        );
      } else if (activeMetric === "GF") {
        val = Math.max(
          traj.cumulative_goals_for ?? 0,
          traj.baseline_goals_for ?? 0,
          traj.same_opponent_goals_for ?? 0
        );
      } else if (activeMetric === "GA") {
        val = Math.max(
          traj.cumulative_goals_against ?? 0,
          traj.baseline_goals_against ?? 0,
          traj.same_opponent_goals_against ?? 0
        );
      } else if (activeMetric === "COMBINED") {
        val = Math.max(
          traj.cumulative_goals_for ?? 0,
          traj.baseline_goals_for ?? 0,
          traj.same_opponent_goals_for ?? 0,
          traj.cumulative_goals_against ?? 0,
          traj.baseline_goals_against ?? 0,
          traj.same_opponent_goals_against ?? 0
        );
      }

      if (val > maxVal) {
        maxVal = val;
      }
    });

    return { maxGamesPlayed: maxGP, maxMetricValue: maxVal };
  }, [trajectories, selectedTeamIds, activeMetric]);

  // 2. Format data for Recharts (38 matchday slots)
  const chartData = useMemo(() => {
    const slots = Array.from({ length: 38 }, (_, i) => ({
      gamesPlayed: i + 1,
    }));

    trajectories.forEach((traj) => {
      if (!selectedTeamIds.includes(traj.team_id)) return;
      const index = traj.games_played - 1;
      if (slots[index]) {
        if (activeMetric === "PTS") {
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
        } else if (activeMetric === "GF") {
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
        } else if (activeMetric === "GA") {
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
        } else if (activeMetric === "COMBINED") {
          // @ts-ignore
          slots[index][`team_${traj.team_id}_currentGF`] = traj.cumulative_goals_for;
          if (traj.baseline_goals_for !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_baselineGF`] = traj.baseline_goals_for;
          }
          if (traj.same_opponent_goals_for !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_sameOpponentGF`] = traj.same_opponent_goals_for;
          }
          // @ts-ignore
          slots[index][`team_${traj.team_id}_currentGA`] = traj.cumulative_goals_against;
          if (traj.baseline_goals_against !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_baselineGA`] = traj.baseline_goals_against;
          }
          if (traj.same_opponent_goals_against !== null) {
            // @ts-ignore
            slots[index][`team_${traj.team_id}_sameOpponentGA`] = traj.same_opponent_goals_against;
          }
        }
      }
    });

    return slots;
  }, [trajectories, selectedTeamIds, activeMetric]);

  const activeTeams = useMemo(() => {
    return teams.filter((t) => selectedTeamIds.includes(t.id));
  }, [teams, selectedTeamIds]);

  // Dynamic scale limits
  const xDomain = isZoomed
    ? [1, Math.max(5, Math.min(38, maxGamesPlayed + 1))]
    : [1, 38];

  const yDomain: any = isZoomed
    ? [0, Math.max(activeMetric === "PTS" ? 9 : 3, maxMetricValue + Math.ceil(maxMetricValue * 0.1))]
    : [0, 'auto'];

  const yLabel = activeMetric === "PTS" ? "Points" : activeMetric === "COMBINED" ? "Goals" : activeMetric === "GF" ? "Goals Scored" : "Goals Conceded";
  const unitSuffix = activeMetric === "PTS" ? "pts" : "goals";

  return (
    <div className="w-full h-full flex flex-col p-4 bg-slate-950">
      <div className="mb-4">
        <MetricToggle selectedMetric={activeMetric} onChange={setActiveMetric} />
      </div>

      {/* Legend & Controls Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between pb-3 text-xs text-slate-400 border-b border-slate-900 mb-2">
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

        {/* Zoom & Full View Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsZoomed((prev) => !prev)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition"
          >
            {isZoomed ? "Switch to Full Season (38 GW)" : "Zoom to Current Matchday"}
          </button>
          <span className="text-slate-500 italic">
            {isZoomed
              ? `Zoomed: GW 1–${xDomain[1]} | Max: ${yDomain[1]} ${unitSuffix}`
              : `Max: Auto (38 Matchdays)`}
          </span>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="w-full h-[650px] min-h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
            <XAxis
              dataKey="gamesPlayed"
              type="number"
              domain={xDomain}
              allowDataOverflow={true}
              stroke="#64748b"
              tickCount={isZoomed ? (xDomain[1] as number) : 19}
              label={{
                value: "Matches Played",
                position: "insideBottom",
                offset: -10,
                fill: "#64748b",
              }}
            />
            <YAxis
              type="number"
              domain={yDomain}
              allowDataOverflow={true}
              stroke="#64748b"
              tickCount={isZoomed ? 6 : 10}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
              }}
            />
            <Tooltip
              cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl z-50">
                      <p className="text-slate-300 font-semibold mb-2 border-b border-slate-800 pb-1">
                        Matchday {label}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {payload.map((entry: any, index: number) => (
                          <div key={`item-${index}`} className="flex items-center gap-2 text-sm text-slate-100">
                            <span
                              className="w-3 h-3 rounded-full border border-slate-400 shadow-sm flex-shrink-0"
                              style={{ backgroundColor: entry.color }}
                            ></span>
                            <span className="font-medium">{entry.name}:</span>
                            <span className="font-bold">{entry.value} {unitSuffix}</span>
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
              const gfColor = activeMetric === "COMBINED" ? "#10b981" : baseColor;
              const gaColor = activeMetric === "COMBINED" ? "#f43f5e" : baseColor;

              const renderLines = (
                suffix: string,
                color: string,
                currentLabel: string,
                baselineLabel: string,
                opponentLabel: string
              ) => (
                <React.Fragment key={`${team.id}_${suffix}`}>
                  <Line
                    type="monotone"
                    dataKey={`team_${team.id}_current${suffix}`}
                    name={`${team.shortName} (${currentLabel})`}
                    stroke={color}
                    strokeWidth={3}
                    dot={{ r: 4, fill: color }}
                    connectNulls
                  />
                  {!team.isPromoted && (
                    <>
                      <Line
                        type="monotone"
                        dataKey={`team_${team.id}_baseline${suffix}`}
                        name={`${team.shortName} (${baselineLabel})`}
                        stroke={color}
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={{ r: 2 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey={`team_${team.id}_sameOpponent${suffix}`}
                        name={`${team.shortName} (${opponentLabel})`}
                        stroke={color}
                        strokeWidth={1.5}
                        strokeDasharray="2 3"
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    </>
                  )}
                </React.Fragment>
              );

              if (activeMetric === "COMBINED") {
                return (
                  <React.Fragment key={team.id}>
                    {renderLines("GF", gfColor, "Current GF", "Last Year GF", "Opponents Eq. GF")}
                    {renderLines("GA", gaColor, "Current GA", "Last Year GA", "Opponents Eq. GA")}
                  </React.Fragment>
                );
              } else if (activeMetric === "GF") {
                return renderLines("", gfColor, "Current GF", "Last Year GF", "Opponents Eq. GF");
              } else if (activeMetric === "GA") {
                return renderLines("", gaColor, "Current GA", "Last Year GA", "Opponents Eq. GA");
              } else {
                return renderLines("", baseColor, "Current", "Last Year", "Opponents Eq.");
              }
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrajectoryChart;