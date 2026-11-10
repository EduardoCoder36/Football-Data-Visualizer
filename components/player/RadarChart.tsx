'use client';

import React, { useId } from 'react';
import { PlayerRatingsData } from '@/lib/queries/players';

export interface RadarChartProps {
  ratings: Pick<
    PlayerRatingsData,
    | 'radar_shooting'
    | 'radar_passing'
    | 'radar_dribbling'
    | 'radar_defending'
    | 'radar_physical'
    | 'radar_aerial'
  >;
  playerName?: string;
}

interface RadarVertex {
  key: keyof RadarChartProps['ratings'];
  label: string;
  shortLabel: string;
  angleDeg: number;
  value: number;
}

const REFERENCE_RINGS = [25, 50, 75, 100];

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Number((cx + radius * Math.cos(angleRad)).toFixed(2)),
    y: Number((cy + radius * Math.sin(angleRad)).toFixed(2)),
  };
}

export const RadarChart: React.FC<RadarChartProps> = ({ ratings, playerName }) => {
  const chartId = useId();
  const titleId = `${chartId}-title`;
  const descId = `${chartId}-desc`;

  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 104;
  const labelRadius = 136;

  const clampVal = (v: number) => Math.max(0, Math.min(100, Math.round(v || 0)));

  const vertices: RadarVertex[] = [
    {
      key: 'radar_shooting',
      label: 'Shooting',
      shortLabel: 'SHT',
      angleDeg: 0,
      value: clampVal(ratings.radar_shooting),
    },
    {
      key: 'radar_passing',
      label: 'Passing',
      shortLabel: 'PAS',
      angleDeg: 60,
      value: clampVal(ratings.radar_passing),
    },
    {
      key: 'radar_dribbling',
      label: 'Dribbling',
      shortLabel: 'DRI',
      angleDeg: 120,
      value: clampVal(ratings.radar_dribbling),
    },
    {
      key: 'radar_defending',
      label: 'Defending',
      shortLabel: 'DEF',
      angleDeg: 180,
      value: clampVal(ratings.radar_defending),
    },
    {
      key: 'radar_physical',
      label: 'Physical',
      shortLabel: 'PHY',
      angleDeg: 240,
      value: clampVal(ratings.radar_physical),
    },
    {
      key: 'radar_aerial',
      label: 'Aerial',
      shortLabel: 'AER',
      angleDeg: 300,
      value: clampVal(ratings.radar_aerial),
    },
  ];

  // Build points string for a given scale (0-100)
  const buildRingPolygon = (ringValue: number): string => {
    const r = (ringValue / 100) * maxRadius;
    return vertices
      .map((v) => {
        const pt = polarToCartesian(cx, cy, r, v.angleDeg);
        return `${pt.x},${pt.y}`;
      })
      .join(' ');
  };

  // Player polygon points
  const playerPoints = vertices.map((v) => {
    const r = (v.value / 100) * maxRadius;
    return {
      ...v,
      ...polarToCartesian(cx, cy, r, v.angleDeg),
      labelPos: polarToCartesian(cx, cy, labelRadius, v.angleDeg),
      axisEnd: polarToCartesian(cx, cy, maxRadius, v.angleDeg),
    };
  });

  const playerPolygonPoints = playerPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <section
      aria-labelledby={`${chartId}-heading`}
      className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 sm:p-6 backdrop-blur-md shadow-lg"
    >
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div>
          <h2
            id={`${chartId}-heading`}
            className="text-base font-bold tracking-tight text-zinc-100"
          >
            Tactical Profile Radar
          </h2>
          <p className="text-xs text-zinc-400">
            Positional cohort percentile macro-vertices (1–100)
          </p>
        </div>
        <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-400">
          6-Axis FM Polygon
        </span>
      </div>

      <div className="flex flex-col items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="h-auto w-full max-w-[340px] select-none overflow-visible"
        >
          <title id={titleId}>
            {playerName ? `${playerName} 6-Axis Attribute Radar` : '6-Axis Attribute Radar'}
          </title>
          <desc id={descId}>
            {vertices.map((v) => `${v.label}: ${v.value}`).join(', ')}
          </desc>

          {/* Concentric Reference Hexagons at 25, 50, 75, 100 */}
          {REFERENCE_RINGS.map((ring) => (
            <g key={ring}>
              <polygon
                points={buildRingPolygon(ring)}
                fill={ring === 100 ? 'rgba(24, 24, 27, 0.45)' : 'none'}
                stroke={ring === 50 ? 'rgba(161, 161, 170, 0.28)' : 'rgba(113, 113, 122, 0.2)'}
                strokeWidth={ring === 100 ? 1.25 : 1}
                strokeDasharray={ring === 50 ? '3 3' : undefined}
              />
              {/* Ring scale label along top axis */}
              <text
                x={cx + 4}
                y={cy - (ring / 100) * maxRadius + 10}
                className="fill-zinc-500 font-mono text-[9px]"
              >
                {ring}
              </text>
            </g>
          ))}

          {/* Spoke Axis Lines from Center to Vertices */}
          {playerPoints.map((pt) => (
            <line
              key={`axis-${pt.key}`}
              x1={cx}
              y1={cy}
              x2={pt.axisEnd.x}
              y2={pt.axisEnd.y}
              stroke="rgba(113, 113, 122, 0.25)"
              strokeWidth="1"
            />
          ))}

          {/* Player Polygon */}
          <polygon
            points={playerPolygonPoints}
            fill="rgba(59, 130, 246, 0.25)"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Player Vertex Nodes */}
          {playerPoints.map((pt) => (
            <circle
              key={`dot-${pt.key}`}
              cx={pt.x}
              cy={pt.y}
              r="4"
              fill="#60a5fa"
              stroke="#1e3a8a"
              strokeWidth="1.5"
            />
          ))}

          {/* Perimeter Labels & Numerical Values */}
          {playerPoints.map((pt) => {
            const isTop = pt.angleDeg === 0;
            const isBottom = pt.angleDeg === 180;
            const isRight = pt.angleDeg > 0 && pt.angleDeg < 180;

            const textAnchor = isTop || isBottom ? 'middle' : isRight ? 'start' : 'end';
            const dx = isTop || isBottom ? 0 : isRight ? 4 : -4;
            const labelYOffset = isTop ? -10 : isBottom ? 6 : -4;
            const valueYOffset = isTop ? 5 : isBottom ? 21 : 11;

            const badgeColor =
              pt.value >= 85
                ? '#34d399'
                : pt.value >= 70
                ? '#38bdf8'
                : pt.value >= 55
                ? '#e4e4e7'
                : '#71717a';

            return (
              <g key={`label-${pt.key}`}>
                <text
                  x={pt.labelPos.x + dx}
                  y={pt.labelPos.y + labelYOffset}
                  textAnchor={textAnchor}
                  className="fill-zinc-300 text-[11px] font-semibold tracking-wide"
                >
                  {pt.label}
                </text>
                <text
                  x={pt.labelPos.x + dx}
                  y={pt.labelPos.y + valueYOffset}
                  textAnchor={textAnchor}
                  fill={badgeColor}
                  className="font-mono text-xs font-bold"
                >
                  {pt.value}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Compact accessible summary pills */}
        <dl className="mt-3 grid w-full grid-cols-3 gap-2 border-t border-zinc-800/80 pt-3 sm:grid-cols-6">
          {vertices.map((v) => {
            const valColor =
              v.value >= 85
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30'
                : v.value >= 70
                ? 'text-cyan-400 border-cyan-500/20 bg-cyan-950/25'
                : v.value >= 55
                ? 'text-zinc-200 border-zinc-700/60 bg-zinc-800/50'
                : 'text-zinc-500 border-zinc-800 bg-zinc-900/40';

            return (
              <div
                key={`pill-${v.key}`}
                className={`flex flex-col items-center rounded-lg border px-2 py-1.5 ${valColor}`}
              >
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {v.shortLabel}
                </dt>
                <dd className="font-mono text-sm font-bold">{v.value}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
};

export default RadarChart;
