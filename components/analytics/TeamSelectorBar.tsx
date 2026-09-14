import React from "react";

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
}

export const TeamSelectorBar: React.FC<TeamSelectorBarProps> = ({
  teams,
  selectedTeamIds,
  onToggleTeam,
}) => {
  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-3 shadow-md">
      <div className="flex items-center space-x-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 py-1">
        {teams.map((team) => {
          const isSelected = selectedTeamIds.includes(team.id);

          return (
            <button
              key={team.id}
              onClick={() => onToggleTeam(team.id)}
              title={`${team.name} ${team.isPromoted ? "(Promoted)" : ""}`}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 shrink-0 ${
                isSelected
                  ? "bg-slate-800 ring-2 ring-emerald-500 scale-105 shadow-lg"
                  : "opacity-40 hover:opacity-80 hover:bg-slate-800/40"
              }`}
            >
              <div className="w-10 h-10 relative mb-1 flex items-center justify-center">
                <img
                  src={team.crestUrl}
                  alt={team.name}
                  className="w-full h-full object-contain filter drop-shadow"
                />
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