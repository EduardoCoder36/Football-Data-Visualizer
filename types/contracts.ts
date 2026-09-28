import { z } from "zod";

export const VenueSchema = z.enum(["HOME", "AWAY"]);

export const FixtureSyncSchema = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: z.string(), // Accepts TIMED, SCHEDULED, FINISHED, etc.
  matchday: z.number().int().min(1).max(38).nullable().optional(),
  homeTeam: z.object({ id: z.number(), name: z.string() }),
  awayTeam: z.object({ id: z.number(), name: z.string() }),
  score: z.object({
    winner: z.string().nullable().optional(),
    fullTime: z.object({
      home: z.number().nullable().optional(),
      away: z.number().nullable().optional(),
    }),
    halfTime: z.object({
      home: z.number().nullable().optional(),
      away: z.number().nullable().optional(),
    }).optional(),
  }),
});

export const TeamMappingRuleSchema = z.object({
  promotedTeamId: z.number(),
  relegatedTeamId: z.number(),
  qualificationMethod: z.enum(["CHAMPIONS", "RUNNER_UP", "PLAYOFF_WINNER"]),
  season: z.string().regex(/^\d{4}\/\d{4}$/),
});

export const TrajectoryPointSchema = z.object({
  teamId: z.number(),
  gamesPlayed: z.number().int().min(1).max(38),
  currentPoints: z.number().int().min(0).max(114),
  lastYearPoints: z.number().int().min(0).max(114).nullable(),
  sameOpponentPoints: z.number().int().min(0).max(114).nullable(),
});