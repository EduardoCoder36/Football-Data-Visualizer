import React from 'react';
import { TEAM_METRIC_CHIPS, TeamMetricKey } from '../../services/teamMetricsService';

interface TeamMetricChipsProps {
  activeKeys: TeamMetricKey[];
  onToggleKey: (key: TeamMetricKey) => void;
}

export const TeamMetricChips: React.FC<TeamMetricChipsProps> = ({
  activeKeys,
  onToggleKey,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TEAM_METRIC_CHIPS.map((chip) => {
        const isActive = activeKeys.includes(chip.key);

        return (
          <button
            key={chip.key}
            onClick={() => onToggleKey(chip.key)}
            type="button"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border ${
              isActive
                ? 'bg-slate-800/90 text-white shadow-sm ring-1 ring-inset'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-slate-800'
            }`}
            style={{
              borderColor: isActive ? chip.color : undefined,
              boxShadow: isActive ? `0 0 10px ${chip.color}25` : undefined,
            }}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-transform duration-150 ${
                isActive ? 'scale-110 shadow-sm' : 'opacity-40'
              }`}
              style={{ backgroundColor: chip.color }}
            />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TeamMetricChips;

