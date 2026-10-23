# Tactical Modeling Engine: Future Iterations & Backlog

This document captures all architectural enhancements, advanced concepts, and data refinements parked during the MVP build. When the core MVP pipeline is running and validated, pick items from this roadmap to iterate.

---

## 1. Style Profile Refinements & Hybrid Archetypes

### 1.1 Beyond Winner-Takes-All
* **The MVP Limitation:** Currently, a team is purely tagged by its single highest score ($\arg\max$). A team scoring 60 Control, 59 Transition, and 20 Direct is treated identically to a pure possession side scoring 90 Control, 30 Transition, and 15 Direct.
* **The Solution (Hybrid Profiles):**
  * **Dominance Margin Threshold:** Require the primary style to exceed the runner-up style by a minimum delta (e.g., $\ge 8.0$ points) to earn a pure label; otherwise classify as **"Hybrid / Pragmatic"**.
  * **Continuous Clash Weights:** Instead of a flat $\pm 10$ modifier, scale the clash penalty or boost relative to the stylistic contrast:
    
    $$\text{Modifier} = 10 \times \left( \frac{\text{Dominant Score} - \text{Opponent Counter Score}}{100} \right)$$
    
    *Example:* A runaway 95 Control team playing an elite 85 Transition team suffers a much bigger counter-threat penalty than a balanced 55 Control team.

---

## 2. Squad Bottom-Up Modeling: Player Radars & Spider Diagrams

### 2.1 From Gut Baselines to Squad Rollups
* **The MVP Limitation:** Team Floor and Ceiling are currently set by gut prior ratings (0–100).
* **The Solution (Player Composite Floor & Ceiling):**
  1. Build multi-dimensional player radar profiles (spider charts) per position:
     * **Defenders:** Aerial duel %, ground duel %, recovery speed, tackle success under pressure.
     * **Midfielders:** Ball progression, pressure resistance, duel win rate, retention under pressure.
     * **Attackers:** xG output, shot generation, 1v1 take-on success, defensive press involvement.
  2. Each player receives an individual **Floor** (bad day / minimal impact) and **Ceiling** (peak form).
  3. **Squad Aggregation Formula:**
     * Weight starting XI ratings (e.g., 75% weight) + key substitutes / bench depth (25% weight).
     * Calculate squad Floor & Ceiling dynamically based on available lineup or expected starters:
       
       $$\text{Squad Floor} = \sum w_i \times \text{Player Floor}_i$$
       $$\text{Squad Ceiling} = \sum w_i \times \text{Player Ceiling}_i$$

* **Benefit:** When a star player (e.g. Rodri or Saliba) is injured, the team’s baseline Floor automatically drops in Supabase without manual intervention.

---

## 3. Off-Ball Tactical Dimensions (Out-of-Possession Phase)

In the MVP, we isolated in-possession attacking styles. Iteration 1 will introduce the defensive side of the ball:

### 3.1 Pressing Intensity
* **Metric:** Passes Allowed Per Defensive Action (PPDA) in the opponent's defensive and middle third.
* **Impact:** Inverted scale—lower PPDA means higher pressing aggression.
* **Interaction:** High Press disrupts deliberate Control build-up; low passive block invites territorial pressure.

### 3.2 Defensive Line Height & Compactness
* **Metric:** Average distance of defensive actions (tackles, interceptions, fouls, clearances) from own goal line (metres).
* **Impact:** High defensive lines choke space in the middle third but leave vulnerability behind for rapid transitional runners; low blocks eliminate space in behind but surrender final-third territory.

### 3.3 Rest Defense & Counter-Press Efficiency
* **Metric:** Turnover recovery speed (time to regain possession or force a clearance within 6 seconds of losing the ball).
* **Impact:** Distinguishes high-possession teams with elite counter-pressing traps from teams that are easily cut open on the counter.

---

## 4. Backtesting & Calibration Engine

### 4.1 Automated Historical Testing
* Query historical fixtures stored in Supabase (e.g., 2023–24 season).
* Run the prediction engine retrospectively against past games.
* Compare projected spreads ($\Delta_{\text{match}}$) against actual outcomes (Goal difference, xG difference, Points).
* Optimize the clash modifier weight (currently hardcoded to $\pm 10$) using mean squared error (MSE) or log-loss minimization to determine whether the optimal tactical penalty is $\pm 8$, $\pm 10$, or $\pm 12.5$.