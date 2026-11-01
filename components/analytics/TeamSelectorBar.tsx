import React from "react";
import GenericTeamCrest from "./GenericTeamCrest";

export interface TeamOption {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crestUrl: string;
  isPromoted: boolean;
}

export interface TeamSelectorBarProps {
  teams: TeamOption[];
  selectedTeamIds: number[];
  onToggleTeam: (teamId: number) => void;
  viewMode?: "comparison" | "team_metrics";
  maxSelectionError?: string | null;
  onDismissError?: () => void;
}

export const TeamSelectorBar: React.FC<TeamSelectorBarProps> = ({
  teams,
  selectedTeamIds,
  onToggleTeam,
  viewMode = "comparison",
  maxSelectionError = null,
  onDismissError,
}) => {
  const isComparison = viewMode === "comparison";

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2.5 shadow-md shrink-0">
      {/* Status & Inline Validation Bar (Fixed height to prevent any CLS) */}
      <div className="flex items-center justify-between min-h-[24px] mb-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">
            {isComparison ? "Compare Clubs:" : "Active Club:"}
          </span>
          <span className="text-slate-400">
            {isComparison
              ? `${selectedTeamIds.length} / 2 selected`
              : "Click any crest to switch team"}
          </span>
        </div>

        {maxSelectionError ? (
          <div
            role="alert"
            aria-live="polite"
            className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-rose-950/90 border border-rose-500/60 text-rose-200 text-[11px] font-medium shadow-sm animate-pulse"
          >
            <span>⚠️ {maxSelectionError}</span>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="text-rose-300 hover:text-white font-bold ml-1"
                aria-label="Dismiss selection limit message"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {isComparison
              ? "Select up to 2 clubs to compare trajectories"
              : "Single-team mode: clicking a new club deselects the current club"}
          </span>
        )}
      </div>

      {/* Scrollable Generic Crest Strip */}
      <div className="flex items-center space-x-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 py-1">
        {teams.map((team) => {
          const isSelected = selectedTeamIds.includes(team.id);
          const isAtCap = isComparison && !isSelected && selectedTeamIds.length >= 2;

          return (
            <button
              key={team.id}
              type="button"
              onClick={() => onToggleTeam(team.id)}
              aria-pressed={isSelected}
              aria-disabled={isAtCap}
              title={`${team.name} ${team.isPromoted ? "(Promoted)" : ""}`}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 shrink-0 ${
                isSelected
                  ? "bg-slate-800 ring-2 ring-emerald-500 scale-105 shadow-lg"
                  : isAtCap
                  ? "opacity-30 hover:opacity-60 cursor-pointer"
                  : "opacity-55 hover:opacity-95 hover:bg-slate-800/50"
              }`}
            >
              <div className="w-10 h-10 relative mb-1 flex items-center justify-center drop-shadow">
                <GenericTeamCrest team={team} size={40} />
              </div>
              <span className="text-[11px] font-semibold tracking-wider text-slate-200">
                {team.tla}
              </span>
              {team.isPromoted && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TeamSelectorBar;
