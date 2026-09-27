# Bugfix & Enhancement: Tooltip Label Restoration, Opponent Baseline for Goals, and Combined Goals View

## Context
Following the multi-metric support update:
1. Recharts tooltip custom formatter lost the team and line identifiers (e.g., showing raw "5 pts" instead of "Team (Current): 5 pts").
2. The Goals Scored (GF) and Goals Conceded (GA) views only render 2 lines instead of 3; the "Same Opponents" equivalent line is missing.
3. Users need an option to view both Goals Scored (GF) and Goals Conceded (GA) on a single combined chart.

## Visual & Color Palette Constraints
- When "Goals Combined" is selected, the chart will display up to 6 lines (3 for GF, 3 for GA).
- To prevent visual confusion, GF and GA must use distinctly contrasting color themes:
  - **Goals For (GF) Palette:** A vibrant positive tone (e.g., Emerald / Cyan / Yellow-Green tones)
    - Solid: Current GF
    - Dashed: Last Year GF Pace
    - Dotted: Same Opponents GF
  - **Goals Against (GA) Palette:** A contrasting cautionary tone (e.g., Crimson / Rose / Amber-Red tones)
    - Solid: Current GA
    - Dashed: Last Year GA Pace
    - Dotted: Same Opponents GA
- Single-metric views (PTS, GF, or GA selected individually) can retain the selected team's primary club color identity while preserving the solid/dashed/dotted line styles.

## Acceptance Criteria (Gherkin)

Scenario: Tooltip displays full descriptive series labels across all views
  Given the user hovers over any data point on the trajectory chart
  When the tooltip renders
  Then each entry must display the team name and line context:
    | Metric View | Line Context | Format Example |
    | Points | Current | Arsenal (Current): 12 pts |
    | Points | Last Year | Arsenal (Last Year): 10 pts |
    | Points | Opponents Eq. | Arsenal (Opponents Eq.): 13 pts |
    | Goals Scored | Current | Arsenal (Current GF): 8 goals |
    | Goals Combined | Current GF | Arsenal (Current GF): 8 goals |
    | Goals Combined | Current GA | Arsenal (Current GA): 4 goals |

Scenario: Three trajectory lines render for individual goal views
  Given the user selects "Goals Scored (GF)" or "Goals Conceded (GA)"
  When the chart renders
  Then it must display all 3 comparative trajectories:
    1. Current Progress (solid line)
    2. Last Year's Pace (dashed line)
    3. Same Opponents / Equivalent (dotted line)
  And the backend sync engine / chart mapping must aggregate and provide equivalent opponent goals.

Scenario: Combined Goals view option with contrasting color palettes
  Given the metric toggle selector above the chart
  When the user views the options
  Then an option for "Goals Combined" (or "GF & GA") is available
  And selecting it plots both cumulative Goals Scored (GF) and Goals Conceded (GA)
  And the GF trajectory family uses a contrasting tone distinct from the GA trajectory family
  And the legend clearly indicates which line style and color corresponds to each of the 6 trajectories.