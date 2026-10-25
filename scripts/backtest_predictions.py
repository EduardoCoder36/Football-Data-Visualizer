import soccerdata as sd
import pandas as pd
import numpy as np
import re

# 1. Load rolling 18-month tactical profiles and 2025-2026 anchor profiles
profiles_df = pd.read_csv("scripts/tactical_profiles_rolling_18m.csv")
profiles = profiles_df.set_index("team").to_dict(orient="index")

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

try:
    if not supabase_url or not supabase_key:
        raise ValueError("Missing Supabase credentials")

    client: Client = create_client(supabase_url, supabase_key)
    res = client.table("team_tactical_profiles").select("*").execute()
    if not res.data:
        raise ValueError("No data returned from team_tactical_profiles")

    anchor_df = pd.DataFrame(res.data).set_index("team")
    anchor_ratings = ((anchor_df["floor"] + anchor_df["ceiling"]) / 2.0).to_dict()
except Exception as e:
    print(f"Warning: Failed to fetch from Supabase ({e}). Falling back to local CSV backup.")
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

def apply_excess_tapering(p_home: float, p_draw: float, p_away: float, threshold: float = 0.75):
    probs = [p_home, p_draw, p_away]
    
    # 0 = Home, 1 = Draw, 2 = Away
    if probs[0] > threshold:
        fav_idx, dog_idx = 0, 2
    elif probs[2] > threshold:
        fav_idx, dog_idx = 2, 0
    else:
        return probs[0], probs[1], probs[2]
        
    draw_idx = 1
    excess = probs[fav_idx] - threshold
    
    # 40% retained by favorite, 50% to draw, 10% to underdog
    probs[fav_idx] = threshold + (excess * 0.40)
    probs[draw_idx] += (excess * 0.50)
    probs[dog_idx] += (excess * 0.10)
    
    total = sum(probs)
    return probs[0] / total, probs[1] / total, probs[2] / total

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
    
    prob_h, prob_d, prob_a = float(probs[0]), float(probs[1]), float(probs[2])
    prob_h, prob_d, prob_a = apply_excess_tapering(prob_h, prob_d, prob_a, threshold=0.75)
    
    return round(float(prob_h * 100), 1), round(float(prob_d * 100), 1), round(float(prob_a * 100), 1)

def simulate(home, away, gameweek: int = 1):
    if home not in profiles or away not in profiles:
        return None
    
    h_p, a_p = profiles[home], profiles[away]
    h_uncon = (h_p['floor'] + h_p['ceiling']) / 2.0
    a_uncon = (a_p['floor'] + a_p['ceiling']) / 2.0
    
    # Velocity Limiter (Option B)
    active_gw_completed = max(0, gameweek - 1)
    max_allowed_delta = 1.25 * active_gw_completed
    
    PROMOTED_DEFAULT_ANCHOR = 56.0
    
    if home in anchor_ratings:
        h_anchor = anchor_ratings[home]
    else:
        h_anchor = PROMOTED_DEFAULT_ANCHOR
        h_uncon = PROMOTED_DEFAULT_ANCHOR + (h_uncon - PROMOTED_DEFAULT_ANCHOR) * 0.45
        
    h_rating = max(h_anchor - max_allowed_delta, min(h_anchor + max_allowed_delta, h_uncon))
        
    if away in anchor_ratings:
        a_anchor = anchor_ratings[away]
    else:
        a_anchor = PROMOTED_DEFAULT_ANCHOR
        a_uncon = PROMOTED_DEFAULT_ANCHOR + (a_uncon - PROMOTED_DEFAULT_ANCHOR) * 0.45
        
    a_rating = max(a_anchor - max_allowed_delta, min(a_anchor + max_allowed_delta, a_uncon))
    
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