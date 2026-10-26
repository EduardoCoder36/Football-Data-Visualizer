# Task Spec: Step 4 - Multi-Pillar Match Prediction Engine V2

## Objective
Build `scripts/sync_upcoming_predictions_v2.py` to calculate match predictions for upcoming Premier League fixtures using `team_tactical_profiles_v2` and write them to `match_predictions_v2`.

Do NOT modify or overwrite `match_predictions` (legacy V1 table remains untouched).

---

## 1. Match Ingestion
- Retrieve current season fixtures from `football-data.org` using `FOOTBALL_DATA_API_KEY`.
- For `FINISHED` matches: update `status = 'FINISHED'`, `home_score`, and `away_score`.
- For `SCHEDULED` / `TIMED` upcoming fixtures: compute calibrated probabilities.

---

## 2. Matchup Delta Engine

For each fixture between **Home ($H$)** and **Away ($A$)**:

### A. 4-Pillar Matchup Deltas
Calculate head-to-head tactical mismatches:
1. $\Delta_{\text{aerial}} = \text{atk\_box\_aerial}_H - \text{def\_box\_aerial\_suppression}_A$
2. $\Delta_{\text{central}} = \text{atk\_central\_penetration}_H - \text{def\_central\_space\_denial}_A$
3. $\Delta_{\text{transition}} = \text{atk\_transition\_speed}_H - \text{def\_rest\_defense}_A$
4. $\Delta_{\text{perimeter}} = \text{atk\_perimeter\_chaos}_H - \text{def\_perimeter\_suppression}_A$

Calculate the reverse deltas ($\Delta_{\text{away}, k}$) for Away attacking vs Home defending.

Net Tactical Advantage for Home:
$$\Delta_{\text{tactical}} = 0.30 \cdot (\Delta_{\text{central}} - \Delta_{\text{away, central}}) + 0.25 \cdot (\Delta_{\text{transition}} - \Delta_{\text{away, transition}}) + 0.25 \cdot (\Delta_{\text{aerial}} - \Delta_{\text{away, aerial}}) + 0.20 \cdot (\Delta_{\text{perimeter}} - \Delta_{\text{away, perimeter}})$$

### B. Baseline Quality Advantage
$$\Delta_{\text{quality}} = (\text{floor}_H + \text{ceiling}_H) - (\text{floor}_A + \text{ceiling}_A)$$

### C. Home Advantage & Combined Rating
Add a home pitch advantage constant ($+8.0$ rating points):
$$\text{Rating Edge}_H = \Delta_{\text{quality}} + 0.50 \cdot \Delta_{\text{tactical}} + 8.0$$

---

## 3. Probability Calculation (Tapered Softmax & Chaos Flattening)

1. **Combined Chaos Index:**
   $$\text{Chaos} = \frac{\text{chaos\_index}_H + \text{chaos\_index}_A}{2}$$
   Temperature parameter: $T = 35.0 + 0.25 \cdot \text{Chaos}$. (Higher chaos raises temperature, pulling lines closer to an even split).

2. **Logits:**
   - $\text{logit}_H = \frac{\text{Rating Edge}_H}{T}$
   - $\text{logit}_A = -\frac{\text{Rating Edge}_H}{T}$
   - $\text{logit}_{\text{draw}} = \frac{15.0 - 0.15 \cdot |\text{Rating Edge}_H|}{T}$ (Draw probability naturally peaks in close matchups).

3. **Softmax:**
   $$P(i) = \frac{e^{\text{logit}_i}}{\sum_j e^{\text{logit}_j}}$$
   Store as `prob_home`, `prob_draw`, and `prob_away` rounded to 4 decimal places.

---

## 4. Upsert
- Upsert into `public.match_predictions_v2` with `on_conflict="id"`.
- Output a preview table for the upcoming matchday comparing Home Win %, Draw %, Away Win %, and Net Tactical Delta.