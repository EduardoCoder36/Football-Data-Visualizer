import soccerdata as sd
import pandas as pd
import numpy as np
import re

# 1. Load rolling 18-month tactical profiles and 2025-2026 anchor profiles
profiles_df = pd.read_csv("scripts/tactical_profiles_rolling_18m.csv")
profiles = profiles_df.set_index("team").to_dict(orient="index")

anchor_df = pd.read_csv("scripts/tactical_profiles_2025_2026.csv").set_index("team")
anchor_ratings = ((anchor_df["floor"] + anchor_df["ceiling"]) / 2.0).to_dict()

# 2. Fetch current 2026-2027 completed matches
print("Fetching 2026-2027 match results...")
fbref = sd.FBref(leagues="ENG-Premier League", seasons="2026-2027")
schedule = fbref.read_schedule().reset_index()

# Filter for rows where score is present
played = schedule.dropna(subset=['score']).copy()

# Tactical Clash Rules
CLASH_ADVANTAGE = {
    ("Control", "Direct"): 4.5,
    ("Direct", "Transition"): 4.5,
    ("Transition", "Control"): 4.5,
    ("Direct", "Control"): -4.5,
    ("Transition", "Direct"): -4.5,
    ("Control", "Transition"): -4.5,
}

def calculate_probabilities(delta: float):
    k = 0.075    # Draw decay
    c = 0.20    # Base draw intercept
    beta = 0.065 # Sensitivity to delta
    
    logit_h = beta * delta
    logit_a = -beta * delta
    logit_d = c - k * abs(delta)
    
    logits = np.array([logit_h, logit_d, logit_a])
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)
    
    return round(probs[0] * 100, 1), round(probs[1] * 100, 1), round(probs[2] * 100, 1)

def simulate(home, away, gameweek: int = 1):
    if home not in profiles or away not in profiles:
        return None
    
    h_p, a_p = profiles[home], profiles[away]
    h_uncon = (h_p['floor'] + h_p['ceiling']) / 2.0
    a_uncon = (a_p['floor'] + a_p['ceiling']) / 2.0
    
    # Velocity Limiter (Option B)
    active_gw_completed = max(0, gameweek - 1)
    max_allowed_delta = 1.25 * active_gw_completed
    
    if home in anchor_ratings:
        h_anchor = anchor_ratings[home]
        h_rating = max(h_anchor - max_allowed_delta, min(h_anchor + max_allowed_delta, h_uncon))
    else:
        h_rating = h_uncon
        
    if away in anchor_ratings:
        a_anchor = anchor_ratings[away]
        a_rating = max(a_anchor - max_allowed_delta, min(a_anchor + max_allowed_delta, a_uncon))
    else:
        a_rating = a_uncon
    
    clash = CLASH_ADVANTAGE.get((h_p['archetype'], a_p['archetype']), 0.0)
    
    h_eff = h_rating * 1.05 + (clash / 2.0)
    a_eff = a_rating - (clash / 2.0)
    delta = h_eff - a_eff
    
    p_h, p_d, p_a = calculate_probabilities(delta)
    
    max_p = max(p_h, p_d, p_a)
    pred_label = "H" if max_p == p_h else ("A" if max_p == p_a else "D")
    
    return p_h, p_d, p_a, pred_label

results = []
skipped = []

for _, row in played.iterrows():
    h_team, a_team = row['home_team'], row['away_team']
    
    # Check score format using regex to catch any separator (hyphen, en-dash, em-dash, colon)
    raw_score = str(row['score'])
    score_match = re.search(r'(\d+)\s*[-–—:]\s*(\d+)', raw_score)
    if not score_match:
        skipped.append((f"{h_team} vs {a_team}", f"Unparseable score: '{raw_score}'"))
        continue
    
    h_s, a_s = int(score_match.group(1)), int(score_match.group(2))
    
    gw = 1
    if 'round' in row and pd.notna(row['round']):
        m = re.search(r'(\d+)', str(row['round']))
        if m:
            gw = int(m.group(1))
    elif 'week' in row and pd.notna(row['week']):
        m = re.search(r'(\d+)', str(row['week']))
        if m:
            gw = int(m.group(1))
            
    sim = simulate(h_team, a_team, gameweek=gw)
    if not sim:
        skipped.append((f"{h_team} vs {a_team}", "Team not in profiles"))
        continue
    
    p_h, p_d, p_a, pred_label = sim
    actual = "H" if h_s > a_s else ("A" if a_s > h_s else "D")
    
    is_hit = pred_label == actual
    is_dc = actual == pred_label or (actual == "D" and pred_label in ["H", "A"])
    
    results.append({
        'Date': str(row['date'])[:10] if 'date' in row else '',
        'Match': f"{h_team} vs {a_team}",
        'Score': f"{h_s}-{a_s}",
        'H%': f"{p_h}%",
        'D%': f"{p_d}%",
        'A%': f"{p_a}%",
        'Favored': pred_label,
        'Actual': actual,
        'Eval': "✓" if is_hit else ("½" if is_dc else "✗")
    })

df_res = pd.DataFrame(results)

print(f"\n=== Evaluated {len(df_res)} of {len(played)} Completed Matches ===")
if skipped:
    print(f"Skipped {len(skipped)} rows. First few reasons:")
    for match, reason in skipped[:5]:
        print(f"  - {match}: {reason}")

print("\nRecent 10 Matches with Probabilities:")
print(df_res.tail(10).to_string(index=False))

total = len(df_res)
if total > 0:
    hits = (df_res['Eval'] == '✓').sum()
    dc_hits = (df_res['Eval'].isin(['✓', '½'])).sum()
    print(f"\n--- Performance Summary ---")
    print(f"Direct Top-Pick Accuracy:  {hits}/{total} ({hits/total*100:.1f}%)")
    print(f"Double Chance (Favored/Draw): {dc_hits}/{total} ({dc_hits/total*100:.1f}%)")