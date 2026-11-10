'use client';

import React, { useId } from 'react';
import { PlayerRatingsData } from '@/lib/queries/players';
import { getFmBadgeClasses, getFmBarColorClass } from '@/lib/utils/fmRating';

export interface AttributeGridProps {
  ratings: PlayerRatingsData;
}

interface AttributeItem {
  key: keyof PlayerRatingsData;
  label: string;
  description: string;
}

const TECHNICAL_AND_TACTICAL_ATTRIBUTES: AttributeItem[] = [
  { key: 'stat_touch', label: 'First Touch & Control', description: 'Take-on retention & low dispossession rate' },
  { key: 'stat_vision', label: 'Vision & Creativity', description: 'Expected assists (xA) & key passes per 90' },
  { key: 'stat_positioning', label: 'Off-Ball Positioning', description: 'Box presence (FWD/MID) or defensive reads (DEF)' },
  { key: 'stat_short_passing', label: 'Short Passing', description: 'Pass completion efficiency' },
  { key: 'stat_long_passing', label: 'Long Passing', description: 'Completed long distribution volume' },
  { key: 'stat_shots', label: 'Finishing & Shots', description: 'Shot volume per 90 & on-target accuracy' },
  { key: 'stat_long_shots', label: 'Long Shots', description: 'Distance shooting threat outside the box' },
  { key: 'stat_crossing', label: 'Crossing', description: 'Completed crosses per 90' },
  { key: 'stat_tackling', label: 'Tackling', description: 'Tackles won per 90 & challenge success %' },
  { key: 'stat_defensive_positioning', label: 'Defensive Positioning', description: 'Interceptions, blocks & clearances per 90' },
];

const PHYSICAL_AND_AERIAL_ATTRIBUTES: AttributeItem[] = [
  { key: 'stat_speed', label: 'Pace & Speed', description: 'Progressive ball carries per 90' },
  { key: 'stat_acceleration', label: 'Acceleration', description: 'Successful take-on bursts per 90' },
  { key: 'stat_strength', label: 'Strength', description: 'Ground duel win percentage' },
  { key: 'stat_stamina', label: 'Stamina & Work Rate', description: 'Minutes sustained per appearance' },
  { key: 'stat_jumping', label: 'Jumping Reach', description: 'Aerial intervention rate per 90' },
  { key: 'stat_heading', label: 'Heading', description: 'Total positional aerial clearance output' },
];

export const AttributeGrid: React.FC<AttributeGridProps> = ({ ratings }) => {
  const sectionId = useId();
  const isLowSample = ratings.sample_minutes < 270;

  const renderAttributeRow = (item: AttributeItem) => {
    const rawValue = Number(ratings[item.key] ?? 50);
    const value = Math.max(1, Math.min(99, Math.round(rawValue)));
    const badgeClasses = getFmBadgeClasses(value);
    const barClass = getFmBarColorClass(value);

    return (
      <div
        key={String(item.key)}
        className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 px-3.5 py-2.5 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/70"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">
              {item.label}
            </span>
          </div>
          <p className="truncate text-[11px] text-zinc-500">{item.description}</p>
          <div
            aria-hidden="true"
            className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800/80"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${barClass}`}
              style={{ width: `${value}%` }}
            />
          </div>
        </div>

        <span
          className={`inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-sm tabular-nums ${badgeClasses}`}
        >
          {value}
        </span>
      </div>
    );
  };

  return (
    <section
      aria-labelledby={`${sectionId}-heading`}
      className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 sm:p-6 backdrop-blur-md shadow-lg"
    >
      {/* Header & FM Color Legend */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id={`${sectionId}-heading`}
              className="text-lg font-bold tracking-tight text-zinc-100"
            >
              FM 1–100 Scouting Attributes
            </h2>
            <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-300">
              {ratings.cohort_position} Cohort
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            Calibrated against Premier League positional peers ({ratings.season})
          </p>
        </div>

        {/* Tier Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            85–99 Elite
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-950/30 px-2 py-0.5 font-semibold text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            70–84 Strong
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-medium text-zinc-200">
            55–69 Avg
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800/60 bg-zinc-950 px-2 py-0.5 text-zinc-500">
            1–54 Low
          </span>
        </div>
      </div>

      {isLowSample && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
          <strong className="font-semibold">Baseline Sample Notice:</strong> Player has logged{' '}
          <span className="font-mono font-bold">{ratings.sample_minutes}</span> minutes this season
          (minimum 270 required for percentile calibration). Attributes default to baseline 50.
        </div>
      )}

      {/* Two-Column FM Attribute Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Column 1: Technical & Tactical */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Technical & Tactical
            </h3>
            <span className="font-mono text-[11px] text-zinc-500">10 Attributes</span>
          </div>
          <div className="space-y-2.5">
            {TECHNICAL_AND_TACTICAL_ATTRIBUTES.map(renderAttributeRow)}
          </div>
        </div>

        {/* Column 2: Physical & Aerial */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Physical & Aerial
            </h3>
            <span className="font-mono text-[11px] text-zinc-500">6 Attributes</span>
          </div>
          <div className="space-y-2.5">
            {PHYSICAL_AND_AERIAL_ATTRIBUTES.map(renderAttributeRow)}
          </div>

          {/* Role Weighting Explanation Card */}
          <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Role-Weighted Overall ({ratings.cohort_position})
              </span>
              <span className="font-mono text-sm font-black text-emerald-400">
                OVR {ratings.overall_rating}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">
              {ratings.cohort_position === 'FWD' &&
                'Weighted toward Finishing & Shots (22%), Pace (15%), Acceleration (15%), Off-Ball Positioning (15%), and First Touch (10%).'}
              {ratings.cohort_position === 'MID' &&
                'Weighted toward Vision (20%), Short Passing (18%), First Touch (14%), Stamina (12%), Long Passing (10%), and Defensive Positioning (10%).'}
              {ratings.cohort_position === 'DEF' &&
                'Weighted toward Tackling (22%), Defensive Positioning (22%), Strength (14%), Heading (14%), Short Passing (10%), and Stamina (10%).'}
              {ratings.cohort_position === 'GKP' &&
                'Weighted toward Defensive Positioning (35%), Short Passing (25%), Long Passing (20%), First Touch (10%), and Strength (10%).'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AttributeGrid;
