# Task Spec: Step 3 - Recency / Form Weighting on Raw Stats & Recompute Profiles

## Objective
Update `scripts/fetch_raw_stats_v2.py` so that match-level and shot-level statistical aggregation applies an exponential recency decay ($\lambda = 0.90$) across chronologically ordered matches. Then recompute `scripts/compute_tactical_profiles_v2.py` so the V2 tactical profiles reflect weighted form.

---

## 1. Weighting Logic in `scripts/fetch_raw_stats_v2.py`

1. **Sort Matches Chronologically:**  
   For each team, order their completed matches by date/kickoff time: $m_1, m_2, \dots, m_N$ where $m_N$ is the most recent match.
2. **Exponential Weight Decay:**  
   Let decay constant $\lambda = 0.90$.
   For match index $i \in [1, N]$:
   $$w_i = \lambda^{(N - i)}$$
   - Most recent match ($i = N$): $w_N = 1.0$
   - Previous match ($i = N-1$): $w_{N-1} = 0.90$
   - Match 7 games ago: $w_1 = (0.90)^7 \approx 0.478$
3. **Weighted Aggregation:**  
   - Weight shot counts, xG values, deep passes, and defensive concessions by their respective match's weight $w_i$.
   - Effective match count for rate calculations: $W_{\text{total}} = \sum_{i=1}^N w_i$.
   - Scale total weighted counts to standard 8-match equivalents (or per-match rates) before storing in `team_raw_stats`.
4. **Upsert:**  
   Upsert the updated weighted metrics into `public.team_raw_stats`.

---

## 2. Profile Recomputation
- After `fetch_raw_stats_v2.py` finishes, execute `scripts/compute_tactical_profiles_v2.py`.
- Ensure it reads the fresh form-weighted stats and re-populates `public.team_tactical_profiles_v2`.

---

## 3. Verification
1. Run both scripts sequentially.
2. Print a comparison preview showing how Floor/Ceiling shifted for teams on strong recent streaks vs. teams cooling off.
3. Verify that `team_tactical_profiles` (V1) and `match_predictions` remain completely untouched.