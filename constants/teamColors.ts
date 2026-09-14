export const TEAM_COLORS: Record<number, { hex: string; name: string }> = {
  57: { name: "Arsenal", hex: "#EF0107" },
  58: { name: "Aston Villa", hex: "#95BFE5" },
  1044: { name: "Bournemouth", hex: "#DA291C" },
  397: { name: "Brighton", hex: "#0057B8" },
  61: { name: "Chelsea", hex: "#034694" },
  354: { name: "Crystal Palace", hex: "#1B458F" },
  62: { name: "Everton", hex: "#003399" },
  63: { name: "Fulham", hex: "#CC0000" },
  322: { name: "Hull City", hex: "#F3A228" },
  402: { name: "Brentford", hex: "#E30613" },
  338: { name: "Leicester City", hex: "#003090" },
  64: { name: "Liverpool", hex: "#C8102E" },
  65: { name: "Manchester City", hex: "#6CABDD" },
  66: { name: "Manchester United", hex: "#DA291C" },
  67: { name: "Newcastle United", hex: "#241F20" },
  351: { name: "Nottingham Forest", hex: "#DD0000" },
  340: { name: "Southampton", hex: "#D71920" },
  73: { name: "Tottenham Hotspur", hex: "#132257" },
  563: { name: "West Ham United", hex: "#7A263A" },
  76: { name: "Wolverhampton", hex: "#FDB913" },
};

// Fallback generator for promoted teams if ID varies
export const getTeamColor = (teamId: number, index: number): string => {
  if (TEAM_COLORS[teamId]) return TEAM_COLORS[teamId].hex;
  const fallbacks = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#e11d48"];
  return fallbacks[index % fallbacks.length];
};