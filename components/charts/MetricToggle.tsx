import React from 'react';
import { MetricType } from '../../types/trajectory';

interface MetricToggleProps {
  selectedMetric: MetricType;
  onChange: (metric: MetricType) => void;
}

export const MetricToggle: React.FC<MetricToggleProps> = ({ selectedMetric, onChange }) => {
  const options: { value: MetricType; label: string }[] = [
    { value: 'PTS', label: 'Points (PTS)' },
    { value: 'GF', label: 'Goals Scored (GF)' },
    { value: 'GA', label: 'Goals Conceded (GA)' },
    { value: 'COMBINED', label: 'Goals Combined (GF & GA)' },
  ];

  return (
    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 w-fit">
      {options.map((opt) => {
        const isActive = selectedMetric === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
