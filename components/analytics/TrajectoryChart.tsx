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

export interface TrajectoryDataRow {
  team_id: number;
  games_played: number;
  current_points: number;
  last_year_points: number | null;
  same_opponent_points: number | null;
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

  // 1. Calculate the furthest game played among selected teams
  const { maxGamesPlayed, maxPoints } = useMemo(() => {
    let maxGP = 1;
    let maxPts = 3;

    trajectories.forEach((traj) => {
      if (!selectedTeamIds.includes(traj.team_id)) return;

      if (traj.games_played > maxGP) {
        maxGP = traj.games_played;
      }

      const pts = Math.max(
        traj.current_points ?? 0,
        traj.last_year_points ?? 0,
        traj.same_opponent_points ?? 0
      );

      if (pts > maxPts) {
        maxPts = pts;
      }
    });

    return { maxGamesPlayed: maxGP, maxPoints: maxPts };
  }, [trajectories, selectedTeamIds]);

  // 2. Format data for Recharts (38 matchday slots)
  const chartData = useMemo(() => {
    const slots = Array.from({ length: 38 }, (_, i) => ({
      gamesPlayed: i + 1,
    }));

    trajectories.forEach((traj) => {
      if (!selectedTeamIds.includes(traj.team_id)) return;
      const index = traj.games_played - 1;
      if (slots[index]) {
        // @ts-ignore
        slots[index][`team_${traj.team_id}_current`] = traj.current_points;
        if (traj.last_year_points !== null) {
          // @ts-ignore
          slots[index][`team_${traj.team_id}_lastYear`] = traj.last_year_points;
        }
        if (traj.same_opponent_points !== null) {
          // @ts-ignore
          slots[index][`team_${traj.team_id}_sameOpponent`] = traj.same_opponent_points;
        }
      }
    });

    return slots;
  }, [trajectories, selectedTeamIds]);

  const activeTeams = useMemo(() => {
    return teams.filter((t) => selectedTeamIds.includes(t.id));
  }, [teams, selectedTeamIds]);

  // Dynamic scale limits
  const xDomain = isZoomed
    ? [1, Math.max(5, Math.min(38, maxGamesPlayed + 1))]
    : [1, 38];

  const yDomain = isZoomed
    ? [0, Math.max(9, maxPoints + 3)]
    : [0, 114];

  return (
    <div className="w-full h-full flex flex-col p-4 bg-slate-950">
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
              ? `Zoomed: GW 1–${xDomain[1]} | Max: ${yDomain[1]} pts`
              : "Max: 114 pts (38 Matchdays)"}
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
                value: "Points",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: "0.5rem",
                color: "#f8fafc",
              }}
            />

            {activeTeams.map((team, idx) => {
              const color = getTeamColor(team.id, idx);

              return (
                <React.Fragment key={team.id}>
                  {/* 1. Solid: Current Progress */}
                  <Line
                    type="monotone"
                    dataKey={`team_${team.id}_current`}
                    name={`${team.shortName} (Current)`}
                    stroke={color}
                    strokeWidth={3}
                    dot={{ r: 4, fill: color }}
                    connectNulls
                  />

                  {/* 2 & 3: Historical lines omitted for promoted clubs */}
                  {!team.isPromoted && (
                    <>
                      {/* Dashed: Last Year's Progress */}
                      <Line
                        type="monotone"
                        dataKey={`team_${team.id}_lastYear`}
                        name={`${team.shortName} (Last Year)`}
                        stroke={color}
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={{ r: 2 }}
                        connectNulls
                      />

                      {/* Dotted: Same Opponents Baseline */}
                      <Line
                        type="monotone"
                        dataKey={`team_${team.id}_sameOpponent`}
                        name={`${team.shortName} (Opponents Eq.)`}
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
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrajectoryChart;