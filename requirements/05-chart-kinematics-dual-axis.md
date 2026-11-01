# Requirements Specification: Football Drawing Kinematics & Dynamic Dual Y-Axis

## 1. Overview & Strategic Alignment
* **Target Branch:** `feat/agentic-visualizer-polish`
* **Database Target:** `dev` schema (`NEXT_PUBLIC_SUPABASE_SCHEMA=dev`) — *Frontend visualization and client-side scaling/animation kinematics only; zero database mutations.*
* **Roadmap Alignment ([docs/ROADMAP_OKRS.md](../docs/ROADMAP_OKRS.md)):**
  * **Pillar 1 (Team & League Process Analytics):** Enables simultaneous multi-metric analysis across low-volume metrics (Goals, xG, aXG) and high-volume metrics (Shots, Corners, Points) without vertical compression.
  * **KR 1.1 (Visual Polish & Tactical Animations):** Upgrades data point markers to a classic, high-contrast black-and-white stitched football that progressively travels and bounces along the trajectory curve as the SVG line draws from Gameweek 1 to the latest completed fixture (`CLS < 0.05`).

---

## 2. Component Locations & Affected Files
* **Main Trajectory & Metrics Chart:** `components/analytics/TrajectoryChart.tsx`
* **Services & Metric Metadata (if axis tier metadata is added):** `services/teamMetricsService.ts`

---

## 3. User Stories

### Story 1: Classic Black-and-White Football Marker & Progressive Bouncing Trajectory Draw
**As a** football supporter or analyst viewing club trajectories,  
**I want** data points rendered as classic high-contrast black-and-white stitched footballs, and I want to watch a football travel along the line as it draws—bouncing from gameweek node to gameweek node before coming to rest on the final fixture,  
**So that** the chart feels authentically football-native and visually dynamic without sacrificing clarity or layout stability.

### Story 2: Dynamic Dual Y-Axis for Multi-Metric Scale Splitting
**As a** performance analyst comparing multiple metrics with different magnitudes (e.g., `Goals Scored` on a `0–25` scale vs. `Corners` or `Shots` on a `40–180+` scale),  
**I want** the chart to dynamically split the metrics across a Left Y-Axis and Right Y-Axis with independent, intelligent scaling and color-matched axis ticks/labels,  
**So that** low-magnitude metrics are never flattened against the bottom axis and I can immediately read which axis scale belongs to each metric line.

---

## 4. Technical Specifications & Functional Requirements

### FR-1: Classic Black-and-White Stitched Football SVG Marker
1. **Visual Design (`<FootballDot />`):**
   * Replace the solid team-colored sphere with a classic **black-and-white Telstar-style stitched football**:
     * **Base Sphere:** Crisp white/off-white fill (`#F8FAFC`) with subtle inner shading so it pops cleanly against the dark `slate-950` chart canvas.
     * **Pentagon Panels & Seams:** High-contrast dark charcoal/black (`#0F172A`) center pentagon, perimeter partial pentagon patches at the sphere edge, and stitched seam arcs connecting the panels.
     * **Series Association Ring:** Render a thin (`1.5px` default, `2.2px` on active/hover) outer ring in the parent series line's hex color (`color`) around the black-and-white football so overlapping nodes from different series remain distinguishable.
   * **Dimensions:**
     * Standard gameweek node radius: `r = 6px` (`12x12px` diameter).
     * Hovered (`activeDot`) or lead travelling football radius: `r = 8px` (`16x16px` diameter).

### FR-2: Progressive Line-Draw & Travelling/Bouncing Football Kinematics
1. **Progressive SVG Line Stroke Animation:**
   * When a chart renders or updates (`viewMode`, `selectedTeamIds`, `activeComparisonMetric`, or `activeMetricKeys` changes), each primary series line draws progressively from the first completed gameweek (`GW 1`) to the final completed gameweek (`GW N`).
   * **Synchronized Duration (`T_total`):** Scale duration proportionally to the number of completed points `N` (`T_total = clamp(N * 65ms, 650ms, 1600ms)`), using linear progression so the stroke tip aligns with each gameweek node timestamp.
2. **Travelling & Bouncing Football Along the Trajectory:**
   * Render an animated lead football per active primary series that moves sequentially through the exact SVG pixel coordinates `[(x_0, y_0), (x_1, y_1), ..., (x_{N-1}, y_{N-1})]` of the rendered line path:
     * **Segment Interpolation:** Between consecutive gameweek nodes `P_i = (x_i, y_i)` and `P_{i+1} = (x_{i+1}, y_{i+1})` with normalized segment progress `u ∈ [0, 1]`:
       * Horizontal position: `x(u) = x_i + (x_{i+1} - x_i) * u`
       * Vertical position with parabolic bounce arc: `y(u) = y_i + (y_{i+1} - y_i) * u - 4 * H_bounce * u * (1 - u)` where `H_bounce = 12px` is the upward bounce apex height between gameweek nodes.
       * Rotational spin: Rotate the football inner seams/pentagons continuously (`360deg` per gameweek hop) as it bounces forward.
3. **Sequential Node Reveal & Final Fixture Rest:**
   * As the lead travelling football reaches each gameweek coordinate `P_i` at time `t_i = (i / Math.max(1, N - 1)) * T_total`, the static black-and-white `<FootballDot />` at `P_i` transitions from hidden (`opacity: 0, scale: 0.4`) to anchored (`opacity: 1, scale: 1`) with a brief landing settle.
   * Upon reaching the final completed fixture `P_{N-1}`, the travelling animation completes and the football rests cleanly on the final fixture node.
4. **Reduced Motion & Layout Stability (KR 1.1):**
   * If `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true, bypass the progressive travel loop and render all lines and static black-and-white football nodes immediately.
   * Maintain `CLS = 0.00` by executing all coordinate sampling and SVG transforms strictly inside the existing chart `<ResponsiveContainer>` layer.

### FR-3: Dynamic Dual Y-Axis & Intelligent Scaling (`viewMode === "team_metrics"`)
1. **Mode A — Single Metric Selected (`activeMetricKeys.length === 1`):**
   * Retain the single-metric combo behavior from `04-visualizer-charts-polish.md`:
     * **Left Y-Axis (`yAxisId="left"`):** Plots the selected cumulative metric line(s), with tick numbers and axis label colored in `singleActiveChip.color`.
     * **Right Y-Axis (`yAxisId="right"`):** Plots the semi-transparent per-gameweek `<Bar>` series, with tick numbers and axis label colored in `singleActiveChip.color`.
2. **Mode B — Multiple Metrics Selected (`activeMetricKeys.length >= 2`):**
   * **Per-Metric Peak Calculation:**
     * For each active metric `k ∈ activeMetricKeys`, compute its peak visible value `peak(k)` across all enabled baseline layers (`Current Progress`, `Last Year's Pace`, `Same Opponents`) within the visible X-axis domain (`1..maxVisibleGW`).
     * Assign a small positive floor based on natural metric scale if no matches are completed (`defaultPeak`: `10` for `cum_xg`, `cum_axg`, `cum_goals`, `cum_conceded`; `25` for `cum_points`; `45` for `cum_shots_on_target`, `cum_shots_off_target`, `cum_corners`).
   * **Dynamic Left / Right Axis Partitioning Algorithm:**
     * **Case B1 (Exactly 2 Metrics Selected):**
       * If their peaks differ noticeably (`maxPeak / minPeak >= 1.35`) or they belong to different scale tiers, assign the **lower-peak metric** to `yAxisId="left"` and the **higher-peak metric** to `yAxisId="right"`.
       * Even if their peaks are close (`< 1.35`), assign the first metric to `yAxisId="left"` and the second metric to `yAxisId="right"` with independent auto-scaled domains (`[0, Math.ceil(peak * 1.15)]`) so each metric gets its own dedicated, color-matched Y-Axis!
     * **Case B2 (3 or More Metrics Selected):**
       * Compute `minPeak = min_k(peak(k))` and `maxPeak = max_k(peak(k))`.
       * If `maxPeak / Math.max(1, minPeak) >= 1.5`:
         * Compute the geometric split threshold: `splitThreshold = Math.sqrt(maxPeak * Math.max(1, minPeak))`.
         * **Left Y-Axis Group (`yAxisId="left"`):** All active metrics with `peak(k) <= splitThreshold` (the lower-magnitude metrics, e.g., `Cum. xG`, `Goals Scored`, `Goals Conceded`).
         * **Right Y-Axis Group (`yAxisId="right"`):** All active metrics with `peak(k) > splitThreshold` (the higher-magnitude metrics, e.g., `Points`, `Shots on Target`, `Shots Off Target`, `Corners`).
       * If all 3+ selected metrics have virtually identical peaks (`maxPeak / Math.max(1, minPeak) < 1.5`), partition by natural scale tier (`low`: `cum_xg`, `cum_axg`, `cum_goals`, `cum_conceded` on Left; `high`: `cum_points`, `cum_shots_on_target`, `cum_shots_off_target`, `cum_corners` on Right), falling back to Left-only if all belong to the exact same tier and scale.
   * **Independent Intelligent Axis Domains:**
     * **Left Y-Axis Domain:** `[0, Math.max(5, Math.ceil(leftGroupMax * 1.15))]` when zoomed (or `[0, "auto"]` with `15%` headroom), ensuring low-volume metrics expand across the full vertical height of the chart.
     * **Right Y-Axis Domain:** `[0, Math.max(10, Math.ceil(rightGroupMax * 1.15))]` when Right Y-Axis has assigned metrics.
3. **Color-Matched Y-Axis Ticks, Labels & Legend Indicators:**
   * **Left Y-Axis Styling:**
     * `stroke={leftAxisPrimaryColor}`
     * `tick={{ fill: leftAxisPrimaryColor, fontSize: 11, fontWeight: 600 }}`
     * `label={{ value: leftAxisTitle, angle: -90, position: "insideLeft", fill: leftAxisPrimaryColor }}` where `leftAxisTitle` joins the `shortLabel`s of metrics on the Left axis (e.g., `"xG / GF (Cum.)"` or `"Cum. xG"`).
   * **Right Y-Axis Styling (when active):**
     * `stroke={rightAxisPrimaryColor}`
     * `tick={{ fill: rightAxisPrimaryColor, fontSize: 11, fontWeight: 600 }}`
     * `label={{ value: rightAxisTitle, angle: 90, position: "insideRight", fill: rightAxisPrimaryColor }}` where `rightAxisTitle` joins the `shortLabel`s of metrics on the Right axis (e.g., `"PTS / SoT (Cum.)"` or `"Corners (Cum.)"`).
   * **Multi-Metric Axis Color Clarity:**
     * When a single metric occupies an axis, the axis ticks and title use that metric's exact `chip.color`.
     * When multiple metrics share an axis, use the primary (first) metric's `chip.color` for the tick numbers and render a custom SVG axis label or legend indicator showing each metric's color dot and `(L)` / `(R)` axis badge so the analyst immediately knows which axis each curve uses.

---

## 5. Gherkin Acceptance Scenarios

```gherkin
Feature: Classic Football Drawing Kinematics & Dynamic Dual Y-Axis

  Background:
    Given the user is on "/visualizer" connected to the "dev" Supabase schema

  # -------------------------------------------------------------------------
  # CLASSIC B&W FOOTBALL MARKERS & PROGRESSIVE BOUNCING DRAW
  # -------------------------------------------------------------------------

  Scenario: Data points render as classic black-and-white stitched footballs
    When the trajectory chart renders completed matchdays for any selected club
    Then each gameweek node displays a white football sphere ("#F8FAFC") with black pentagon panels ("#0F172A") and seam lines
    And each football marker includes a subtle outer ring colored to match its series line

  Scenario: Progressive line draw with travelling bouncing football kinematics
    Given the user selects a new club crest or toggles a metric series
    When the chart begins drawing the trajectory line from Gameweek 1 to the latest completed Gameweek N
    Then the SVG line stroke draws progressively from left to right
    And a lead black-and-white football travels along the trajectory, bouncing in a parabolic arc between each gameweek node
    And each intermediate gameweek node reveals its anchored football marker as the travelling ball bounces past it
    And the football comes to rest on the final completed fixture node

  # -------------------------------------------------------------------------
  # DYNAMIC DUAL Y-AXIS FOR MULTI-METRIC SCALE SPLITTING
  # -------------------------------------------------------------------------

  Scenario: Two metrics with different scales split across color-matched Left and Right Y-Axes
    Given "Team Metrics" mode is active for "Arsenal"
    When the user selects "Goals Scored" (0–25 scale, "#0ea5e9") and "Corners" (50–150+ scale, "#eab308")
    Then "Goals Scored" is bound to the Left Y-Axis ("yAxisId='left'") scaled to its own domain
    And "Corners" is bound to the Right Y-Axis ("yAxisId='right'") scaled to its own domain
    And the Left Y-Axis tick numbers and label are colored "#0ea5e9"
    And the Right Y-Axis tick numbers and label are colored "#eab308"
    And neither metric line is compressed flat at the bottom of the canvas

  Scenario: Default 3-metric selection ("Cum. xG", "Goals Scored", "Points") splits low vs high scale metrics
    Given "Team Metrics" mode is active with default metrics ("cum_xg", "cum_goals", "cum_points")
    When the chart computes peak values across completed matchdays
    Then lower-magnitude metrics ("Cum. xG", "Goals Scored") plot against the Left Y-Axis
    And higher-magnitude metric ("Points") plots against the Right Y-Axis
    And both Y-axes display color-matched tick numbers and metric labels ("xG · GF" on Left, "PTS" on Right)

  Scenario: Single metric selection preserves per-match bar overlay on Right Y-Axis
    Given "Team Metrics" mode is active
    When only "Cum. xG" is selected ("activeMetricKeys.length === 1")
    Then the cumulative "Cum. xG" line plots on the Left Y-Axis
    And the semi-transparent per-match "match_xg" bars plot on the Right Y-Axis
    And both axes are color-matched to "#10b981"
```

---

## 6. Type Definitions & Helper Contracts

```typescript
// Axis assignment contract inside components/analytics/TrajectoryChart.tsx
export type AxisSide = "left" | "right";

export interface MetricAxisAssignment {
  axisByKey: Record<TeamMetricKey, AxisSide>;
  leftKeys: TeamMetricKey[];
  rightKeys: TeamMetricKey[];
  leftDomain: [number, number | "auto"];
  rightDomain: [number, number | "auto"];
  leftColor: string;
  rightColor: string;
  leftLabel: string;
  rightLabel: string;
  hasRightAxis: boolean;
}

export interface NodeCoordinate {
  x: number;
  y: number;
  gameweek: number;
  value: number;
}
```
