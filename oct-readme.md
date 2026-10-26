# Football Data Visualizer: Model & Pipeline Architecture

## 1. High-Level Architecture Overview

The modeling pipeline operates across a two-step process:
1. **Tactical Profiling (`scripts/fetch_tactical_data.py`):** Harvests underlying team and match metrics, normalizes team style tendencies, computes baseline ratings (`floor`, `ceiling`), calculates squad variance (`chaos_index`), and writes the profiles to Supabase (`team_tactical_profiles`).
2. **Prediction Engine (`scripts/sync_upcoming_predictions.py`):** Ingests match schedules and completed match scores from the football data API, retrieves the tactical profiles, computes fixture win/draw/loss probabilities using tactical matchup logic and favorite tapering, and writes the results to Supabase (`match_predictions`).

                ┌───────────────────────────┐
                │     FBref Data Scraping   │
                └─────────────┬─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │  fetch_tactical_data.py   │
                │   - Feature engineering   │
                │   - Archetype scoring     │
                │   - Floor / Ceiling /     │
                │     Chaos computation     │
                └─────────────┬─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │         Supabase          │
                │ (team_tactical_profiles)  │
                └─────────────┬─────────────┘
                              │
      ┌───────────────────────┴───────────────────────┐
      │                                               │
      ▼                                               ▼
┌───────────────────────────┐               ┌───────────────────────────┐
│ Football API (Fixtures)   │               │ Next.js Frontend UI       │
└─────────┬─────────────────┘               │ (Reads Supabase directly) │
│                                 └───────────────────────────┘
▼
┌───────────────────────────┐
│sync_upcoming_predictions  │
│ - Home advantage weighting│
│ - Archetype clash modifier│
│ - Tapered Softmax engine  │
└─────────┬─────────────────┘
│
▼
┌───────────────────────────┐
│         Supabase          │
│    (match_predictions)    │
└───────────────────────────┘


---

## 2. Underlying Metrics Collected (`fetch_tactical_data.py`)

Metrics are harvested per club and standardized per 90 minutes (p90) to measure style and performance efficiency:

| Category | Raw Features Harvested | Purpose |
| :--- | :--- | :--- |
| **Possession & Control** | `possession` (%), passes completed, field tilt | Measures field dominance and game tempo dictation. |
| **Attacking Output** | `goals_scored`, `xG`, `npxG`, shots p90 | Quantifies baseline threat generation and conversion efficiency. |
| **Directness & Aerial** | `crosses`, `crosses_p90`, progressive passes, long ball % | Measures vertical speed, reliance on wide delivery, and aerial box loading. |
| **Defensive Intensity** | `tackles_won`, `interceptions`, `tkl_int_p90`, `fouls_p90`, `yellow_cards` | Captures pressing frequency, aggressive disruptions, and game disruption. |

---

## 3. Tactical Archetype Scoring

Metrics are normalized into three tactical dimension scores scaled from **0.0 to 100.0**:

* **`score_control`:**
  * **Core Drivers:** High possession %, passing volume, territorial tilt, and sustained build-up play.
  * **Characteristics:** Minimizes counter-attack exposure, controls game tempo, and limits turnover chaos.
* **`score_transition`:**
  * **Core Drivers:** Defensive disruptions (`tkl_int_p90`, interceptions) combined with high-pace vertical progression into open space.
  * **Characteristics:** Excels when exploiting high defensive lines; thrives off opponent turnovers.
* **`score_direct`:**
  * **Core Drivers:** Aerial volume, cross frequency (`crosses_p90`), direct long balls, and physical challenges (`fouls_p90`).
  * **Characteristics:** Bypasses midfield duels; relies on set pieces, second balls, and penalty-box loading.

### Dominant Archetype Assignment
A team's designated `archetype` (`Control`, `Transition`, or `Direct`) is assigned by identifying the primary statistical tendency or clustering threshold across these three scores.

---

## 4. Performance Boundaries & Variance

Rather than relying on a single static rating, each club has performance boundaries:

### Baseline Floor (`floor`)
* Represents a club's minimum expected output in difficult or adverse game states.
* Anchored in defensive stability, non-penalty xG conceded, and possession security.
* Strong, deep squads maintain high floors; unstable defensive teams fall toward low baselines.

### Peak Ceiling (`ceiling`)
* Represents the maximum offensive and tactical capacity when the team is in form.
* Driven by top-end xG creation, shot generation volume, and elite finishing capabilities.

### Chaos Index (`chaos_index`)
* Quantifies match-to-match variance and volatility.
* Derived from the spread between `floor` and `ceiling`, weighted by high-volatility events (foul counts, card exposure, crossing volume, and open-game transition phases).
* **Low Chaos:** Highly predictable match flow; results closely follow model talent margins.
* **High Chaos:** Wide performance distribution; higher likelihood of upsets, high-scoring games, or volatile game scripts.

---

## 5. Match Prediction Engine (`sync_upcoming_predictions.py`)

Upcoming fixture forecasts calculate outcome probabilities (`prob_home`, `prob_draw`, `prob_away`) through the following sequence:

### Step 1: Base Rating Calculation
Each club's operational rating is constructed by combining their floor and ceiling baselines:
$$\text{Base Rating} = w_f \cdot \text{Floor} + w_c \cdot \text{Ceiling}$$

### Step 2: Home Advantage Offset
A league-calibrated home boost is added to the home team's effective rating:
$$\text{Rating}_{\text{Home, adj}} = \text{Rating}_{\text{Home}} + \Delta_{\text{home\_advantage}}$$

### Step 3: Tactical Clash Dynamics (`clash_type`)
The engine evaluates the interaction between opposing archetypes:
* **Transition vs Control:** Transition teams receive an edge when facing possession-heavy sides with vulnerable defensive transitions.
* **Direct vs Transition:** Direct sides neutralise midfield presses by using long passes and aerial duels.
* **Control vs Direct:** Low-block, direct teams challenge control-oriented sides that lack box penetration.

### Step 4: Chaos Adjustment & Favorite Tapering
1. **Variance Expansion:** A higher combined `chaos_index` flattens extreme edges, shifting probability mass toward the draw and the underdog.
2. **Piecewise Probability Tapering:** Raw odds run through a piecewise dampening function that prevents heavy favorites from generating unrealistically high win expectations, keeping output aligned with Premier League historical variance.
3. **Softmax Output:** Produces final calibrated percentages that sum to 100%:
   * `prob_home`
   * `prob_draw`
   * `prob_away`

---

## 6. Execution Commands

### Local Recalibration (Avoids Datacenter IP Blocks)
To run the full pipeline locally from the repository root:

```powershell
# 1. Scrape FBref, calculate archetypes, and push to Supabase
py scripts/fetch_tactical_data.py

# 2. Sync fixture results and recalculate upcoming predictions
py scripts/sync_upcoming_predictions.py
Automation Architecture
Trigger: HTTP POST request with x-admin-secret authentication header.

Gateway: Next.js Pages Router endpoint (pages/api/admin/recalibrate.ts).

Dispatch: GitHub Actions workflow (.github/workflows/recalibrate.yml).

Persistence: Supabase tables (team_tactical_profiles, match_predictions).

Frontend: Dynamic reads from Supabase on client/server rendering (updates immediately upon table upsert).