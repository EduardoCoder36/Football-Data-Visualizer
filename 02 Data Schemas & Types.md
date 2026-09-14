TypeScript
import { z } from "zod";

export const ChartLineSeriesSchema = z.object({
  teamId: z.number(),
  teamName: z.string(),
  isPromoted: z.boolean(),
  colorHex: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i),
  series: z.object({
    currentProgress: z.array(
      z.object({ gamesPlayed: z.number(), points: z.number() })
    ),
    lastYearProgress: z.array(
      z.object({ gamesPlayed: z.number(), points: z.number() })
    ).optional(),
    sameOpponentsComparison: z.array(
      z.object({ gamesPlayed: z.number(), points: z.number() })
    ).optional(),
  }),
});

export const DashboardStateSchema = z.object({
  selectedTeamIds: z.array(z.number()).min(1).max(20),
  activeHoverMatchday: z.number().int().min(1).max(38).nullable(),
});

export type ChartLineSeries = z.infer<typeof ChartLineSeriesSchema>;
export type DashboardState = z.infer<typeof DashboardStateSchema>;