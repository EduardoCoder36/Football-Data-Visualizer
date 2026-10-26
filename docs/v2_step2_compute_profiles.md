# Task Spec: Step 2 - Compute V2 Tactical Profiles from Raw Stats

## Objective
Build a Python script `scripts/compute_tactical_profiles_v2.py` that reads the aggregated records from Supabase table `team_raw_stats`, applies possession-normalized feature engineering, scales the 4 attacking and 4 defensive pillars onto a 0–100 percentile/min-max distribution, calculates baseline bounds (`floor`, `ceiling`, `chaos_index`), and upserts the result into `team_tactical_profiles_v2`.

Do NOT modify or delete the legacy `team_tactical_profiles` table or existing production prediction tables.

---

## 1. Destination Table
- **Table Name**: `public.team_tactical_profiles_v2`
- **Primary Key**: `id` (matches `team_raw_stats.id`, e.g. `arsenal_2026_2027`)
- **Columns to Populate**:
  - `id`, `team`, `season`, `matches_played`, `possession_proxy`
  - Attacking Pillars (0–100):
    - `atk_box_aerial`
    - `atk_central_penetration`
    - `atk_transition_speed`
    - `atk_perimeter_chaos`
  - Defensive Pillars (0–100):
    - `def_box_aerial_suppression`
    - `def_central_space_denial`
    - `def_rest_defense`
    - `def_perimeter_suppression`
  - Bounds & Context:
    - `floor` (0–100)
    - `ceiling` (0–100)
    - `chaos_index` (0–100)
    - `updated_at` (NOW)

---

## 2. Normalization & Feature Formulas

All rate stats must be normalized per match (`/ matches_played`). 
Let $P = \text{possession\_proxy}$ (clamped between 0.20 and 0.80 to avoid division by zero).

### In-Possession & Out-of-Possession Scaling
- In-Possession Factor: $F_{\text{in}} = \frac{0.50}{P}$
- Out-of-Possession Factor: $F_{\text{out}} = \frac{0.50}{1.0 - P}$

### A. Attacking Profiles (Possession-Adjusted)
1. **`atk_box_aerial` (Cross / Set Piece / Head Threat)**
   - Metric A: `shots_head_p90` $\times F_{\text{in}}$
   - Metric B: `xg_head_p90` $\times F_{\text{in}}$
   - Metric C: `xg_set_piece_p90` $\times F_{\text{in}}$
   - Metric D: `corners_won_p90` $\times F_{\text{in}}$
   - Blend: $0.35 \cdot S(\text{xg\_set\_piece}) + 0.35 \cdot S(\text{xg\_head}) + 0.15 \cdot S(\text{shots\_head}) + 0.15 \cdot S(\text{corners})$

2. **`atk_central_penetration` (Through Balls / 20m Deep Passes / Cutbacks)**
   - Metric A: `deep_completions_p90` $\times F_{\text{in}}$
   - Metric B: `shots_inside_box_p90` $\times F_{\text{in}}$
   - Metric C: `xg_open_play_p90` $\times F_{\text{in}}$
   - Blend: $0.40 \cdot S(\text{deep\_completions}) + 0.30 \cdot S(\text{xg\_open\_play}) + 0.30 \cdot S(\text{shots\_inside\_box})$

3. **`atk_transition_speed` (Fast Break / Counter xG / Turnover Pressure)**
   - Metric A: `shots_counter_p90` $\times F_{\text{in}}$
   - Metric B: `xg_counter_p90` $\times F_{\text{in}}$
   - Metric C: `ppda_inverted` = $100.0 - \text{min\_max}(\text{ppda})$ (Lower PPDA = aggressive pressing turnover threat)
   - Blend: $0.45 \cdot S(\text{xg\_counter}) + 0.25 \cdot S(\text{shots\_counter}) + 0.30 \cdot S(\text{ppda\_inverted})$

4. **`atk_perimeter_chaos` (Distance Striking / Speculative Shooting)**
   - Metric A: `shots_outside_box_p90` $\times F_{\text{in}}$
   - Metric B: `avg_shot_distance`
   - Metric C: `long_range_threat` = `goals_outside_box` / max(`shots_outside_box`, 1)
   - Blend: $0.40 \cdot S(\text{shots\_outside}) + 0.30 \cdot S(\text{avg\_distance}) + 0.30 \cdot S(\text{long\_range\_threat})$

### B. Defensive Profiles (Out-of-Possession Suppression — Higher is Better Defense)
For all defensive metrics, low conceded volume means elite defense. Invert values so $100 = \text{best suppression}, 0 = \text{worst}$.

1. **`def_box_aerial_suppression`**
   - Conceded: `(xga_head + xga_set_piece)_p90` $\times F_{\text{out}}$
   - Invert: $100 - S(\text{conceded})$

2. **`def_central_space_denial`**
   - Conceded: `(deep_allowed + npxga)_p90` $\times F_{\text{out}}$
   - Invert: $100 - S(\text{conceded})$

3. **`def_rest_defense`**
   - Conceded: `(shots_counter_conceded + xga_counter)_p90` $\times F_{\text{out}}$
   - Resistance: `oppda` (Higher OPPDA = opponents find it difficult to press them)
   - Blend: $0.70 \cdot (100 - S(\text{counter\_conceded})) + 0.30 \cdot S(\text{oppda})$

4. **`def_perimeter_suppression`**
   - Conceded: `shots_outside_box_conceded_p90` $\times F_{\text{out}}$
   - Discipline: `(fouls_conceded + 2 * yellow_cards)_p90`
   - Blend: $0.50 \cdot (100 - S(\text{conceded})) + 0.50 \cdot (100 - S(\text{discipline}))$

---

## 3. Floor, Ceiling, and Chaos Formulas
- **`floor` (0–100):** Anchored in defensive stability and possession security.
  $$\text{floor} = 0.50 \cdot \text{def\_central\_space\_denial} + 0.30 \cdot \text{def\_box\_aerial\_suppression} + 0.20 \cdot (P \times 100)$$
- **`ceiling` (0–100):** Anchored in raw offensive creation.
  $$\text{ceiling} = 0.40 \cdot \text{atk\_central\_penetration} + 0.30 \cdot \text{atk\_box\_aerial} + 0.30 \cdot \text{atk\_transition\_speed}$$
- Ensure $\text{ceiling} \ge \text{floor}$. If $\text{ceiling} < \text{floor}$, set $\text{ceiling} = \text{floor} + 5.0$.
- **`chaos_index` (0–100):** Derived from `atk_perimeter_chaos`, discipline volatility, and counter exposure:
  $$\text{chaos\_index} = 0.40 \cdot \text{atk\_perimeter\_chaos} + 0.30 \cdot (100 - \text{def\_perimeter\_suppression}) + 0.30 \cdot |\text{ceiling} - \text{floor}|$$

---

## 4. Execution & Verification
1. Read all rows from `public.team_raw_stats`.
2. Compute the min-max scaling $S(x) \in [0, 100]$ across the league for each feature.
3. Compute the 8 vectors, floor, ceiling, and chaos_index.
4. Upsert cleanly into `public.team_tactical_profiles_v2` using `on_conflict="id"`.
5. Print a preview table showing: Team, Floor, Ceiling, Chaos, Atk Central, Def Central.