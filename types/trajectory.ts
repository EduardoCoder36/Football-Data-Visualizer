import { z } from 'zod';

export const MetricTypeSchema = z.enum(['PTS', 'GF', 'GA', 'COMBINED']);
export type MetricType = z.infer<typeof MetricTypeSchema>;

export const TrajectoryPointSchema = z.object({
  gameweek: z.number().int().min(1).max(38),
  is_completed: z.boolean(),
  // Current Season Cumulatives
  cumulative_points: z.number().int().nonnegative(),
  cumulative_goals_for: z.number().int().nonnegative(),
  cumulative_goals_against: z.number().int().nonnegative(),
  // Prior Year Baselines (Nullable for promoted teams)
  baseline_points: z.number().int().nonnegative().nullable(),
  baseline_goals_for: z.number().int().nonnegative().nullable(),
  baseline_goals_against: z.number().int().nonnegative().nullable(),
  same_opponent_points: z.number().int().nonnegative().nullable(),
  same_opponent_goals_for: z.number().int().nonnegative().nullable(),
  same_opponent_goals_against: z.number().int().nonnegative().nullable(),
});

export type TrajectoryPoint = z.infer<typeof TrajectoryPointSchema>;

export const TeamTrajectoryResponseSchema = z.object({
  team_id: z.string().uuid(),
  season: z.string(),
  data: z.array(TrajectoryPointSchema),
});

export type TeamTrajectoryResponse = z.infer<typeof TeamTrajectoryResponseSchema>;
