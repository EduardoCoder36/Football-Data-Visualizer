# Task Spec: Step 2.1 - Calibration Fix for Tactical Profiles & Ratings

## Context & Diagnosis
The initial execution of `scripts/compute_tactical_profiles_v2.py` produced distorted ratings:
1. Multiplying defensive conceded stats by raw $F_{\text{out}} = \frac{0.50}{1.0 - P}$ penalized dominant possession teams (like Arsenal and Man City) by doubling their conceded metrics, while heavily flattering deep-block teams (Coventry, Leeds).
2. Floor and Ceiling were overly sensitive to individual inverted pillars rather than overall net performance (npxG vs npxGA), resulting in bottom-table sides receiving the highest floors in the league.

---

## 1. Adjusting Feature Normalization in `scripts/compute_tactical_profiles_v2.py`

### A. Tame the Possession Factor
- Clamp both $F_{\text{in}}$ and $F_{\text{out}}$ strictly to the range `[0.75, 1.30]`. 
  This applies a subtle tactical tendency adjustment without distorting raw quality.
- For defensive metrics: Evaluate concessions primarily on a **per-match basis** (`/ matches_played`). Do NOT inflate conceded stats for high-possession teams.

### B. Anchor Floor & Ceiling in Net Performance (npxG Delta)
Calculate each team's net open-play quality:
$$\text{net\_npxg\_p90} = \frac{\text{npxg} - \text{npxga}}{\text{matches\_played}}$$
Min-max scale `net_npxg_p90` across the league into `net_quality_score` (0 to 100).

- **`floor` (0–100):** Anchored primarily in baseline quality and defensive solidity:
  $$\text{floor} = 0.50 \cdot \text{net\_quality\_score} + 0.30 \cdot (100 - S(\text{npxga\_p90})) + 0.20 \cdot (P \times 100)$$
- **`ceiling` (0–100):** Anchored in attacking firepower and top-end creation:
  $$\text{ceiling} = 0.50 \cdot \text{net\_quality\_score} + 0.35 \cdot S(\text{npxg\_p90}) + 0.15 \cdot \text{atk\_central\_penetration}$$
- Guarantee $\text{ceiling} \ge \text{floor} + 5.0$.

### C. Recalibrate Tactical Pillars (0–100)
Ensure pillars describe tactical style distribution:
- **`atk_central_penetration`**: Blend of $S(\text{deep\_p90})$ and $S(\text{xg\_open\_play\_p90})$.
- **`def_central_space_denial`**: Blend of $100 - S(\text{deep\_allowed\_p90})$ and $100 - S(\text{npxga\_p90})$.

---

## 2. Verification Criteria
Rerun `scripts/compute_tactical_profiles_v2.py` and print the summary table:
- Elite net-xG teams (Man City, Arsenal, Liverpool) should have the highest floors/ceilings (e.g. 70–90 range).
- Lower-table teams with negative xG differentials should sit in the lower ranges (e.g. 20–45 range).
- Tactical pillars (0–100) should realistically show distinct strengths (e.g., Brentford high on box/set-piece threat, Arsenal high on central penetration).