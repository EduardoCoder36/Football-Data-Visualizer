import React, { useId } from "react";
import { getTeamColor } from "../../constants/teamColors";

export type CrestPattern = "solid" | "stripes" | "shoulders" | "sash" | "halves";

export interface ClubCrestStyle {
  primary: string;
  secondary: string;
  trim: string;
  pattern: CrestPattern;
}

export const CANONICAL_TLA_BY_ID: Record<number, string> = {
  57: "ARS",
  58: "AVL",
  1044: "BOU",
  402: "BRE",
  397: "BHA",
  328: "BUR",
  61: "CHE",
  1076: "COV",
  354: "CRY",
  62: "EVE",
  63: "FUL",
  322: "HUL",
  349: "IPS",
  341: "LEE",
  338: "LEI",
  64: "LIV",
  65: "MCI",
  66: "MUN",
  67: "NEW",
  351: "NFO",
  340: "SOU",
  71: "SUN",
  73: "TOT",
  563: "WHU",
  76: "WOL",
};

const TLA_ALIASES: Record<string, string> = {
  AFC: "BOU",
  AST: "AVL",
  BRI: "BHA",
  NOT: "NFO",
  WES: "WHU",
};

export const CREST_STYLES_BY_TLA: Record<string, ClubCrestStyle> = {
  ARS: { primary: "#EF0107", secondary: "#FFFFFF", trim: "#D4AF37", pattern: "shoulders" },
  AVL: { primary: "#670E36", secondary: "#95BFE5", trim: "#FDBE11", pattern: "shoulders" },
  BOU: { primary: "#DA291C", secondary: "#111827", trim: "#D4AF37", pattern: "stripes" },
  BRE: { primary: "#E30613", secondary: "#FFFFFF", trim: "#111827", pattern: "stripes" },
  BHA: { primary: "#0057B8", secondary: "#FFFFFF", trim: "#FDBE11", pattern: "stripes" },
  BUR: { primary: "#6C1D45", secondary: "#99D6EA", trim: "#F8FAFC", pattern: "shoulders" },
  CHE: { primary: "#034694", secondary: "#1D4ED8", trim: "#D4AF37", pattern: "solid" },
  COV: { primary: "#59CBE8", secondary: "#1E3A8A", trim: "#F8FAFC", pattern: "halves" },
  CRY: { primary: "#1B458F", secondary: "#C4122E", trim: "#F8FAFC", pattern: "stripes" },
  EVE: { primary: "#003399", secondary: "#FFFFFF", trim: "#F8FAFC", pattern: "sash" },
  FUL: { primary: "#F8FAFC", secondary: "#0F172A", trim: "#CC0000", pattern: "shoulders" },
  HUL: { primary: "#F3A228", secondary: "#111827", trim: "#F8FAFC", pattern: "stripes" },
  IPS: { primary: "#3A64A3", secondary: "#FFFFFF", trim: "#DE2C3B", pattern: "solid" },
  LEE: { primary: "#F8FAFC", secondary: "#FFCD00", trim: "#1D428A", pattern: "sash" },
  LEI: { primary: "#003090", secondary: "#FDBE11", trim: "#FDBE11", pattern: "solid" },
  LIV: { primary: "#C8102E", secondary: "#991B1B", trim: "#F59E0B", pattern: "solid" },
  MCI: { primary: "#6CABDD", secondary: "#FFFFFF", trim: "#1C2C5B", pattern: "sash" },
  MUN: { primary: "#DA291C", secondary: "#111827", trim: "#FBBF24", pattern: "shoulders" },
  NEW: { primary: "#0F172A", secondary: "#F8FAFC", trim: "#D4AF37", pattern: "stripes" },
  NFO: { primary: "#DD0000", secondary: "#FFFFFF", trim: "#F8FAFC", pattern: "solid" },
  SOU: { primary: "#D71920", secondary: "#FFFFFF", trim: "#111827", pattern: "stripes" },
  SUN: { primary: "#D71920", secondary: "#FFFFFF", trim: "#D4AF37", pattern: "stripes" },
  TOT: { primary: "#F8FAFC", secondary: "#132257", trim: "#132257", pattern: "shoulders" },
  WHU: { primary: "#7A263A", secondary: "#1BB1E7", trim: "#F8FAFC", pattern: "shoulders" },
  WOL: { primary: "#FDB913", secondary: "#111827", trim: "#111827", pattern: "halves" },
};

export interface GenericTeamCrestProps {
  team: {
    id: number;
    name: string;
    tla?: string | null;
  };
  size?: number;
  className?: string;
}

export function resolveCanonicalTla(team: {
  id?: number | null;
  name?: string | null;
  tla?: string | null;
}): string {
  if (team.id && CANONICAL_TLA_BY_ID[team.id]) {
    return CANONICAL_TLA_BY_ID[team.id];
  }
  const rawTla = (team.tla || "").toUpperCase().trim();
  if (rawTla && TLA_ALIASES[rawTla]) {
    return TLA_ALIASES[rawTla];
  }
  const lowerName = (team.name || "").toLowerCase();
  if (lowerName.includes("manchester city") || lowerName === "man city") return "MCI";
  if (lowerName.includes("manchester united") || lowerName.includes("man utd")) return "MUN";
  if (lowerName.includes("aston villa")) return "AVL";
  if (lowerName.includes("bournemouth")) return "BOU";
  if (lowerName.includes("brighton")) return "BHA";
  if (lowerName.includes("nottingham")) return "NFO";
  if (lowerName.includes("west ham")) return "WHU";
  if (lowerName.includes("arsenal")) return "ARS";
  if (lowerName.includes("liverpool")) return "LIV";
  if (lowerName.includes("chelsea")) return "CHE";
  if (lowerName.includes("tottenham") || lowerName.includes("spurs")) return "TOT";
  if (lowerName.includes("newcastle")) return "NEW";
  if (lowerName.includes("everton")) return "EVE";
  if (lowerName.includes("fulham")) return "FUL";
  if (lowerName.includes("crystal palace")) return "CRY";
  if (lowerName.includes("brentford")) return "BRE";
  if (lowerName.includes("wolverhampton") || lowerName.includes("wolves")) return "WOL";
  if (lowerName.includes("sunderland")) return "SUN";
  if (lowerName.includes("leeds")) return "LEE";
  if (lowerName.includes("burnley")) return "BUR";

  if (rawTla && CREST_STYLES_BY_TLA[rawTla]) {
    return rawTla;
  }
  return (rawTla || (team.name || "CLB").slice(0, 3)).toUpperCase();
}

export function getClubCrestStyle(team: {
  id?: number | null;
  name?: string | null;
  tla?: string | null;
}): ClubCrestStyle {
  const tla = resolveCanonicalTla(team);
  if (CREST_STYLES_BY_TLA[tla]) {
    return CREST_STYLES_BY_TLA[tla];
  }
  const fallbackColor = getTeamColor(team.id || 0, (team.id || 0) % 6);
  return {
    primary: fallbackColor,
    secondary: "#1E293B",
    trim: "#E2E8F0",
    pattern: "halves",
  };
}

const SHIELD_PATH =
  "M24 3 L42 9 V22 C42 33.5 34.2 41.8 24 45 C13.8 41.8 6 33.5 6 22 V9 Z";

export const GenericTeamCrest: React.FC<GenericTeamCrestProps> = ({
  team,
  size = 40,
  className = "",
}) => {
  const uniqueId = useId();
  const tla = resolveCanonicalTla(team);
  const style = getClubCrestStyle(team);
  const clipId = `crest-clip-${team.id}-${tla}-${uniqueId.replace(/:/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 ${className}`}
      role="img"
      aria-label={`${team.name} club crest`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SHIELD_PATH} />
        </clipPath>
      </defs>

      {/* Clipped Shield Interior Pattern */}
      <g clipPath={`url(#${clipId})`}>
        {/* Base Fill */}
        <rect x="0" y="0" width="48" height="48" fill={style.primary} />

        {style.pattern === "stripes" && (
          <>
            <rect x="11" y="0" width="6" height="48" fill={style.secondary} />
            <rect x="21" y="0" width="6" height="48" fill={style.secondary} />
            <rect x="31" y="0" width="6" height="48" fill={style.secondary} />
          </>
        )}

        {style.pattern === "shoulders" && (
          <>
            <rect x="0" y="0" width="15" height="22" fill={style.secondary} />
            <rect x="33" y="0" width="15" height="22" fill={style.secondary} />
            <path d="M15 0 H33 L29 12 H19 Z" fill={style.secondary} opacity="0.25" />
          </>
        )}

        {style.pattern === "halves" && (
          <rect x="24" y="0" width="24" height="48" fill={style.secondary} />
        )}

        {style.pattern === "sash" && (
          <polygon points="4,38 36,2 44,10 12,46" fill={style.secondary} />
        )}

        {/* Subtle Inner Gloss Overlay */}
        <path
          d="M6 9 L24 3 L42 9 V20 C30 22 18 22 6 20 Z"
          fill="#FFFFFF"
          fillOpacity="0.14"
        />

        {/* High-Contrast Center Banner for TLA */}
        <rect
          x="4"
          y="18.5"
          width="40"
          height="12"
          fill="#0F172A"
          fillOpacity="0.88"
        />
        <line
          x1="4"
          y1="18.5"
          x2="44"
          y2="18.5"
          stroke={style.trim}
          strokeWidth="1"
          strokeOpacity="0.85"
        />
        <line
          x1="4"
          y1="30.5"
          x2="44"
          y2="30.5"
          stroke={style.trim}
          strokeWidth="1"
          strokeOpacity="0.85"
        />
      </g>

      {/* Outer Shield Border */}
      <path
        d={SHIELD_PATH}
        stroke={style.trim}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Crisp 3-Letter Club Code */}
      <text
        x="24"
        y="27.2"
        textAnchor="middle"
        fill="#F8FAFC"
        fontSize="9.5"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.06em"
      >
        {tla}
      </text>
    </svg>
  );
};

export default GenericTeamCrest;
