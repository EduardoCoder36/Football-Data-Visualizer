export const TEAM_COLORS: Record<number, { hex: string; name: string }> = {
  57: { name: "Arsenal", hex: "#EF0107" },
  58: { name: "Aston Villa", hex: "#95BFE5" },
  1044: { name: "Bournemouth", hex: "#DA291C" },
  397: { name: "Brighton", hex: "#3B82F6" }, // Lighter blue for visibility
  61: { name: "Chelsea", hex: "#3B82F6" }, // Bright royal blue
  354: { name: "Crystal Palace", hex: "#60A5FA" }, // Light blue to contrast dark background
  62: { name: "Everton", hex: "#3B82F6" }, // Bright royal blue
  63: { name: "Fulham", hex: "#CC0000" },
  322: { name: "Hull City", hex: "#F3A228" },
  402: { name: "Brentford", hex: "#E30613" },
  338: { name: "Leicester City", hex: "#3B82F6" }, // Bright blue
  64: { name: "Liverpool", hex: "#C8102E" },
  65: { name: "Manchester City", hex: "#6CABDD" },
  66: { name: "Manchester United", hex: "#DA291C" },
  67: { name: "Newcastle United", hex: "#F1F5F9" }, // Bright silver/white for visibility
  351: { name: "Nottingham Forest", hex: "#DD0000" },
  340: { name: "Southampton", hex: "#D71920" },
  73: { name: "Tottenham Hotspur", hex: "#38BDF8" }, // Vibrant cyan
  563: { name: "West Ham United", hex: "#E11D48" }, // Brighter claret/rose
  76: { name: "Wolverhampton", hex: "#FDB913" },
};

// Fallback generator for promoted teams if ID varies
export const getTeamColor = (teamId: number, index: number): string => {
  if (TEAM_COLORS[teamId]) return TEAM_COLORS[teamId].hex;
  const fallbacks = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#e11d48"];
  return fallbacks[index % fallbacks.length];
};