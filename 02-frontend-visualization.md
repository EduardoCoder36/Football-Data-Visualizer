```markdown
# Component: Premier League Trajectory Dashboard
**Location:** Frontend Web App (`/components/analytics/TrajectoryChart.tsx`, `/pages/index.tsx`)

## User Story
**As a** football analyst/fan,
**I want** an interactive near-fullscreen chart displaying multi-team point trajectories across games played,
**So that** I can compare current pace against prior season milestones and equivalent opponents.

---

## UI/UX Requirements
1. **Layout**:
   - Header/Top Bar: Horizontal row of all 20 Premier League team crests/icons.
   - Main Viewport: Fullscreen/near-fullscreen responsive line chart.
2. **Default State**:
   - Only **Arsenal** is pre-selected on initial load.
3. **Multi-Selection**:
   - Multiple clubs can be toggled simultaneously (up to all 20 clubs).
   - Selecting a club adds its corresponding line series to the chart.
4. **Promoted Teams**:
   - Promoted clubs are selectable.
   - Promoted clubs render **only 1 line** (`Current Progress`).
   - "Last Year's Progress" and "Same Opponents Comparison" are disabled and hidden from tooltips/legend for these clubs.
5. **Axes**:
   - **X-Axis**: Matches Played (1 to 38).
   - **Y-Axis**: Cumulative Points (0 to 114).

---

## Gherkin Scenarios

```gherkin
Feature: Interactive Trajectory Visualization

  Background:
    Given the user navigates to the application dashboard
    And team and trajectory data have loaded from Supabase

  Scenario: Default view initialization
    Then the horizontal club selection bar renders all 20 Premier League team icons
    And "Arsenal" is active by default
    And the chart renders 3 lines for Arsenal:
      | Line Name                | Style       |
      | Current Progress         | Solid       |
      | Last Year's Progress     | Dashed      |
      | Same Opponents Comparison| Dotted      |
    And the X-axis spans games played from 1 to 38
    And the Y-axis spans cumulative points from 0 to 114

  Scenario: Multi-team toggling
    Given "Arsenal" is currently displayed
    When the user clicks the "Chelsea" icon in the top selection bar
    Then "Chelsea" is marked active
    And the chart dynamically plots lines for both Arsenal and Chelsea
    And each team is visually partitioned by unique hue/color families

  Scenario: Promoted team selection constraints
    Given a club was promoted from the Championship this season
    When the user toggles this promoted club's icon
    Then the club is added to the active selection
    And the chart renders exactly 1 line ("Current Progress")
    And "Last Year's Progress" and "Same Opponent Comparison" lines remain absent

  Scenario: Deselecting team
    Given "Arsenal" and "Chelsea" are active
    When the user clicks the "Chelsea" icon
    Then the "Chelsea" lines are removed from the canvas
    And the remaining selections stay unaffected