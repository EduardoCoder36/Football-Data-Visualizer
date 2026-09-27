1. Component Name & Location
Backend Ingestion Worker: services/sync-worker/index.ts

Database Layer: Supabase PostgreSQL (team_trajectories table / analytical view)

Frontend UI & Visualization:

components/charts/MetricToggle.tsx

components/charts/TrajectoryChart.tsx

pages/teams/[id]/trajectory.tsx (or target team page route)

2. User Story
As a football performance analyst or club supporter,

I want to toggle between cumulative Points, Goals Scored, and Goals Conceded against prior-year baselines on the trajectory chart,

So that I can assess whether our underlying attacking and defensive production aligns with our league table position.

3. Gherkin Scenarios
Gherkin
Feature: Multi-Metric Trajectory Support (Points, Goals Scored, Goals Conceded)

  Background:
    Given the database contains completed fixture records with home/away scorelines
    And the user is authenticated and navigating the team trajectory view

  # -------------------------------------------------------------------------
  # BACKEND & SYNC WORKER SCENARIOS
  # -------------------------------------------------------------------------

  Scenario: Sync worker aggregates cumulative goals alongside points
    Given a series of completed fixtures for team "ARS" in the current season:
      | Gameweek | Result | Goals For | Goals Against |
      | 1        | Win    | 2         | 0             |
      | 2        | Draw   | 1         | 1             |
      | 3        | Loss   | 0         | 3             |
    When the sync worker executes in "services/sync-worker/index.ts"
    Then the "team_trajectories" records are inserted or updated with cumulative values:
      | Gameweek | cumulative_points | cumulative_goals_for | cumulative_goals_against |
      | 1        | 3                 | 2                    | 0                        |
      | 2        | 4                 | 3                    | 1                        |
      | 3        | 4                 | 3                    | 4                        |
    And the prior-year baseline columns ("baseline_points", "baseline_goals_for", "baseline_goals_against") are mapped per gameweek

  Scenario: Sync worker encounters a postponed fixture (Edge Case)
    Given fixture for Gameweek 4 is marked with status "POSTPONED"
    When the sync worker runs the aggregation pipeline
    Then the cumulative metric values for Gameweek 4 inherit the totals from Gameweek 3
    And the data point is flagged with "is_completed: false"

  Scenario: Sync worker encounters corrupt fixture payload (Failure Mode)
    Given a fixture row with "null" values for home and away scores despite status "FINISHED"
    When the sync worker parses the row
    Then the worker logs a structured error with the fixture ID
    And aborts the transaction without persisting corrupt trajectory states

  # -------------------------------------------------------------------------
  # FRONTEND VISUALIZATION SCENARIOS
  # -------------------------------------------------------------------------

  Scenario: Default view initialization (Happy Path)
    When the analyst loads the team trajectory page
    Then the metric toggle renders above "<TrajectoryChart/>"
    And "Points (PTS)" is selected by default
    And the Y-axis label renders "Points"
    And the chart plots "cumulative_points" against "baseline_points"

  Scenario Outline: Toggling metrics dynamically updates chart axes and tooltips (Happy Path)
    Given the trajectory chart is rendered
    When the analyst selects the "<Metric>" toggle
    Then the primary line updates to plot "<DataKey>"
    And the comparison line updates to plot "<BaselineKey>"
    And the Y-axis scale recalculates domain "[0, 'auto']" based on the max value of "<DataKey>"
    And hovering over a data point displays a tooltip with unit suffix "<Unit>"
    And the existing dynamic X-axis auto-zoom range remains unchanged

    Examples:
      | Metric                 | DataKey                  | BaselineKey              | Unit |
      | Points (PTS)           | cumulative_points        | baseline_points          | pts  |
      | Goals Scored (GF)      | cumulative_goals_for     | baseline_goals_for       | goals|
      | Goals Conceded (GA)    | cumulative_goals_against | baseline_goals_against   | goals|

  Scenario: Newly promoted team lacks prior-year baseline (Edge Case)
    Given the current team was promoted this season and has no prior-year top-flight data
    When the analyst switches metric to "Goals Scored (GF)"
    Then the current season line renders with "cumulative_goals_for" values
    And the baseline comparison line is omitted from the chart
    And the legend indicates "Prior-Year Baseline: N/A"

  Scenario: Supabase client fails to fetch trajectory payload (Failure Mode)
    Given the Supabase API returns a 500 status code
    When the trajectory component mounts
    Then an inline error banner displays "Unable to load trajectory metrics"
    And a "Retry" button is provided without breaking the page layout
4. Data Schemas & Type Definitions
TypeScript / Zod Schemas (types/trajectory.ts)
TypeScript
import { z } from 'zod';

export const MetricTypeSchema = z.enum(['PTS', 'GF', 'GA']);
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
});

export type TrajectoryPoint = z.infer<typeof TrajectoryPointSchema>;

export const TeamTrajectoryResponseSchema = z.object({
  team_id: z.string().uuid(),
  season: z.string(),
  data: z.array(TrajectoryPointSchema),
});

export type TeamTrajectoryResponse = z.infer<typeof TeamTrajectoryResponseSchema>;
JSON Payload Example (Supabase Response)
JSON
{
  "team_id": "7b848c4d-b355-46aa-b2b6-52c7104b2c1e",
  "season": "2025-2026",
  "data": [
    {
      "gameweek": 1,
      "is_completed": true,
      "cumulative_points": 3,
      "cumulative_goals_for": 2,
      "cumulative_goals_against": 0,
      "baseline_points": 1,
      "baseline_goals_for": 1,
      "baseline_goals_against": 1
    },
    {
      "gameweek": 2,
      "is_completed": true,
      "cumulative_points": 4,
      "cumulative_goals_for": 3,
      "cumulative_goals_against": 1,
      "baseline_points": 4,
      "baseline_goals_for": 3,
      "baseline_goals_against": 1
    }
  ]
}