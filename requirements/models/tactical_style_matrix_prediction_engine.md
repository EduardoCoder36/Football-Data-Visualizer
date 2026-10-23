# Tactical Modeling Specification: Style Archetypes & Clash Dynamics

## 1. Style Dimensions & Metrics

Each team receives an index score from `0.00` to `100.00` for each of the core dimensions:

| Dimension | Primary Tactical Question | Key Data Indicators |
| :--- | :--- | :--- |
| **Control** | Do they dominate territory and pass tempo? | Possession %, Field Tilt (% of final 3rd passes), Average pass sequence duration. |
| **Directness** | Do they move straight toward goal or circulate? | Direct speed (metres advanced per second in possession), Long pass ratio, Cross volume. |
| **Pressing** | How aggressively do they disrupt build-up? | PPDA (Passes per Defensive Action), High turnovers (within 40m of opponent's goal). |
| **Transition Threat** | How dangerous are they immediately after turnover? | Counter-attacking shots/goals, Shots generated within 10s of defensive recovery. |
| **Line Height** | Where is their primary defensive block deployed? | Average defensive action distance from own goal line (metres). |

---

## 2. Tactical Archetypes

Teams are grouped into a primary stylistic archetype based on cluster analysis of their dimension scores:

```
                  ┌───────────────────────────────┐
                  │      Positional Control       │
                  │ (High Control, High Line)     │
                  └──────────────┬────────────────┘
                                 │
                     beats       │       beaten by
               (field tilt)      │   (counter-attacks)
                                 ▼
┌───────────────────────────────┐ ◄────────────── ┌───────────────────────────────┐
│         Compact Block         │                 │       Direct Transition       │
│ (Low Line, Directness)        │                 │ (High Press, High Transition) │
└───────────────────────────────┘ ──────────────► └───────────────────────────────┘
                                   beats (denies space)
```

1. **Positional Control:** High possession, high territorial tilt, low directness, high defensive line.
2. **Direct Transition:** Aggressive press, high direct speed, explosive output immediately after winning the ball.
3. **Compact Block:** Low defensive line, concedes possession, relies on set-pieces and long-ball exits.
4. **Chaotic Presser:** High PPDA, high directness, high fouls, low sustained control.

---

## 3. Floor, Ceiling & Clash Formula

### Floor & Ceiling Definitions
* **Base Floor ($F$):** A team's baseline expected output driven by squad market value, defensive discipline, and set-piece stability. Even on their worst tactical day, they will not drop below this rating.
* **Base Ceiling ($C$):** The maximum potential threat when all tactical avenues are unobstructed.
* **Span ($\Delta$):** $\Delta = C - F$. Reflects stylistic volatility (rigid possession teams often have narrow spans; chaotic counter-attackers have wide spans).

### Clash Simulation
When Team $A$ plays Team $B$:
1. Look up the stylistic clash coefficient $\mu \in [0.0, 1.0]$ from the Rock-Paper-Scissors matrix.
   * $\mu > 0.5 \implies$ Style advantage (pushes team closer to their **Ceiling**).
   * $\mu < 0.5 \implies$ Style disadvantage (pulls team closer to their **Floor**).
2. Calculate the projected performance rating $R$:
   $$R_A = F_A + \mu_{AB} \times (C_A - F_A)$$
   $$R_B = F_B + \mu_{BA} \times (C_B - F_B)$$
3. The match projection is the comparative spread between $R_A$ and $R_B$, adjusted for home advantage.

---

## 4. Next Implementation Steps

1. **Ingestion Script:** Build a lightweight Python notebook using free data (`statsbombpy` or scraped match stats) to verify the formulas against 5 sample clubs.
2. **Database Migration:** Run the migration script in Supabase to create the new tables.
3. **Backtesting:** Run the model against the previous season's fixtures to calibrate the clash weights.