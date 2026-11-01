import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  ComposedChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TeamOption } from "./TeamSelectorBar";
import GenericTeamCrest from "./GenericTeamCrest";
import { getTeamColor } from "../../constants/teamColors";
import { MetricType } from "../../types/trajectory";
import { MetricToggle } from "../charts/MetricToggle";
import { TeamMetricChips } from "../charts/TeamMetricChips";
import {
  fetchTeamMetrics,
  TeamMetricPoint,
  TeamMetricKey,
  MetricChipConfig,
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
export type AxisSide = "left" | "right";

export interface TrajectoryChartProps {
  teams: TeamOption[];
  selectedTeamIds: number[];
  trajectories: TrajectoryDataRow[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onSelectSingleTeam?: (teamId: number) => void;
}

interface PointCoord {
  x: number;
  y: number;
  index: number;
}

/**
 * Semantic Unit Groups for Dual Y-Axis Logic:
 * - Group A (Goals & Value): Goals Scored, Goals Conceded, Cum. xG, Cum. aXG, Points
 * - Group B (Volume & Actions): Shots on Target, Shots off Target, Corners
 * Dual Y-Axes only activate when active metrics span BOTH Group A and Group B.
 */
const GROUP_A_GOALS_AND_VALUE = new Set<TeamMetricKey>([
  "cum_goals",
  "cum_conceded",
  "cum_xg",
  "cum_axg",
  "cum_points",
]);

const GROUP_B_VOLUME_AND_ACTIONS = new Set<TeamMetricKey>([
  "cum_shots_on_target",
  "cum_shots_off_target",
  "cum_corners",
]);

const DEFAULT_METRIC_PEAKS: Record<TeamMetricKey, number> = {
  cum_xg: 10,
  cum_axg: 10,
  cum_goals: 10,
  cum_conceded: 10,
  cum_points: 25,
  cum_shots_on_target: 45,
  cum_shots_off_target: 45,
  cum_corners: 50,
};

/**
 * Classic high-contrast black-and-white stitched Telstar-style football SVG graphic.
 * Includes a subtle outer ring colored to match the parent series line.
 */
const ClassicFootballGraphic: React.FC<{
  r: number;
  seriesColor: string;
  isActive?: boolean;
  spinClassName?: string;
  spinDurationMs?: number;
}> = ({ r, seriesColor, isActive = false, spinClassName, spinDurationMs }) => {
  return (
    <g>
      {/* Outer series-color association halo */}
      <circle
        r={r + 1.6}
        fill="#0f172a"
        stroke={isActive ? "#ffffff" : seriesColor}
        strokeWidth={isActive ? 2.2 : 1.5}
      />
      {/* Classic crisp white leather football sphere */}
      <circle r={r} fill="#f8fafc" stroke="#0f172a" strokeWidth={0.9} />
      {/* Inner stitched seams & black pentagon panels (rotatable during travel) */}
      <g
        className={spinClassName}
        style={
          spinDurationMs
            ? {
                animationDuration: `${spinDurationMs}ms`,
              }
            : undefined
        }
      >
        {/* 5 Stitched Seam Spokes */}
        <line x1={0} y1={-r * 0.42} x2={0} y2={-r * 0.95} stroke="#0f172a" strokeWidth={0.85} />
        <line
          x1={r * 0.4}
          y1={-r * 0.12}
          x2={r * 0.9}
          y2={-r * 0.28}
          stroke="#0f172a"
          strokeWidth={0.85}
        />
        <line
          x1={r * 0.25}
          y1={r * 0.36}
          x2={r * 0.56}
          y2={r * 0.8}
          stroke="#0f172a"
          strokeWidth={0.85}
        />
        <line
          x1={-r * 0.25}
          y1={r * 0.36}
          x2={-r * 0.56}
          y2={r * 0.8}
          stroke="#0f172a"
          strokeWidth={0.85}
        />
        <line
          x1={-r * 0.4}
          y1={-r * 0.12}
          x2={-r * 0.9}
          y2={-r * 0.28}
          stroke="#0f172a"
          strokeWidth={0.85}
        />

        {/* Perimeter Black Pentagon Patches */}
        <path
          d={`M ${-r * 0.28} ${-r * 0.92} Q 0 ${-r * 0.72} ${r * 0.28} ${-r * 0.92} Q 0 ${-r * 1.02} ${-r * 0.28} ${-r * 0.92} Z`}
          fill="#0f172a"
        />
        <path
          d={`M ${r * 0.82} ${-r * 0.48} L ${r * 0.72} ${-r * 0.12} L ${r * 0.95} ${-r * 0.08} Z`}
          fill="#0f172a"
        />
        <path
          d={`M ${-r * 0.82} ${-r * 0.48} L ${-r * 0.72} ${-r * 0.12} L ${-r * 0.95} ${-r * 0.08} Z`}
          fill="#0f172a"
        />
        <path
          d={`M ${r * 0.35} ${r * 0.85} L ${r * 0.65} ${r * 0.62} L ${r * 0.72} ${r * 0.78} Z`}
          fill="#0f172a"
        />
        <path
          d={`M ${-r * 0.35} ${r * 0.85} L ${-r * 0.65} ${r * 0.62} L ${-r * 0.72} ${r * 0.78} Z`}
          fill="#0f172a"
        />

        {/* Iconic Center Black Pentagon */}
        <polygon
          points={`0,${-r * 0.44} ${r * 0.42},${-r * 0.13} ${r * 0.26},${r * 0.38} ${-r * 0.26},${r * 0.38} ${-r * 0.42},${-r * 0.13}`}
          fill="#0f172a"
        />
      </g>
      {/* Subtle 3D Specular Highlight */}
      <circle cx={-r * 0.28} cy={-r * 0.3} r={r * 0.16} fill="#ffffff" opacity={0.65} />
    </g>
  );
};

interface SynchronizedBounceKinematics {
  bouncePath: string;
  keyTimes: string;
  keyPoints: string;
  nodeArrivalRatios: number[];
}

/**
 * Approximates the arc length of a quadratic Bézier curve from P0 -> P1 with control point C.
 */
function estimateQuadraticCurveLength(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number
): number {
  const steps = 10;
  let length = 0;
  let prevX = x0;
  let prevY = y0;

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const inv = 1 - t;
    const bx = inv * inv * x0 + 2 * inv * t * cx + t * t * x1;
    const by = inv * inv * y0 + 2 * inv * t * cy + t * t * y1;
    length += Math.hypot(bx - prevX, by - prevY);
    prevX = bx;
    prevY = by;
  }

  return length;
}

/**
 * Builds a synchronized bounce path and exact SVG `<animateMotion>` `keyTimes` / `keyPoints`
 * tables so the bouncing football is mathematically pinned to the leading tip of the
 * `stroke-dashoffset` line transition at every gameweek node.
 */
function buildSynchronizedBounceKinematics(
  points: PointCoord[]
): SynchronizedBounceKinematics {
  if (points.length === 0) {
    return {
      bouncePath: "",
      keyTimes: "0;1",
      keyPoints: "0;1",
      nodeArrivalRatios: [],
    };
  }

  if (points.length === 1) {
    const p = points[0];
    return {
      bouncePath: `M ${p.x} ${p.y - 16} Q ${p.x} ${p.y - 22} ${p.x} ${p.y}`,
      keyTimes: "0;1",
      keyPoints: "0;1",
      nodeArrivalRatios: [0],
    };
  }

  const bounceApexOffset = 20; // Control point offset (~10px mid-arc vertical bounce)
  const segments: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];

  const cumLineLengths: number[] = [0];
  const cumBounceLengths: number[] = [0];

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];

    // Straight/monotone chord length used by stroke-dashoffset progression
    const segLineLen = Math.max(1, Math.hypot(next.x - curr.x, next.y - curr.y));
    cumLineLengths.push(cumLineLengths[i] + segLineLen);

    // Quadratic Bézier bounce arc between curr and next
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2 - bounceApexOffset;
    segments.push(
      `Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
    );

    const segBounceLen = Math.max(
      1,
      estimateQuadraticCurveLength(curr.x, curr.y, midX, midY, next.x, next.y)
    );
    cumBounceLengths.push(cumBounceLengths[i] + segBounceLen);
  }

  const totalLineLen = cumLineLengths[cumLineLengths.length - 1] || 1;
  const totalBounceLen = cumBounceLengths[cumBounceLengths.length - 1] || 1;

  const nodeArrivalRatios = cumLineLengths.map((len, idx) => {
    if (idx === 0) return 0;
    if (idx === cumLineLengths.length - 1) return 1;
    return len / totalLineLen;
  });

  const bounceDistanceRatios = cumBounceLengths.map((len, idx) => {
    if (idx === 0) return 0;
    if (idx === cumBounceLengths.length - 1) return 1;
    return len / totalBounceLen;
  });

  return {
    bouncePath: segments.join(" "),
    keyTimes: nodeArrivalRatios.map((r) => r.toFixed(4)).join(";"),
    keyPoints: bounceDistanceRatios.map((r) => r.toFixed(4)).join(";"),
    nodeArrivalRatios,
  };
}

/**
 * Computes the intentional, readable draw duration (~250ms per completed fixture, min 2400ms)
 * shared identically by both the Recharts `<Line>` stroke animation and the bouncing football.
 */
function getSeriesAnimDurationMs(
  dataRows: any[],
  dataKey: string,
  maxVisibleGW: number
): number {
  let validCount = 0;
  for (let i = 0; i < Math.min(dataRows.length, maxVisibleGW); i++) {
    const v = dataRows[i]?.[dataKey];
    if (v !== null && v !== undefined && !Number.isNaN(Number(v))) {
      validCount++;
    }
  }
  return Math.max(2400, Math.min(6000, Math.max(1, validCount - 1) * 250));
}

export const TrajectoryChart: React.FC<TrajectoryChartProps> = ({
  teams,
  selectedTeamIds,
  trajectories,
  viewMode: controlledViewMode,
  onViewModeChange,
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

  // Baseline comparison layer toggles in Team Metrics mode
  const [showCurrentProgress, setShowCurrentProgress] = useState<boolean>(true);
  const [showLastYearPace, setShowLastYearPace] = useState<boolean>(false);
  const [showSameOpponents, setShowSameOpponents] = useState<boolean>(false);

  // Animation key counter to trigger progressive line-draw and travelling football bounce
  const [bounceAnimKey, setBounceAnimKey] = useState<number>(1);

  // Coordinate buffer populated synchronously during Recharts dot rendering
  const seriesCoordsRef = useRef<Record<string, PointCoord[]>>({});

  useEffect(() => {
    seriesCoordsRef.current = {};
    setBounceAnimKey((prev) => prev + 1);
  }, [
    viewMode,
    selectedTeamIds,
    activeComparisonMetric,
    activeMetricKeys,
    isZoomed,
  ]);

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
          seriesCoordsRef.current = {};
          setTeamMetrics(data);
          setMetricsLoading(false);
          setBounceAnimKey((prev) => prev + 1);
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

  // Single-metric bar overlay check in Team Metrics mode
  const singleActiveChip = useMemo(() => {
    if (viewMode === "team_metrics" && activeMetricKeys.length === 1) {
      return TEAM_METRIC_CHIPS.find((c) => c.key === activeMetricKeys[0]);
    }
    return undefined;
  }, [viewMode, activeMetricKeys]);

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
  // 2. Team Metrics Mode Chart Data & Semantic Dual Y-Axis Logic
  // ---------------------------------------------------------------------------
  const completedTeamMetricsCount = useMemo(
    () => teamMetrics.filter((pt) => pt.is_completed).length,
    [teamMetrics]
  );

  const maxTeamMetricsGamesPlayed = completedTeamMetricsCount > 0 ? completedTeamMetricsCount : 1;
  const maxVisibleTeamMetricsGW = isZoomed
    ? Math.max(5, Math.min(38, maxTeamMetricsGamesPlayed + 1))
    : 38;

  /**
   * Semantic Dual-Axis Partitioning:
   * - Group A (Goals & Value): cum_goals, cum_conceded, cum_xg, cum_axg, cum_points
   * - Group B (Volume & Actions): cum_shots_on_target, cum_shots_off_target, cum_corners
   * Rule:
   * - If all active metrics belong to the same semantic group (all Group A or all Group B),
   *   keep them on a single unified Left Y-Axis for direct comparison.
   * - Only split onto Left (Group A) and Right (Group B) Y-Axes when active metrics span both groups.
   */
  const metricAxisConfig = useMemo(() => {
    const peakByKey: Record<TeamMetricKey, number> = { ...DEFAULT_METRIC_PEAKS };

    activeMetricKeys.forEach((key) => {
      let maxForKey = 0;
      teamMetrics.forEach((pt) => {
        if (pt.gameweek > maxVisibleTeamMetricsGW) return;
        if (showCurrentProgress && typeof pt[key] === "number") {
          maxForKey = Math.max(maxForKey, pt[key] as number);
        }
        if (showLastYearPace) {
          const baseVal = pt[`${key}_baseline` as keyof TeamMetricPoint];
          if (typeof baseVal === "number") {
            maxForKey = Math.max(maxForKey, baseVal);
          }
        }
        if (showSameOpponents) {
          const eqVal = pt[`${key}_same_opp` as keyof TeamMetricPoint];
          if (typeof eqVal === "number") {
            maxForKey = Math.max(maxForKey, eqVal);
          }
        }
      });

      peakByKey[key] = maxForKey > 0 ? maxForKey : DEFAULT_METRIC_PEAKS[key];
    });

    const groupAKeys = activeMetricKeys.filter((k) => GROUP_A_GOALS_AND_VALUE.has(k));
    const groupBKeys = activeMetricKeys.filter((k) => GROUP_B_VOLUME_AND_ACTIONS.has(k));
    const spansBothGroups = groupAKeys.length > 0 && groupBKeys.length > 0;

    const axisByKey: Record<string, AxisSide> = {};
    let leftKeys: TeamMetricKey[] = [];
    let rightKeys: TeamMetricKey[] = [];

    if (spansBothGroups) {
      // Group A (Goals & Value) on Left Y-Axis, Group B (Volume & Actions) on Right Y-Axis
      leftKeys = groupAKeys;
      rightKeys = groupBKeys;
      leftKeys.forEach((k) => {
        axisByKey[k] = "left";
      });
      rightKeys.forEach((k) => {
        axisByKey[k] = "right";
      });
    } else {
      // All active metrics belong to the same semantic group -> Unified Left Y-Axis
      leftKeys = [...activeMetricKeys];
      rightKeys = [];
      leftKeys.forEach((k) => {
        axisByKey[k] = "left";
      });
    }

    const leftMax =
      leftKeys.length > 0 ? Math.max(...leftKeys.map((k) => peakByKey[k])) : 10;
    const rightMax =
      rightKeys.length > 0 ? Math.max(...rightKeys.map((k) => peakByKey[k])) : 10;

    const leftDomain: [number, number] = [
      0,
      Math.max(5, Math.ceil(leftMax * 1.15)),
    ];
    const rightDomain: [number, number] = [
      0,
      Math.max(5, Math.ceil(rightMax * 1.15)),
    ];

    const leftChips = TEAM_METRIC_CHIPS.filter((c) => leftKeys.includes(c.key));
    const rightChips = TEAM_METRIC_CHIPS.filter((c) => rightKeys.includes(c.key));

    const leftColor = leftChips[0]?.color || "#64748b";
    const rightColor = rightChips[0]?.color || "#64748b";

    const leftLabel =
      leftChips.length > 0
        ? `${leftChips.map((c) => c.shortLabel).join(" · ")} (Cum.)`
        : "Cumulative Total";
    const rightLabel =
      rightChips.length > 0
        ? `${rightChips.map((c) => c.shortLabel).join(" · ")} (Cum.)`
        : "";

    return {
      axisByKey,
      leftKeys,
      rightKeys,
      leftChips,
      rightChips,
      leftDomain,
      rightDomain,
      leftColor,
      rightColor,
      leftLabel,
      rightLabel,
      hasMultiMetricRightAxis: rightKeys.length > 0,
    };
  }, [
    activeMetricKeys,
    teamMetrics,
    maxVisibleTeamMetricsGW,
    showCurrentProgress,
    showLastYearPace,
    showSameOpponents,
  ]);

  const maxSingleMatchMetricValue = useMemo(() => {
    if (!singleActiveChip) return 2;
    let maxMatchVal = 2;
    teamMetrics.forEach((pt) => {
      if (pt.gameweek > maxVisibleTeamMetricsGW) return;
      const rawMatchVal = pt[singleActiveChip.matchKey];
      if (typeof rawMatchVal === "number" && rawMatchVal > maxMatchVal) {
        maxMatchVal = rawMatchVal;
      }
    });
    return maxMatchVal;
  }, [teamMetrics, maxVisibleTeamMetricsGW, singleActiveChip]);

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
  // 3. Domains, Animation Timing & Helper Renderers
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
    ? [1, maxVisibleTeamMetricsGW]
    : [1, 38];

  const singleMatchRightYDomain: [number, number] = [
    0,
    Math.max(4, Math.ceil(maxSingleMatchMetricValue * 1.45)),
  ];

  /**
   * Renders each gameweek node's classic B&W football and, upon reaching the final
   * visible completed node for that series, renders the travelling/bouncing football
   * synchronized via `keyTimes` / `keyPoints` to the exact `stroke-dashoffset` progression.
   */
  const renderFootballNode = (
    dotProps: any,
    seriesId: string,
    seriesColor: string,
    maxVisibleGW: number,
    dataRows: any[],
    dataKey: string,
    totalDurationMs: number
  ) => {
    const { cx, cy, index, value } = dotProps;
    if (
      typeof cx !== "number" ||
      typeof cy !== "number" ||
      Number.isNaN(cx) ||
      Number.isNaN(cy) ||
      value === null ||
      value === undefined
    ) {
      return <g key={`empty-${seriesId}-${index}`} />;
    }

    const gameweek = index + 1;
    if (gameweek > maxVisibleGW) {
      return <g key={`clipped-${seriesId}-${index}`} />;
    }

    // Determine all valid visible indices for this series
    const validIndices: number[] = [];
    for (let i = 0; i < Math.min(dataRows.length, maxVisibleGW); i++) {
      const v = dataRows[i]?.[dataKey];
      if (v !== null && v !== undefined && !Number.isNaN(Number(v))) {
        validIndices.push(i);
      }
    }

    if (validIndices.length === 0) {
      return <g key={`no-valid-${seriesId}-${index}`} />;
    }

    const firstValidIndex = validIndices[0];
    const lastValidIndex = validIndices[validIndices.length - 1];
    const totalPoints = validIndices.length;
    const pointOrder = validIndices.indexOf(index);

    // Record pixel coordinate for this series
    if (index === firstValidIndex || !seriesCoordsRef.current[seriesId]) {
      seriesCoordsRef.current[seriesId] = [];
    }
    seriesCoordsRef.current[seriesId].push({ x: cx, y: cy, index });

    const recordedPoints = seriesCoordsRef.current[seriesId] || [];

    // Compute cumulative chord length ratio up to this node so it unlocks right as the line tip arrives
    let arrivalRatio = totalPoints > 1 ? pointOrder / (totalPoints - 1) : 0;
    if (recordedPoints.length > 1 && pointOrder > 0) {
      let partialLen = 0;
      for (let i = 0; i < recordedPoints.length - 1; i++) {
        partialLen += Math.hypot(
          recordedPoints[i + 1].x - recordedPoints[i].x,
          recordedPoints[i + 1].y - recordedPoints[i].y
        );
      }
      const avgSegLen = partialLen / (recordedPoints.length - 1);
      const estTotalLen = Math.max(1, avgSegLen * (totalPoints - 1));
      arrivalRatio = Math.min(1, partialLen / estTotalLen);
    }

    const revealDelayMs = Math.round(arrivalRatio * totalDurationMs);
    const isFinalNode = index === lastValidIndex;

    const kinematics = isFinalNode
      ? buildSynchronizedBounceKinematics(recordedPoints)
      : null;

    return (
      <g key={`fb-series-${seriesId}-${bounceAnimKey}-${index}`}>
        {/* Static anchored B&W football revealed at the exact millisecond the line tip + ball arrive */}
        <g
          transform={`translate(${cx}, ${cy})`}
          className="football-node-reveal"
          style={{
            animationDelay: `${revealDelayMs}ms`,
          }}
        >
          <ClassicFootballGraphic r={5.8} seriesColor={seriesColor} />
        </g>

        {/* Lead travelling B&W football pinned to the leading edge of the drawing line */}
        {isFinalNode && kinematics && kinematics.bouncePath && (
          <g
            className="football-traveller-wrapper"
            style={{
              animationDuration: `${totalDurationMs + 250}ms`,
            }}
          >
            <animateMotion
              dur={`${totalDurationMs}ms`}
              repeatCount="1"
              fill="freeze"
              calcMode="linear"
              keyTimes={kinematics.keyTimes}
              keyPoints={kinematics.keyPoints}
              path={kinematics.bouncePath}
            />
            <ClassicFootballGraphic
              r={6.8}
              seriesColor={seriesColor}
              spinClassName="football-travel-spin"
              spinDurationMs={totalDurationMs}
            />
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="w-full flex flex-col p-4 bg-slate-950">
      {/* Keyframes for progressive node reveal & spinning/bouncing travelling football (CLS = 0) */}
      <style>{`
        @keyframes footballNodeReveal {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          65% {
            opacity: 1;
            transform: scale(1.18);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes footballTravelSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(1080deg);
          }
        }
        @keyframes footballTravellerFade {
          0%, 92% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .football-node-reveal > g {
          transform-box: fill-box;
          transform-origin: center;
          animation: footballNodeReveal 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: inherit;
        }
        .football-travel-spin {
          transform-box: fill-box;
          transform-origin: center;
          animation: footballTravelSpin 2400ms linear 1 forwards;
        }
        .football-traveller-wrapper {
          pointer-events: none;
          animation: footballTravellerFade 2650ms ease-out 1 forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .football-node-reveal > g,
          .football-travel-spin {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .football-traveller-wrapper {
            display: none !important;
          }
        }
      `}</style>

      {/* High-Level View Mode Switcher Pill */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-900 mb-4">
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-sm">
          <button
            type="button"
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
            type="button"
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
            type="button"
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
            {/* Active Club Badge (Selected via the unified TeamSelectorBar above) */}
            {primaryTeam && (
              <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg">
                <GenericTeamCrest team={primaryTeam} size={24} />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100">
                    {primaryTeam.name}
                  </span>
                  {primaryTeam.isPromoted && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Promoted
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Comparison Baseline Layer Checkboxes */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-400 font-semibold">Baselines:</span>
              <label className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-200 cursor-pointer select-none hover:border-slate-600 transition-colors">
                <input
                  type="checkbox"
                  checked={showCurrentProgress}
                  onChange={(e) => setShowCurrentProgress(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                />
                <span className="font-medium">Current Progress</span>
              </label>

              <label
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-200 select-none transition-colors ${
                  primaryTeam?.isPromoted
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:border-slate-600"
                }`}
                title={
                  primaryTeam?.isPromoted
                    ? "Promoted club has no prior Premier League baseline"
                    : "Same Gameweek Stage in previous season"
                }
              >
                <input
                  type="checkbox"
                  checked={showLastYearPace && !primaryTeam?.isPromoted}
                  disabled={Boolean(primaryTeam?.isPromoted)}
                  onChange={(e) => setShowLastYearPace(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="font-medium">Last Year&apos;s Pace</span>
              </label>

              <label
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-200 select-none transition-colors ${
                  primaryTeam?.isPromoted
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:border-slate-600"
                }`}
                title={
                  primaryTeam?.isPromoted
                    ? "Promoted club has no prior Premier League baseline"
                    : "Equivalent Opponents in previous season via relegated_replacements"
                }
              >
                <input
                  type="checkbox"
                  checked={showSameOpponents && !primaryTeam?.isPromoted}
                  disabled={Boolean(primaryTeam?.isPromoted)}
                  onChange={(e) => setShowSameOpponents(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="font-medium">Same Opponents</span>
              </label>
            </div>

            {/* Quick Series Actions */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                onClick={handleResetMetrics}
                className="hover:text-slate-200 hover:underline transition-colors"
              >
                Reset Defaults
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
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
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-slate-200 inline-block"></span>
            <span>Current Progress (⚽ Classic B&amp;W Football Nodes)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-400 inline-block"></span>
            <span>Last Year&apos;s Pace</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-t-2 border-dotted border-slate-400 inline-block"></span>
            <span>Same Opponents</span>
          </div>
          {singleActiveChip && (
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3 rounded-sm inline-block border"
                style={{
                  backgroundColor: `${singleActiveChip.color}40`,
                  borderColor: singleActiveChip.color,
                }}
              />
              <span className="text-slate-300 font-medium">
                Per-Game {singleActiveChip.shortLabel} (Right Axis Bars)
              </span>
            </div>
          )}
          {viewMode === "team_metrics" && metricAxisConfig.hasMultiMetricRightAxis && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg">
              <span className="text-slate-400 font-semibold">Left Axis (Goals &amp; Value):</span>
              {metricAxisConfig.leftChips.map((c: MetricChipConfig) => (
                <span key={c.key} className="font-bold" style={{ color: c.color }}>
                  {c.shortLabel}
                </span>
              ))}
              <span className="text-slate-600">|</span>
              <span className="text-slate-400 font-semibold">Right Axis (Volume &amp; Actions):</span>
              {metricAxisConfig.rightChips.map((c: MetricChipConfig) => (
                <span key={c.key} className="font-bold" style={{ color: c.color }}>
                  {c.shortLabel}
                </span>
              ))}
            </div>
          )}
        </div>

        {viewMode === "team_metrics" && (
          <div className="flex flex-wrap items-center gap-2 text-slate-400 text-[11px]">
            <span className="font-semibold text-slate-200">{primaryTeam?.name}</span>
            <span>•</span>
            <span>
              {completedTeamMetricsCount} completed fixtures from{" "}
              <code className="text-emerald-400 font-mono text-[11px]">match_raw_stats</code>
            </span>
            <span>•</span>
            <span className="text-slate-500 italic">
              {activeMetricKeys.length} series active
            </span>
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

        {viewMode === "team_metrics" &&
        (activeMetricKeys.length === 0 ||
          (!showCurrentProgress &&
            (!showLastYearPace || primaryTeam?.isPromoted) &&
            (!showSameOpponents || primaryTeam?.isPromoted))) ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <p className="text-base font-medium text-slate-400 mb-1">
              {activeMetricKeys.length === 0
                ? "No metrics active"
                : "No comparison baseline selected"}
            </p>
            <p className="text-xs">
              {activeMetricKeys.length === 0
                ? "Click one or more chips above to render data lines on the chart."
                : "Check at least one baseline toggle above (e.g. Current Progress) to display curves."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "comparison" ? (
              <LineChart
                key={`comp-chart-${bounceAnimKey}`}
                data={comparisonChartData}
                margin={{ top: 18, right: 30, left: 10, bottom: 20 }}
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
                  const dataKey = `team_${team.id}_current`;
                  const maxVisibleCompGW = comparisonXDomain[1] as number;
                  const seriesDurationMs = getSeriesAnimDurationMs(
                    comparisonChartData,
                    dataKey,
                    maxVisibleCompGW
                  );

                  return (
                    <React.Fragment key={team.id}>
                      <Line
                        type="monotone"
                        dataKey={dataKey}
                        name={`${team.shortName} (${metricLabel})`}
                        stroke={baseColor}
                        strokeWidth={3}
                        isAnimationActive={true}
                        animationDuration={seriesDurationMs}
                        animationEasing="linear"
                        dot={(dotProps: any) =>
                          renderFootballNode(
                            dotProps,
                            `comp-${team.id}`,
                            baseColor,
                            maxVisibleCompGW,
                            comparisonChartData,
                            dataKey,
                            seriesDurationMs
                          )
                        }
                        activeDot={(dotProps: any) => {
                          if (
                            typeof dotProps.cx !== "number" ||
                            typeof dotProps.cy !== "number"
                          ) {
                            return <g />;
                          }
                          return (
                            <g transform={`translate(${dotProps.cx}, ${dotProps.cy})`}>
                              <ClassicFootballGraphic
                                r={7.5}
                                seriesColor={baseColor}
                                isActive={true}
                              />
                            </g>
                          );
                        }}
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
              <ComposedChart
                key={`metrics-chart-${bounceAnimKey}`}
                data={teamMetricsChartData}
                margin={{
                  top: 18,
                  right:
                    singleActiveChip || metricAxisConfig.hasMultiMetricRightAxis ? 52 : 30,
                  left: 14,
                  bottom: 20,
                }}
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

                {/* Left Y-Axis: Color-matched to Left metric group */}
                <YAxis
                  yAxisId="left"
                  type="number"
                  domain={metricAxisConfig.leftDomain}
                  allowDataOverflow={true}
                  stroke={metricAxisConfig.leftColor}
                  tick={{
                    fill: metricAxisConfig.leftColor,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  tickCount={isZoomed ? 6 : 8}
                  label={{
                    value: metricAxisConfig.leftLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: metricAxisConfig.leftColor,
                    style: { fontSize: 11, fontWeight: 700 },
                  }}
                />

                {/* Right Y-Axis (Mode A): Single-Metric Per-Match Bar Scale */}
                {singleActiveChip && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    type="number"
                    domain={singleMatchRightYDomain}
                    allowDataOverflow={true}
                    stroke={singleActiveChip.color}
                    tick={{
                      fill: singleActiveChip.color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                    tickCount={5}
                    label={{
                      value: `Per Match (${singleActiveChip.shortLabel})`,
                      angle: 90,
                      position: "insideRight",
                      fill: singleActiveChip.color,
                      style: { fontSize: 11, fontWeight: 700 },
                    }}
                  />
                )}

                {/* Right Y-Axis (Mode B): Semantic Group B (Volume & Actions) Cumulative Scale */}
                {!singleActiveChip && metricAxisConfig.hasMultiMetricRightAxis && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    type="number"
                    domain={metricAxisConfig.rightDomain}
                    allowDataOverflow={true}
                    stroke={metricAxisConfig.rightColor}
                    tick={{
                      fill: metricAxisConfig.rightColor,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                    tickCount={isZoomed ? 6 : 8}
                    label={{
                      value: metricAxisConfig.rightLabel,
                      angle: 90,
                      position: "insideRight",
                      fill: metricAxisConfig.rightColor,
                      style: { fontSize: 11, fontWeight: 700 },
                    }}
                  />
                )}

                <Tooltip
                  cursor={{ stroke: "#334155", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const pointData = payload[0]?.payload as TeamMetricPoint | undefined;
                      return (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl z-50 min-w-[240px]">
                          <div className="border-b border-slate-800 pb-2 mb-2 flex flex-col gap-0.5">
                            <p className="text-slate-200 font-bold text-xs uppercase tracking-wider">
                              Matchday {label}
                            </p>
                            {pointData?.score_display && (
                              <p className="text-xs font-semibold text-emerald-400">
                                Current: {pointData.score_display}
                              </p>
                            )}
                            {showLastYearPace && pointData?.baseline_score_display && (
                              <p className="text-[11px] text-slate-400">
                                Last Year GW {label}: {pointData.baseline_score_display}
                              </p>
                            )}
                            {showSameOpponents && pointData?.same_opp_score_display && (
                              <p className="text-[11px] text-slate-400">
                                Opponents Eq.: {pointData.same_opp_score_display}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {payload.map((entry: any, index: number) => {
                              const rawKey = String(entry.dataKey || "");
                              const baseKey = rawKey.replace(/(_baseline|_same_opp)$/, "") as TeamMetricKey;
                              const chip =
                                TEAM_METRIC_CHIPS.find((c) => c.key === baseKey) ||
                                TEAM_METRIC_CHIPS.find((c) => c.matchKey === rawKey);
                              const formattedVal = chip?.isFloat
                                ? Number(entry.value).toFixed(2)
                                : entry.value;
                              const unit = chip?.unit ? ` ${chip.unit}` : "";
                              const axisSide =
                                metricAxisConfig.hasMultiMetricRightAxis && chip
                                  ? metricAxisConfig.axisByKey[chip.key] === "right"
                                    ? " (R)"
                                    : " (L)"
                                  : "";

                              return (
                                <div
                                  key={`metric-${index}`}
                                  className="flex items-center justify-between gap-4 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0"
                                      style={{ backgroundColor: entry.color || chip?.color }}
                                    />
                                    <span className="text-slate-300 font-medium">
                                      {entry.name}
                                      {axisSide}:
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

                {/* Semi-transparent Per-Gameweek Bar Overlay when 1 metric is selected */}
                {singleActiveChip && (
                  <Bar
                    yAxisId="right"
                    dataKey={singleActiveChip.matchKey}
                    name={`Matchday ${singleActiveChip.shortLabel}`}
                    fill={singleActiveChip.color}
                    fillOpacity={0.25}
                    stroke={singleActiveChip.color}
                    strokeOpacity={0.48}
                    strokeWidth={1}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                    isAnimationActive={true}
                    animationDuration={1200}
                  />
                )}

                {TEAM_METRIC_CHIPS.filter((chip) =>
                  activeMetricKeys.includes(chip.key)
                ).map((chip) => {
                  const axisId: AxisSide =
                    metricAxisConfig.axisByKey[chip.key] || "left";
                  const maxVisibleGW = teamMetricsXDomain[1] as number;
                  const seriesDurationMs = getSeriesAnimDurationMs(
                    teamMetricsChartData,
                    chip.key,
                    maxVisibleGW
                  );

                  return (
                    <React.Fragment key={chip.key}>
                      {showCurrentProgress && (
                        <Line
                          yAxisId={axisId}
                          type="monotone"
                          dataKey={chip.key}
                          name={`${chip.label} (Current)`}
                          stroke={chip.color}
                          strokeWidth={2.5}
                          strokeDasharray="0"
                          isAnimationActive={true}
                          animationDuration={seriesDurationMs}
                          animationEasing="linear"
                          dot={(dotProps: any) =>
                            renderFootballNode(
                              dotProps,
                              `metric-${chip.key}`,
                              chip.color,
                              maxVisibleGW,
                              teamMetricsChartData,
                              chip.key,
                              seriesDurationMs
                            )
                          }
                          activeDot={(dotProps: any) => {
                            if (
                              typeof dotProps.cx !== "number" ||
                              typeof dotProps.cy !== "number"
                            ) {
                              return <g />;
                            }
                            return (
                              <g transform={`translate(${dotProps.cx}, ${dotProps.cy})`}>
                                <ClassicFootballGraphic
                                  r={7.5}
                                  seriesColor={chip.color}
                                  isActive={true}
                                />
                              </g>
                            );
                          }}
                          connectNulls
                        />
                      )}
                      {showLastYearPace && !primaryTeam?.isPromoted && (
                        <Line
                          yAxisId={axisId}
                          type="monotone"
                          dataKey={`${chip.key}_baseline`}
                          name={`${chip.label} (Last Year)`}
                          stroke={chip.color}
                          strokeWidth={1.5}
                          strokeDasharray="5 5"
                          strokeOpacity={0.75}
                          dot={{ r: 2, fill: chip.color }}
                          connectNulls
                        />
                      )}
                      {showSameOpponents && !primaryTeam?.isPromoted && (
                        <Line
                          yAxisId={axisId}
                          type="monotone"
                          dataKey={`${chip.key}_same_opp`}
                          name={`${chip.label} (Opponents Eq.)`}
                          stroke={chip.color}
                          strokeWidth={1.5}
                          strokeDasharray="2 2"
                          strokeOpacity={0.65}
                          dot={{ r: 2, fill: chip.color }}
                          connectNulls
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default TrajectoryChart;
