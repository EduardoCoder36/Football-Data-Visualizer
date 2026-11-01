# Requirements Specification: Visualizer Charts Polish (Team Comparison & Team Metrics)

## 1. Overview & Strategic Alignment
* **Target Branch:** `feat/agentic-visualizer-polish`
* **Database Target:** `dev` schema (`NEXT_PUBLIC_SUPABASE_SCHEMA=dev`) — *Note: This specification covers frontend visualization and data transformation logic only; zero database DDL or schema mutations are required.*
* **Roadmap Alignment ([docs/ROADMAP_OKRS.md](../docs/ROADMAP_OKRS.md)):**
  * **Pillar 1 (Team & League Process Analytics):** Unifies and polishes the interactive **Team Comparison** and **Team Metrics** visualizers.
  * **KR 1.1 (Visual Polish & Tactical Animations):** Introduces copyright-safe club crests, custom color-matched football data markers, a point-to-point bouncing football line-draw animation, and a dual-axis cumulative/per-match combo view while maintaining `CLS < 0.05`.
* **Out of Scope for This Iteration:**
  * Historical baseline logic alterations (Section 3 of interview).
  * One-click chart export and visual citation watermarks (KR 1.2 / Section 4 of interview).

---

## 2. Component Locations & Affected Files
* **Visualizer Page Container:** `pages/visualizer.tsx`
* **Unified Team Crest Selector Bar:** `components/analytics/TeamSelectorBar.tsx`
* **Copyright-Safe Generic Club Crest SVG Component (New):** `components/analytics/GenericTeamCrest.tsx`
* **Custom Football Point Marker & Bounce Animation (New/Internal):** `components/charts/FootballDot.tsx` (or co-located within `TrajectoryChart.tsx`)
* **Main Trajectory & Metrics Chart:** `components/analytics/TrajectoryChart.tsx`
* **Team Metrics Data Service:** `services/teamMetricsService.ts` (expose `match_shots_on_target`, `match_shots_off_target`, and `match_corners` on `TeamMetricPoint` alongside existing `match_xg`, `match_axg`, `match_goals`, `match_conceded`, and `match_points`)

---

## 3. User Stories

### Story 1: Unified Copyright-Safe Team Crest Selector
**As a** football analyst or supporter,  
**I want** both the *Team Comparison* and *Team Metrics* charts to use a consistent selector bar featuring copyright-safe, recognizable generic club crests,  
**So that** I can switch teams seamlessly across both views with a cohesive visual identity and zero trademark/copyright risk.

### Story 2: Enforced Selection Rules (2-Team Cap & Auto-Deselect)
**As a** platform user comparing clubs or drilling into a single club's metrics,  
**I want** *Team Comparison* to cap selections at 2 teams (with a clear inline warning if I click a 3rd) and *Team Metrics* to automatically replace the active team when I click a new crest,  
**So that** the comparison chart stays uncluttered and single-team metric exploration requires only one click.

### Story 3: Football Data Point Markers & Bouncing Draw Animation
**As a** user exploring gameweek trajectories,  
**I want** each data point on the graph rendered as a small football matching the line's color, with a football bouncing from point to point as the line draws,  
**So that** the chart delivers a tactile, football-native visual experience aligned with KR 1.1.

### Story 4: Single-Metric Per-Gameweek Bar Overlay (Dual-Axis Combo Chart)
**As a** tactical analyst inspecting a single metric on the *Team Metrics* chart,  
**I want** semi-transparent bars showing each individual gameweek's output plotted on a secondary Y-axis behind the cumulative trend line,  
**So that** I can immediately see match-by-match spikes and dips alongside the cumulative season trajectory.

---

## 4. Functional Requirements

### FR-1: Copyright-Safe Generic Team Crests (`GenericTeamCrest.tsx`)
1. Replace all `<img src={team.crestUrl} />` usage in `TeamSelectorBar.tsx` with a procedural SVG component `<GenericTeamCrest team={team} />`.
2. Each crest must render a classic shield/badge silhouette styled with the club's recognizable traditional home colors and kit motif (e.g., solid red body with white sleeves for `ARS`, black-and-white vertical stripes for `NEW`, claret body with sky-blue sleeves/trim for `AVL` and `WHU`, sky blue with white trim for `MCI`, royal blue for `CHE`/`EVE`, etc.).
3. Overlay a crisp, high-contrast 3-letter club code (`team.tla`, e.g., `ARS`, `LIV`, `MCI`) centered on a banner or shield band so every club is immediately identifiable at `40x40px`.
4. Provide a deterministic fallback shield pattern (using `getTeamColor(team.id, index)` + `team.tla`) for any newly promoted or unmapped club IDs.

### FR-2: Unified Selector Bar & Selection Behavior (`visualizer.tsx`, `TeamSelectorBar.tsx`, `TrajectoryChart.tsx`)
1. **Always Render `TeamSelectorBar`:** Render `<TeamSelectorBar />` at the top of `pages/visualizer.tsx` in **both** `comparison` and `team_metrics` modes.
2. **Remove Legacy Dropdown:** Remove the `<select>` club dropdown inside `TrajectoryChart.tsx` when `viewMode === "team_metrics"`.
3. **Team Comparison Mode (`viewMode === "comparison"`):**
   * **Maximum Selection Cap:** Reduce the maximum number of concurrently selected teams from `4` to `2`.
   * **Minimum Selection Floor:** At least `1` team must remain selected at all times.
   * **Exceeding Cap Error Feedback:** When 2 teams are already selected and the user clicks an unselected 3rd team crest:
     * Do **not** add the 3rd team to `selectedTeamIds`.
     * Keep unselected buttons clickable (do not use native `disabled` that swallows click events) so clicking triggers feedback.
     * Display a compact, non-layout-shifting inline alert/toast pill in the selector bar header: `"Maximum of 2 teams can be selected. Please deselect an existing team first."`
     * Auto-dismiss the alert after `3.5 seconds` or immediately when the user deselects an active team.
4. **Team Metrics Mode (`viewMode === "team_metrics"`):**
   * **Single-Team Exclusive Selection:** Only `1` team is active at a time (`selectedTeamIds[0]`).
   * **One-Click Swap:** Clicking any unselected team crest in `TeamSelectorBar` immediately deselects the current team and selects the newly clicked team (`setSelectedTeamIds([clickedTeamId])`).
   * **Mode Switching Sync:** When switching from `comparison` (with 2 teams selected) to `team_metrics`, `selectedTeamIds` must normalize to `[selectedTeamIds[0]]` so `TeamSelectorBar` highlights only the single active club being inspected.

### FR-3: Custom Football Markers & Bouncing Draw Animation (`TrajectoryChart.tsx`)
1. **Static Football Markers:**
   * Replace the default circular Recharts `dot` on primary trajectory lines (`current` series in both `comparison` and `team_metrics` modes) with a custom SVG football icon marker (`~10x10px` to `12x12px`).
   * Color the football's primary panels/stitching to match the parent line's stroke hex color (`baseColor` in *Team Comparison*, `chip.color` in *Team Metrics*) with a dark slate outer contrast ring (`#0f172a`) for legibility.
   * Hovering a point (`activeDot`) scales the football marker up (`~15x15px`) with a crisp white highlight ring.
2. **Point-to-Point Bouncing Football Animation:**
   * When a line draws or updates (initial mount, team selection change, or metric toggle), animate the line drawing from left to right while a lead football marker bounces along small parabolic arcs from gameweek point `N` to `N+1`.
   * As the animation passes each gameweek coordinate, the static color-matched football marker remains anchored on that data point.
   * Total draw animation duration should remain snappy (`~800ms–1200ms` total across visible gameweeks) and respect `prefers-reduced-motion`.
   * **Zero Layout Shift (KR 1.1):** All SVG markers and animations must render strictly within the existing fixed-height `ResponsiveContainer` canvas (`h-[400px] sm:h-[500px]`) with `CLS = 0`.

### FR-4: Single-Metric Per-Gameweek Bars & Dual Y-Axis (`TrajectoryChart.tsx`, `teamMetricsService.ts`)
1. **Activation Condition:**
   * In `viewMode === "team_metrics"`, when **exactly 1 metric chip is active** (`activeMetricKeys.length === 1`), enable the **Per-Gameweek Bar Overlay**.
   * When `0` or `2+` metrics are active in `team_metrics` mode (or when in `comparison` mode), render only the lines without bars.
2. **Data Completeness (`services/teamMetricsService.ts`):**
   * Extend `TeamMetricPoint` to expose single-match raw values for all 8 supported metric keys:
     * `cum_xg` → `match_xg`
     * `cum_axg` → `match_axg`
     * `cum_goals` → `match_goals`
     * `cum_conceded` → `match_conceded`
     * `cum_points` → `match_points`
     * `cum_shots_on_target` → `match_shots_on_target` *(add to `TeamMetricPoint` return payload)*
     * `cum_shots_off_target` → `match_shots_off_target` *(add to `TeamMetricPoint` return payload)*
     * `cum_corners` → `match_corners` *(add to `TeamMetricPoint` return payload)*
3. **Dual Y-Axis Configuration (`ComposedChart`):**
   * Replace `<LineChart>` with Recharts `<ComposedChart>` in `TrajectoryChart.tsx`.
   * **Left Y-Axis (`yAxisId="left"`):** Bound to cumulative lines (`[0, maxCumulative * 1.15]`), labeled `"Cumulative Total"`.
   * **Right Y-Axis (`yAxisId="right"`, `orientation="right"`):** Rendered only when `activeMetricKeys.length === 1`, bound to the per-gameweek `<Bar>` series (`[0, maxSingleMatchValue * 1.35]`), labeled `"Per Match (${chip.shortLabel})"`.
4. **Bar Visual Styling:**
   * Fill color matches the active metric's `chip.color`.
   * Apply semi-transparency (`fillOpacity={0.25}`, stroke `chip.color` with `strokeOpacity={0.45}`) and subtle rounded top corners (`radius={[4, 4, 0, 0]}`) so the bars sit cleanly behind the cumulative line and football markers without visual clutter.
5. **Tooltip Integration:**
   * When 1 metric is active, the matchday tooltip must display both:
     * **Cumulative Series Value(s):** e.g., `Cum. xG (Current): 18.42 xG`
     * **Single-Match Bar Value:** e.g., `Matchday xG: 2.15 xG`

---

## 5. Gherkin Acceptance Scenarios

```gherkin
Feature: Visualizer Charts Polish (Team Comparison & Team Metrics)

  Background:
    Given the user navigates to "/visualizer"
    And the application is connected to the "dev" Supabase schema

  # -------------------------------------------------------------------------
  # GENERIC CRESTS & SELECTOR CONSISTENCY
  # -------------------------------------------------------------------------

  Scenario: Generic copyright-safe crests render in both visualizer modes
    When the visualizer loads in "Team Comparison" mode
    Then the "TeamSelectorBar" displays procedural SVG shield crests with 3-letter TLA codes for all active clubs
    And zero external "crest_url" image requests are made
    When the user switches to "Team Metrics" mode
    Then the same "TeamSelectorBar" remains visible at the top of the page
    And the legacy club "<select>" dropdown is not rendered

  # -------------------------------------------------------------------------
  # TEAM SELECTION RULES & 2-TEAM CAP
  # -------------------------------------------------------------------------

  Scenario: User selects up to 2 teams in Team Comparison mode (Happy Path)
    Given "Team Comparison" mode is active with "ARS" selected by default
    When the user clicks the crest for "MCI"
    Then both "ARS" and "MCI" crests are highlighted as selected
    And the comparison chart plots trajectory lines for both "ARS" and "MCI"

  Scenario: User attempts to select a 3rd team in Team Comparison mode (Validation Error)
    Given "Team Comparison" mode is active with "ARS" and "MCI" selected
    When the user clicks the unselected crest for "LIV"
    Then "LIV" is not added to the chart
    And an inline warning message appears stating "Maximum of 2 teams can be selected. Please deselect an existing team first."
    When the user clicks "MCI" to deselect it
    Then the warning message clears immediately

  Scenario: Clicking a new team in Team Metrics mode automatically replaces the current team
    Given "Team Metrics" mode is active with "ARS" selected
    When the user clicks the crest for "LIV" in the "TeamSelectorBar"
    Then "ARS" is automatically deselected
    And "LIV" becomes the sole selected team
    And the Team Metrics chart reloads telemetry for "Liverpool"

  # -------------------------------------------------------------------------
  # FOOTBALL MARKERS, BOUNCING ANIMATION & SINGLE-METRIC BARS
  # -------------------------------------------------------------------------

  Scenario: Data points render as color-matched football icons with bouncing draw animation
    Given the user is viewing a trajectory chart with completed matchdays
    When a series line is drawn on the canvas
    Then a football marker bounces sequentially from point to point along the curve
    And each completed matchday point retains a static football icon colored to match the parent line
    And Cumulative Layout Shift (CLS) remains 0.00

  Scenario: Selecting a single metric in Team Metrics renders semi-transparent per-match bars
    Given "Team Metrics" mode is active
    And "Cum. xG" is the only active metric chip ("activeMetricKeys.length === 1")
    Then the chart renders a right-hand Y-axis for "Per Match (xG)"
    And semi-transparent green bars ("fillOpacity: 0.25") render at each completed gameweek for "match_xg"
    And the cumulative "cum_xg" line and football markers render in the foreground on the left-hand Y-axis

  Scenario: Selecting multiple metrics in Team Metrics hides per-match bars
    Given "Team Metrics" mode is active with only "Cum. xG" selected
    When the user activates a second metric chip "Goals Scored"
    Then the per-match bars and right-hand Y-axis are hidden
    And both cumulative lines render against the left-hand Y-axis
```

---

## 6. Type Definitions & Data Contracts

```typescript
// Services Layer: services/teamMetricsService.ts
export interface TeamMetricPoint {
  gameweek: number;
  is_completed: boolean;
  match_date: string | null;
  opponent_name: string | null;
  is_home: boolean | null;
  score_display: string | null;
  baseline_score_display?: string | null;
  same_opp_score_display?: string | null;
  // Single-Match Raw Values (for Per-Gameweek Bar Overlay)
  match_goals: number | null;
  match_conceded: number | null;
  match_xg: number | null;
  match_axg: number | null;
  match_points: number | null;
  match_shots_on_target: number | null;
  match_shots_off_target: number | null;
  match_corners: number | null;
  // Cumulative Values (Current, Baseline, Same Opponent)
  cum_xg: number | null;
  cum_axg: number | null;
  cum_goals: number | null;
  cum_conceded: number | null;
  cum_points: number | null;
  cum_shots_on_target: number | null;
  cum_shots_off_target: number | null;
  cum_corners: number | null;
  cum_xg_baseline: number | null;
  cum_axg_baseline: number | null;
  cum_goals_baseline: number | null;
  cum_conceded_baseline: number | null;
  cum_points_baseline: number | null;
  cum_shots_on_target_baseline: number | null;
  cum_shots_off_target_baseline: number | null;
  cum_corners_baseline: number | null;
  cum_xg_same_opp: number | null;
  cum_axg_same_opp: number | null;
  cum_goals_same_opp: number | null;
  cum_conceded_same_opp: number | null;
  cum_points_same_opp: number | null;
  cum_shots_on_target_same_opp: number | null;
  cum_shots_off_target_same_opp: number | null;
  cum_corners_same_opp: number | null;
}

export interface MetricChipConfig {
  key: TeamMetricKey;
  matchKey:
    | 'match_xg'
    | 'match_axg'
    | 'match_goals'
    | 'match_conceded'
    | 'match_points'
    | 'match_shots_on_target'
    | 'match_shots_off_target'
    | 'match_corners';
  label: string;
  shortLabel: string;
  color: string;
  unit: string;
  isFloat?: boolean;
}
```
