# Task Spec: Step 5 - V2 Frontend Dashboard & Model Comparison View

## Objective
Build a dedicated V2 tactical analysis and prediction view accessible from the home screen (`/v2` or a distinct navigable section). The page must display V2 predictions across all gameweeks (both completed matchdays with actual scores and upcoming matchdays with probabilities) while offering a toggle switch to display the **Legacy V1 Model vs. V2 Model side-by-side**.

---

## 1. Routing & Navigation
- Add a clear navigation link/button on the main home screen (e.g., in the header or primary nav bar): **"Tactical Engine V2"** pointing to `/v2`.
- Provide a clean return link back to the primary `/` dashboard.

---

## 2. Core Page Features (`/v2`)

### A. Gameweek Navigation & Results Tracking
- Maintain the same gameweek selector / pagination present on the main dashboard:
  - Allow users to browse from Matchday 1 through Matchday 38.
  - **Completed Matchdays (`FINISHED`)**: Display full-time scores, whether the model's top predicted outcome was correct, and aggregate overall prediction accuracy/hit rate up to the current matchday.
  - **Upcoming Matchdays (`SCHEDULED` / `TIMED`)**: Display calibrated win/draw/loss probabilities, net tactical delta, and volatility ratings.
  - Include an explicit note/badge on upcoming gameweeks: *"Dynamic Forecast: Probabilities dynamically recalibrate before kickoff based on latest team form and tactical shifts."*

### B. Dual-Model Comparison Toggle
- Implement a prominent toggle switch at the top of the matchday view:
  - **Single View (V2 Focus)**: Displays only the new 4-pillar tactical engine data, matchup deltas, and probability bars.
  - **Side-by-Side Comparison**: Splits each match card or displays a comparison table showing:
    - **V1 (Legacy Archetype Model)**: Probabilities from `public.match_predictions` and archetypes from `public.team_tactical_profiles`.
    - **V2 (Multi-Pillar Tactical Model)**: Probabilities from `public.match_predictions_v2`, floor/ceiling bounds, and tactical deltas.
    - **Delta Highlight**: Visual badge highlighting divergence between models (e.g., when V2 favors an upset or draw that V1 missed due to tactical matchup deltas).

### C. Tactical Breakdown Inspector
- Clicking on a match card reveals the 4 head-to-head matchup pillars:
  1. Box Delivery & Aerial Threat vs. Aerial Box Suppression
  2. Central Penetration vs. Central Space Denial
  3. Transition Speed vs. Rest Defense
  4. Perimeter Chaos vs. Distance Suppression

---

## 3. Data Ingestion (Supabase Client Queries)
- When querying V2 data:
  - Query `public.match_predictions_v2` for fixtures, odds, and status.
  - Query `public.team_tactical_profiles_v2` for 8-pillar vector breakdowns.
- When Comparison Mode is active:
  - Join or concurrently fetch matching `match_id` records from `public.match_predictions` to show parallel odds.

---

## 4. UI Style & Consistency
- Match the existing dark-mode design system, fonts, and Tailwind/CSS configurations.
- Ensure all charts, probability bars, and badges are responsive on mobile and desktop.