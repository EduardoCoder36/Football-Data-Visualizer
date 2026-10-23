# Tactical Modeling Specification (MVP)

## 1. Overview & Scope
This specification defines the Minimum Viable Product (MVP) for our tactical style classification and match prediction engine. 

For the MVP, we intentionally isolate **In-Possession (On-Ball) Playing Styles** and defer out-of-possession systems (pressing intensity and defensive line height) to subsequent iterations.

---

## 2. In-Possession Style Dimensions (0 – 100 Scale)

Each team receives an index score from `0.0` to `100.0` across three mutually exclusive offensive style dimensions. Each dimension uses an agreed **2:1 (66% / 33%) component weighting**.

### 1. Control Score
* **Concept:** Domination of match tempo and pitch geography through sustained possession.
* **Component 1 (66% / 2/3):** Possession Percentage.
* **Component 2 (33% / 1/3):** Field Tilt (Team passes in opponent's final third $\div$ Combined match final third passes).
* **Formula:**
  $$\text{Control Score} = (0.66 \times \text{Possession Index}) + (0.33 \times \text{Field Tilt Index})$$

### 2. Transition Score
* **Concept:** Speed, vertical territory exploitation, and counter-shot production directly following a turnover against unsettled defenses.
* **Component 1 (66% / 2/3):** Progressive Ground Distance Ratio ($\text{PrgDist} \div \text{TotDist}$ across carries and passes).
* **Component 2 (33% / 1/3):** Counter-Shot Threat (Shot-Creating Actions generated directly from take-ons and defensive actions won).
* **Formula:**
  $$\text{Transition Score} = (0.66 \times \text{Progressive Ground Index}) + (0.33 \times \text{Counter-Shot Index})$$

### 3. Directness Score
* **Concept:** Bypassing midfield play and build-up phases entirely through long balls, aerial delivery, and early launches into the front line.
* **Component 1 (66% / 2/3):** Long Pass Volume Ratio (Percentage of total attempted passes exceeding 30 yards).
* **Component 2 (33% / 1/3):** Launch Tendency (Percentage of defensive-third passes and goal kicks launched 40+ yards downfield).
* **Formula:**
  $$\text{Directness Score} = (0.66 \times \text{Long Pass Index}) + (0.33 \times \text{Launch Tendency Index})$$

---

## 3. Team Archetype Classification

A team's **Primary Archetype** is assigned based on their highest relative percentile score among the three dimensions:

$$\text{Primary Archetype} = \arg\max(\text{Control Score}, \text{Transition Score}, \text{Directness Score})$$

* **Positional Control:** High possession, suffocating territory, low launch frequency.
* **Transition Threat:** Rapid vertical progression upon turnover, lethal counter-attacking efficiency.
* **Direct Bypass:** Route-one delivery, high aerial launch rate, skips settled build-up.

---

## 4. Floor & Ceiling Framework

### 4.1 Concept
Rather than using a single static power rating, each team has a **Floor** and a **Ceiling** on a `0 – 100` scale:
* **Floor ($F$):** Baseline expected performance level on a difficult or suboptimal day (anchored by squad pedigree and defensive baseline).
* **Ceiling ($C$):** Maximum potential output when the tactical game state fully favors their strengths.
* **Spread ($\Delta = C - F$):** Volatility rating. Narrower spreads indicate high consistency; wider spreads indicate tactical volatility.

### 4.2 MVP Calibration Method
* **MVP:** Hardcoded gut-feel baseline scores based on expert prior evaluation across the 20 league clubs.
* **Future Iteration:** Aggregated squad composite scores derived from individual player spider-radar metrics.

---

## 5. Rock-Paper-Scissors Clash Dynamic

### 5.1 The Tactical Interaction Wheel

```
                 Transition (Counter-Attack)
                       ▲           │
                      /             \
           beats     /               \  beats
        (aerial bypass)               \ (exploits vacated space)
                    /                 ▼
              Directness  ◄───────  Control
             (Route One)    beats  (Possession)
                        (starves restarts)
```

1. **Transition beats Control:** Sustained possession forces teams high up the pitch; turnovers leave large spaces behind that transition teams exploit.
2. **Control beats Direct:** Dominating possession and territory starves the direct team of territory and clean restart opportunities.
3. **Direct beats Transition:** Direct sides refuse to pass short in their own half and kick long immediately, completely denying the transition side the turnover-and-counter situations they rely on.

---

## 6. Match Prediction & Probability Logic

### 6.1 Baseline Midpoint
A team's unadjusted neutral midpoint rating $M$ is:

$$M = \frac{F + C}{2}$$

### 6.2 Matchup Modifiers ($\pm 10$)
When Team $A$ plays Team $B$:

| Matchup Dynamic | Team $A$ Modifier | Team $B$ Modifier |
| :--- | :---: | :---: |
| **Team $A$ style beats Team $B$ style** | $+10$ to Floor & Ceiling | $-10$ to Floor & Ceiling |
| **Team $B$ style beats Team $A$ style** | $-10$ to Floor & Ceiling | $+10$ to Floor & Ceiling |
| **Same Style (Mirror Match)** | $0$ (Unchanged) | $0$ (Unchanged) |

Adjusted boundaries:

$$F_{\text{adj}} = F + \text{Modifier}, \quad C_{\text{adj}} = C + \text{Modifier}$$

$$M_{\text{adj}} = \frac{F_{\text{adj}} + C_{\text{adj}}}{2}$$

### 6.3 Match Spread & Win Likelihood
The projected match advantage is determined by the spread between adjusted midpoints:

$$\Delta_{\text{match}} = M_{\text{adj, Home}} - M_{\text{adj, Away}}$$

* $\Delta_{\text{match}} = 0 \implies$ Even contest (Neutral baseline distribution: ~38% Home Win, 28% Draw, 34% Away Win).
* Each $\pm 1$ point of net rating advantage shifts the win likelihood by roughly $\pm 1.5\%$.

---

## 7. Roadmap & Future Iterations

* **Iteration 1 (Off-Ball Integration):** Add Pressing Intensity (PPDA) and Defensive Line Height.
* **Iteration 2 (Player Radars):** Derive squad Floor & Ceiling bottom-up from individual player radar scores rather than gut baselines.
* **Iteration 3 (Backtesting Engine):** Calibrate clash modifier weights ($\pm 10$) against historical match results stored in Supabase.