User Story
As a fantasy football manager / sports analyst,

I want to expand an individual fixture row to view full-time, half-time, and prior-season scoreline comparisons,

so that I can evaluate nuanced match context and historical trend performance without leaving the fixture list.

Gherkin Scenarios
Gherkin
Feature: Expandable Fixture Row Details

  Background:
    Given the user is viewing the Fixture Results Table
    And the theme is set to dark navy/slate

  # Happy Path
  Scenario: User expands a fixture row to view detailed score breakdown
    Given a fixture row exists for Gameweek 12 with opponent "Arsenal"
    And historical data exists for the prior season equivalent fixture
    When the user activates the row expand toggle via click or "Enter" key
    Then the nested drawer expands inline below the row with a smooth CSS transition
    And the drawer displays:
      | Field                       | Value / Format          |
      | Half-Time Score             | (1 - 0)                 |
      | Full-Time Score             | 2 - 1                   |
      | Prior Season Comparison     | Current: 2-1 vs Last: 1-1 |
    And the toggle chevron updates its state to expanded
    And the row toggle has aria-expanded set to "true"

  # Edge Case: Promoted Team (No prior-season direct fixture)
  Scenario: User expands a fixture row for a newly promoted opponent
    Given the fixture row opponent is a promoted team without an equivalent prior-season fixture
    When the user expands the fixture row
    Then the prior-season comparison section displays a "Promoted Team Replacement" context tag
    And no numerical scoreline comparison is rendered for last season

  # Edge Case: Match Postponed / Rescheduled
  Scenario: User expands a fixture row for a postponed match
    Given a fixture was marked with status "POSTPONED"
    When the user expands the fixture row
    Then the drawer displays a warning context tag "Postponed / Rescheduled"
    And score breakdown fields display "N/A" with an explanation tooltip

  # Accessibility & Keyboard Navigation
  Scenario: Keyboard accessibility for expandable row
    Given focus is on the fixture row expand button
    When the user presses the "Space" or "Enter" key
    Then the drawer toggles open or closed
    And focus remains on the toggle control without unintended scrolling
Data Schemas & Types
TypeScript
import { z } from "zod";

export const FixtureContextTagSchema = z.enum([
  "POSTPONED",
  "RESCHEDULED",
  "PROMOTED_TEAM_REPLACEMENT",
  "NEUTRAL_VENUE",
]);

export const HistoricalMatchComparisonSchema = z.object({
  priorSeasonLabel: z.string().describe("e.g. '2025/26'"),
  priorScore: z.object({
    home: z.number().int().nonnegative(),
    away: z.number().int().nonnegative(),
  }).nullable(),
  isDirectEquivalent: z.boolean(),
});

export const FixtureDetailDrawerSchema = z.object({
  fixtureId: z.string().uuid(),
  gameweek: z.number().int().min(1).max(38),
  scoreline: z.object({
    halfTime: z.object({
      home: z.number().int().nonnegative(),
      away: z.number().int().nonnegative(),
    }).nullable(),
    fullTime: z.object({
      home: z.number().int().nonnegative(),
      away: z.number().int().nonnegative(),
    }).nullable(),
  }),
  historicalComparison: HistoricalMatchComparisonSchema.nullable(),
  contextTags: z.array(FixtureContextTagSchema),
});

export type FixtureDetailDrawer = z.infer<typeof FixtureDetailDrawerSchema>;
Sample JSON Payload (Expanded Row State)
JSON
{
  "fixtureId": "e3b0c442-98fc-1c14-9af7-4c2e64627d31",
  "gameweek": 12,
  "scoreline": {
    "halfTime": { "home": 1, "away": 0 },
    "fullTime": { "home": 2, "away": 1 }
  },
  "historicalComparison": {
    "priorSeasonLabel": "2025/26",
    "priorScore": { "home": 1, "away": 1 },
    "isDirectEquivalent": true
  },
  "contextTags": []
}