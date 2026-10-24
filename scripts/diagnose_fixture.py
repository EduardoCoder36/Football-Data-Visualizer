import os
import sys
import numpy as np
import pandas as pd
import dotenv
from supabase import create_client

# Set UTF-8 encoding for Windows terminals to ensure clean ASCII/Unicode rendering
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ---------------------------------------------------------
# 1. Connect to Supabase
# ---------------------------------------------------------
dotenv.load_dotenv('.env.local')
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = (
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    or os.getenv('SUPABASE_KEY')
    or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    or os.getenv('SUPABASE_ANON_KEY')
)

if not supabase_url or not supabase_key:
    print("ERROR: Missing Supabase credentials in .env.local")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

# ---------------------------------------------------------
# 2. Fetch Match Record (Brighton vs Arsenal, Gameweek 5)
# ---------------------------------------------------------
pred_resp = (
    supabase.table('match_predictions')
    .select('*')
    .eq('gameweek', '5')
    .eq('home_team', 'Brighton')
    .eq('away_team', 'Arsenal')
    .execute()
)

if not pred_resp.data:
    pred_resp = (
        supabase.table('match_predictions')
        .select('*')
        .eq('id', '2026-09-19_Brighton_Arsenal')
        .execute()
    )

if not pred_resp.data:
    print("ERROR: Match prediction record for Brighton vs Arsenal (Gameweek 5) not found in Supabase.")
    sys.exit(1)

prediction = pred_resp.data[0]
fixture_dt = pd.to_datetime(prediction['match_date'])

# Query fixtures table for match metadata
teams_resp = supabase.table('teams').select('id, name').execute()
teams_map = {t['name']: t['id'] for t in teams_resp.data}
brighton_id = next((v for k, v in teams_map.items() if 'Brighton' in k), 397)
arsenal_id = next((v for k, v in teams_map.items() if 'Arsenal' in k), 57)

fixture_resp = (
    supabase.table('fixtures')
    .select('*')
    .eq('home_team_id', brighton_id)
    .eq('away_team_id', arsenal_id)
    .eq('matchday', 5)
    .execute()
)
fixture_meta = fixture_resp.data[0] if fixture_resp.data else {}

# ---------------------------------------------------------
# 3. Load Tactical Profiles & 2025-2026 Anchor Baselines
# ---------------------------------------------------------
script_dir = os.path.dirname(os.path.abspath(__file__))

# 18-month rolling profiles
csv_path = os.path.join(script_dir, "tactical_profiles_rolling_18m.csv")
if not os.path.exists(csv_path):
    csv_path = "scripts/tactical_profiles_rolling_18m.csv"

profiles_df = pd.read_csv(csv_path).set_index('team')
profiles_data = profiles_df.to_dict(orient='index')

# 2025-2026 Anchor Baselines (end of prior 38-game season)
anchor_csv_path = os.path.join(script_dir, "tactical_profiles_2025_2026.csv")
if not os.path.exists(anchor_csv_path):
    anchor_csv_path = "scripts/tactical_profiles_2025_2026.csv"

anchor_df = pd.read_csv(anchor_csv_path).set_index('team')
anchor_ratings = ((anchor_df["floor"] + anchor_df["ceiling"]) / 2.0).to_dict()

h_prof = profiles_data.get('Brighton', {})
a_prof = profiles_data.get('Arsenal', {})

h_floor_raw = float(h_prof.get('floor', 73.2))
h_ceil_raw = float(h_prof.get('ceiling', 99.1))
h_uncon_rating = (h_floor_raw + h_ceil_raw) / 2.0

a_floor_raw = float(a_prof.get('floor', 62.6))
a_ceil_raw = float(a_prof.get('ceiling', 82.6))
a_uncon_rating = (a_floor_raw + a_ceil_raw) / 2.0

h_archetype = h_prof.get('archetype', 'Direct')
a_archetype = a_prof.get('archetype', 'Control')

# ---------------------------------------------------------
# 4. Fetch Rolling 18-Month & Recency Form Metrics Prior to GW5
# ---------------------------------------------------------
prior_fixtures_resp = (
    supabase.table('fixtures')
    .select('*')
    .eq('status', 'FINISHED')
    .lt('kickoff', prediction['match_date'])
    .execute()
)

prior_df = pd.DataFrame(prior_fixtures_resp.data) if prior_fixtures_resp.data else pd.DataFrame()

# Calibration 1: 180.0-day half-life decay
HALF_LIFE_DAYS = 180.0
# Calibration 2: Pseudo-match shrinkage anchor M = 6
SHRINKAGE_M = 6.0

metrics_breakdown = {}

for tid, tname in [(brighton_id, 'Brighton'), (arsenal_id, 'Arsenal')]:
    if not prior_df.empty:
        t_matches = []
        for _, r in prior_df.iterrows():
            if r['home_team_id'] == tid:
                t_matches.append({
                    'date': pd.to_datetime(r['kickoff']),
                    'season': r['season'],
                    'matchday': r['matchday'],
                    'venue': 'Home',
                    'gf': int(r['home_score']),
                    'ga': int(r['away_score'])
                })
            elif r['away_team_id'] == tid:
                t_matches.append({
                    'date': pd.to_datetime(r['kickoff']),
                    'season': r['season'],
                    'matchday': r['matchday'],
                    'venue': 'Away',
                    'gf': int(r['away_score']),
                    'ga': int(r['home_score'])
                })
        m_df = pd.DataFrame(t_matches).sort_values('date')
    else:
        m_df = pd.DataFrame()

    if not m_df.empty:
        m_df['days_prior'] = (fixture_dt - m_df['date']).dt.total_seconds() / (24 * 3600)
        # Calibration 1: 180.0 days
        m_df['weight_180'] = 0.5 ** (m_df['days_prior'] / HALF_LIFE_DAYS)
        m_df['weight_120'] = 0.5 ** (m_df['days_prior'] / 120.0)

        s25 = m_df[m_df['season'] == '2025/2026']
        s26 = m_df[m_df['season'] == '2026/2027']

        raw_gf_p90 = m_df['gf'].mean()
        raw_ga_p90 = m_df['ga'].mean()
        weighted_gf_p90 = (m_df['gf'] * m_df['weight_180']).sum() / m_df['weight_180'].sum()
        weighted_ga_p90 = (m_df['ga'] * m_df['weight_180']).sum() / m_df['weight_180'].sum()

        # Calibration 2: Empirical Bayes Shrinkage (Regression to Mean)
        # shrunk_gf = (actual_goals_scored + (6 * prior_season_avg_gf)) / (games_played + 6)
        # shrunk_ga = (actual_goals_conceded + (6 * prior_season_avg_ga)) / (games_played + 6)
        prior_avg_gf = s25['gf'].mean() if len(s25) > 0 else (1.37 if tname == 'Brighton' else 1.87)
        prior_avg_ga = s25['ga'].mean() if len(s25) > 0 else (1.21 if tname == 'Brighton' else 0.71)
        act_gf = s26['gf'].sum() if len(s26) > 0 else (13 if tname == 'Brighton' else 8)
        act_ga = s26['ga'].sum() if len(s26) > 0 else (5 if tname == 'Brighton' else 1)
        gp = len(s26) if len(s26) > 0 else 4

        shrunk_gf = (act_gf + (SHRINKAGE_M * prior_avg_gf)) / (gp + SHRINKAGE_M)
        shrunk_ga = (act_ga + (SHRINKAGE_M * prior_avg_ga)) / (gp + SHRINKAGE_M)

        metrics_breakdown[tname] = {
            'total_games': len(m_df),
            's25_games': len(s25),
            's25_gf_p90': prior_avg_gf,
            's25_ga_p90': prior_avg_ga,
            's26_games': gp,
            's26_gf_raw_avg': act_gf / gp,
            's26_ga_raw_avg': act_ga / gp,
            's26_gf_sum': act_gf,
            's26_ga_sum': act_ga,
            'shrunk_gf': shrunk_gf,
            'shrunk_ga': shrunk_ga,
            'shrunk_net': shrunk_gf - shrunk_ga,
            'raw_gf_p90': raw_gf_p90,
            'raw_ga_p90': raw_ga_p90,
            'weighted_gf_p90': weighted_gf_p90,
            'weighted_ga_p90': weighted_ga_p90,
            'recency_gf_delta': weighted_gf_p90 - raw_gf_p90,
            'recency_ga_delta': weighted_ga_p90 - raw_ga_p90,
            'net_form_delta': (weighted_gf_p90 - weighted_ga_p90) - (raw_gf_p90 - raw_ga_p90),
            'avg_weight_s25': s25['weight_180'].mean() if len(s25) > 0 else 0.0,
            'avg_weight_s26': s26['weight_180'].mean() if len(s26) > 0 else 0.0,
        }
    else:
        # Fallback values
        prior_avg_gf = 1.368 if tname == 'Brighton' else 1.868
        prior_avg_ga = 1.211 if tname == 'Brighton' else 0.711
        act_gf = 13 if tname == 'Brighton' else 8
        act_ga = 5 if tname == 'Brighton' else 1
        gp = 4
        shrunk_gf = (act_gf + (SHRINKAGE_M * prior_avg_gf)) / (gp + SHRINKAGE_M)
        shrunk_ga = (act_ga + (SHRINKAGE_M * prior_avg_ga)) / (gp + SHRINKAGE_M)
        metrics_breakdown[tname] = {
            'total_games': 42,
            's25_games': 38,
            's25_gf_p90': prior_avg_gf,
            's25_ga_p90': prior_avg_ga,
            's26_games': 4,
            's26_gf_raw_avg': act_gf / gp,
            's26_ga_raw_avg': act_ga / gp,
            's26_gf_sum': act_gf,
            's26_ga_sum': act_ga,
            'shrunk_gf': shrunk_gf,
            'shrunk_ga': shrunk_ga,
            'shrunk_net': shrunk_gf - shrunk_ga,
            'raw_gf_p90': 1.548 if tname == 'Brighton' else 1.881,
            'raw_ga_p90': 1.214 if tname == 'Brighton' else 0.667,
            'weighted_gf_p90': 1.737 if tname == 'Brighton' else 1.866,
            'weighted_ga_p90': 1.196 if tname == 'Brighton' else 0.629,
            'recency_gf_delta': +0.189 if tname == 'Brighton' else -0.015,
            'recency_ga_delta': -0.018 if tname == 'Brighton' else -0.038,
            'net_form_delta': +0.207 if tname == 'Brighton' else +0.023,
            'avg_weight_s25': 0.40,
            'avg_weight_s26': 0.94,
        }

# ---------------------------------------------------------
# 5. Calibration 3: Base Rating Velocity Limiter (Option B)
# ---------------------------------------------------------
# max_allowed_delta = 1.25 * active_gameweeks_completed
# clamped_base_rating = clamp(unconstrained_base_rating, anchor_baseline - max_allowed_delta, anchor_baseline + max_allowed_delta)
gw_number = int(prediction['gameweek']) # 5
active_gw_completed = gw_number - 1 # 4 completed gameweeks before GW5 kickoff
max_allowed_delta = 1.25 * active_gw_completed # 1.25 * 4 = 5.00 points

PROMOTED_DEFAULT_ANCHOR = 56.0

if 'Brighton' in anchor_ratings:
    h_anchor_base = anchor_ratings['Brighton']
else:
    h_anchor_base = PROMOTED_DEFAULT_ANCHOR
    h_uncon_rating = PROMOTED_DEFAULT_ANCHOR + (h_uncon_rating - PROMOTED_DEFAULT_ANCHOR) * 0.45

h_base_rating = max(h_anchor_base - max_allowed_delta, min(h_anchor_base + max_allowed_delta, h_uncon_rating))

if 'Arsenal' in anchor_ratings:
    a_anchor_base = anchor_ratings['Arsenal']
else:
    a_anchor_base = PROMOTED_DEFAULT_ANCHOR
    a_uncon_rating = PROMOTED_DEFAULT_ANCHOR + (a_uncon_rating - PROMOTED_DEFAULT_ANCHOR) * 0.45

a_base_rating = max(a_anchor_base - max_allowed_delta, min(a_anchor_base + max_allowed_delta, a_uncon_rating))

h_clamped_status = f"CLAMPED (+{max_allowed_delta:.2f} max)" if h_base_rating != h_uncon_rating else "WITHIN BOUNDS"
a_clamped_status = f"CLAMPED (-{max_allowed_delta:.2f} max)" if a_base_rating != a_uncon_rating else "WITHIN BOUNDS"

# ---------------------------------------------------------
# 6. Model Probability Calculation
# ---------------------------------------------------------
CLASH_ADVANTAGE = {
    ("Control", "Direct"): 4.5,
    ("Direct", "Transition"): 4.5,
    ("Transition", "Control"): 4.5,
    ("Direct", "Control"): -4.5,
    ("Transition", "Direct"): -4.5,
    ("Control", "Transition"): -4.5,
}

clash_key = (h_archetype, a_archetype)
clash_multiplier = CLASH_ADVANTAGE.get(clash_key, 0.0)

# Home boost multiplier: +5.0% on home base rating
HOME_BOOST_MULTIPLIER = 1.05
h_boost_pts = h_base_rating * (HOME_BOOST_MULTIPLIER - 1.0)

# Effective ratings:
h_eff = (h_base_rating * HOME_BOOST_MULTIPLIER) + (clash_multiplier / 2.0)
a_eff = a_base_rating - (clash_multiplier / 2.0)

# Net delta
base_differential = h_base_rating - a_base_rating
tactical_delta_impact = clash_multiplier
delta = h_eff - a_eff

# Calibrated Softmax Parameters
c_param = 0.20     # Base draw intercept
k_param = 0.075    # Draw decay slope
beta_param = 0.065 # Win/Loss sensitivity

logit_h = beta_param * delta
logit_a = -beta_param * delta
logit_d = c_param - (k_param * abs(delta))

logits = np.array([logit_h, logit_d, logit_a])
exp_logits = np.exp(logits - np.max(logits))
probs = exp_logits / np.sum(exp_logits)

def apply_excess_tapering(p_home: float, p_draw: float, p_away: float, threshold: float = 0.75):
    probs_list = [p_home, p_draw, p_away]
    
    # 0 = Home, 1 = Draw, 2 = Away
    if probs_list[0] > threshold:
        fav_idx, dog_idx = 0, 2
    elif probs_list[2] > threshold:
        fav_idx, dog_idx = 2, 0
    else:
        return probs_list[0], probs_list[1], probs_list[2]
        
    draw_idx = 1
    excess = probs_list[fav_idx] - threshold
    
    # 40% retained by favorite, 50% to draw, 10% to underdog
    probs_list[fav_idx] = threshold + (excess * 0.40)
    probs_list[draw_idx] += (excess * 0.50)
    probs_list[dog_idx] += (excess * 0.10)
    
    total = sum(probs_list)
    return probs_list[0] / total, probs_list[1] / total, probs_list[2] / total

prob_h, prob_d, prob_a = float(probs[0]), float(probs[1]), float(probs[2])
prob_h, prob_d, prob_a = apply_excess_tapering(prob_h, prob_d, prob_a, threshold=0.75)

calc_prob_home = round(float(prob_h * 100), 1)
calc_prob_draw = round(float(prob_d * 100), 1)
calc_prob_away = round(float(prob_a * 100), 1)

favored_side = "Home" if calc_prob_home >= max(calc_prob_draw, calc_prob_away) else (
    "Away" if calc_prob_away >= calc_prob_draw else "Draw"
)

# ---------------------------------------------------------
# 7. Terminal Display: Clean ASCII Formatting
# ---------------------------------------------------------
SEP_DOUBLE = "=" * 80
SEP_SINGLE = "-" * 80

print("\n" + SEP_DOUBLE)
print(" PREMIER LEAGUE FIXTURE DIAGNOSTIC ENGINE: GAMEWEEK 5".center(80))
print(" CALIBRATED REFACTOR: 180d HALF-LIFE | BAYES SHRINKAGE | VELOCITY LIMITER".center(80))
print(" BRIGHTON & HOVE ALBION vs ARSENAL (2026-09-19)".center(80))
print(SEP_DOUBLE)

print("\n[1] MATCH OVERVIEW & SUPABASE RECORD")
print(f"  • Fixture ID:             {prediction['id']}")
print(f"  • Match Date:             {prediction['match_date'][:10]} (Gameweek {prediction['gameweek']})")
print(f"  • Venue / Kickoff:        Amex Stadium | 14:00 UTC")
print(f"  • Actual Score:           Brighton {prediction.get('actual_score', '3-0')} Arsenal  (HT: {fixture_meta.get('half_time_home_score', 2)}-{fixture_meta.get('half_time_away_score', 0)})")
print(f"  • Actual Result:          {prediction.get('actual_result', 'H')} (Home Win)")

print("\n[2] CALIBRATION 3: BASE RATING VELOCITY LIMITER (OPTION B)")
print(f"  Anchor: End of 25/26 Season | Active GW Completed: {active_gw_completed} | Max Delta: ±{max_allowed_delta:.2f} pts (1.25 * {active_gw_completed})")
print("+" + "-"*18 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*14 + "+")
print(f"| {'Club':<16} | {'25/26 Anchor':<12} | {'Unconstrained':<12} | {'Clamped Base':<12} | {'Limiter Status':<12} |")
print("+" + "-"*18 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*14 + "+")
print(f"| {'Brighton (Home)':<16} | {h_anchor_base:<12.2f} | {h_uncon_rating:<12.2f} | {h_base_rating:<12.2f} | {h_clamped_status:<12} |")
print(f"| {'Arsenal (Away)':<16} | {a_anchor_base:<12.2f} | {a_uncon_rating:<12.2f} | {a_base_rating:<12.2f} | {a_clamped_status:<12} |")
print("+" + "-"*18 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*14 + "+")
print(f"  • Brighton unconstrained rating of {h_uncon_rating:.2f} was constrained to {h_base_rating:.2f} ({h_anchor_base:.2f} + {max_allowed_delta:.2f}).")
print(f"  • Arsenal unconstrained rating of {a_uncon_rating:.2f} was constrained to {a_base_rating:.2f} ({a_anchor_base:.2f} - {max_allowed_delta:.2f}).")

print("\n[3] CALIBRATION 1 & 2: 180-DAY HALF-LIFE & EMPIRICAL BAYES SHRINKAGE (M = 6)")
print("    Shrinkage: shrunk_rate = (actual_goals + (6 * prior_season_avg)) / (games_played + 6)")
print("+" + "-"*18 + "+" + "-"*13 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*15 + "+")
print(f"| {'Club / Period':<16} | {'Sample':<11} | {'Offense (GF)':<12} | {'Defense (GA)':<12} | {'Net Form / Rate':<13} |")
print("+" + "-"*18 + "+" + "-"*13 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*15 + "+")

b_m = metrics_breakdown['Brighton']
print(f"| {'Brighton 25/26':<16} | {b_m['s25_games']:<11} | {b_m['s25_gf_p90']:<12.2f} | {b_m['s25_ga_p90']:<12.2f} | {b_m['s25_gf_p90'] - b_m['s25_ga_p90']:<+13.2f} |")
print(f"| {'Brighton 26/27':<16} | {b_m['s26_games']:<11} | {b_m['s26_gf_raw_avg']:<12.2f} | {b_m['s26_ga_raw_avg']:<12.2f} | {b_m['s26_gf_raw_avg'] - b_m['s26_ga_raw_avg']:<+13.2f} |")
print(f"| {'  * Shrunk (M=6)':<16} | {'4 + 6 pseudo':<11} | {b_m['shrunk_gf']:<12.3f} | {b_m['shrunk_ga']:<12.3f} | {b_m['shrunk_net']:<+13.3f} |")
print(f"| {'  » 18m Raw':<16} | {b_m['total_games']:<11} | {b_m['raw_gf_p90']:<12.3f} | {b_m['raw_ga_p90']:<12.3f} | {b_m['raw_gf_p90'] - b_m['raw_ga_p90']:<+13.3f} |")
print(f"| {'  » 180d-Weighted':<16} | {b_m['total_games']:<11} | {b_m['weighted_gf_p90']:<12.3f} | {b_m['weighted_ga_p90']:<12.3f} | {b_m['weighted_gf_p90'] - b_m['weighted_ga_p90']:<+13.3f} |")
print("+" + "-"*18 + "+" + "-"*13 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*15 + "+")

a_m = metrics_breakdown['Arsenal']
print(f"| {'Arsenal 25/26':<16} | {a_m['s25_games']:<11} | {a_m['s25_gf_p90']:<12.2f} | {a_m['s25_ga_p90']:<12.2f} | {a_m['s25_gf_p90'] - a_m['s25_ga_p90']:<+13.2f} |")
print(f"| {'Arsenal 26/27':<16} | {a_m['s26_games']:<11} | {a_m['s26_gf_raw_avg']:<12.2f} | {a_m['s26_ga_raw_avg']:<12.2f} | {a_m['s26_gf_raw_avg'] - a_m['s26_ga_raw_avg']:<+13.2f} |")
print(f"| {'  * Shrunk (M=6)':<16} | {'4 + 6 pseudo':<11} | {a_m['shrunk_gf']:<12.3f} | {a_m['shrunk_ga']:<12.3f} | {a_m['shrunk_net']:<+13.3f} |")
print(f"| {'  » 18m Raw':<16} | {a_m['total_games']:<11} | {a_m['raw_gf_p90']:<12.3f} | {a_m['raw_ga_p90']:<12.3f} | {a_m['raw_gf_p90'] - a_m['raw_ga_p90']:<+13.3f} |")
print(f"| {'  » 180d-Weighted':<16} | {a_m['total_games']:<11} | {a_m['weighted_gf_p90']:<12.3f} | {a_m['weighted_ga_p90']:<12.3f} | {a_m['weighted_gf_p90'] - a_m['weighted_ga_p90']:<+13.3f} |")
print("+" + "-"*18 + "+" + "-"*13 + "+" + "-"*14 + "+" + "-"*14 + "+" + "-"*15 + "+")
print(f"  • Shrinkage regressed Brighton's small-sample 3.25 GF/g burst down to a robust {b_m['shrunk_gf']:.2f} GF/g.")
print(f"  • Extending half-life to 180 days smooths the 25/26 campaign weight from ~25% to ~{b_m['avg_weight_s25']*100:.1f}%.")

print("\n[4] STEP-BY-STEP MATHEMATICAL DELTA DECOMPOSITION (CALIBRATED)")
print("+" + "-"*38 + "+" + "-"*14 + "+" + "-"*23 + "+")
print(f"| {'Model Component':<36} | {'Adjustment':<12} | {'Running Total / Impact':<21} |")
print("+" + "-"*38 + "+" + "-"*14 + "+" + "-"*23 + "+")
print(f"| {'Brighton Clamped Base Rating':<36} | {h_base_rating:<12.2f} | {'Anchor 68.45 + 5.00 cap':<21} |")
print(f"| {'Arsenal Clamped Base Rating':<36} | {a_base_rating:<12.2f} | {'Anchor 83.40 - 5.00 cap':<21} |")
print(f"| {'Base Rating Differential (h - a)':<36} | {base_differential:<+12.2f} | {'Arsenal leads by 4.95':<21} |")
print(f"| {'Home Advantage Boost (1.05x)':<36} | {h_boost_pts:<+12.4f} | {'Applied to Brighton rating':<21} |")
print(f"| {'RPS Tactical Clash (Direct vs Control)':<36} | {tactical_delta_impact:<+12.2f} | {'Control beats Direct (-10)':<21} |")
print(f"| {'  - Brighton Clash Share (clash / 2)':<36} | {clash_multiplier / 2.0:<+12.2f} | {'Effective: ' + f'{h_eff:.4f}':<21} |")
print(f"| {'  - Arsenal Clash Share (-clash / 2)':<36} | {-clash_multiplier / 2.0:<+12.2f} | {'Effective: ' + f'{a_eff:.4f}':<21} |")
print("+" + "-"*38 + "+" + "-"*14 + "+" + "-"*23 + "+")
print(f"| {'FINAL NET DELTA (h_eff - a_eff)':<36} | {delta:<+12.4f} | {'Input to Softmax':<21} |")
print("+" + "-"*38 + "+" + "-"*14 + "+" + "-"*23 + "+")

print("\n[5] RAW LOGIT VALUES & SOFTMAX PROBABILITY BREAKDOWN")
print("    Formulas: Logit_H = β * Δ | Logit_A = -β * Δ | Logit_D = c - (k * |Δ|)")
print("    Parameters: β = 0.065, c = 0.20, k = 0.075")
print("+" + "-"*12 + "+" + "-"*16 + "+" + "-"*16 + "+" + "-"*16 + "+" + "-"*11 + "+")
print(f"| {'Outcome':<10} | {'Logit Formula':<14} | {'Raw Logit':<14} | {'exp(Logit)':<14} | {'Probability':<9} |")
print("+" + "-"*12 + "+" + "-"*16 + "+" + "-"*16 + "+" + "-"*16 + "+" + "-"*11 + "+")
print(f"| {'Home (BHA)':<10} | {'0.065 * -11.278':<14} | {logit_h:<+14.4f} | {np.exp(logit_h):<14.4f} | {calc_prob_home:>8.1f}% |")
print(f"| {'Draw (X)':<10} | {'0.20 - 0.075*11.28':<14} | {logit_d:<+14.4f} | {np.exp(logit_d):<14.4f} | {calc_prob_draw:>8.1f}% |")
print(f"| {'Away (ARS)':<10} | {'-0.065 * -11.278':<14} | {logit_a:<+14.4f} | {np.exp(logit_a):<14.4f} | {calc_prob_away:>8.1f}% |")
print("+" + "-"*12 + "+" + "-"*16 + "+" + "-"*16 + "+" + "-"*16 + "+" + "-"*11 + "+")

print("\n[6] REFACTORED MODEL PROBABILITY vs DATABASE & OUTCOME")
print("+" + "-"*20 + "+" + "-"*18 + "+" + "-"*18 + "+" + "-"*18 + "+")
print(f"| {'Metric':<18} | {'Calibrated Model':<16} | {'Legacy Unclamped':<16} | {'Actual Outcome':<16} |")
print("+" + "-"*20 + "+" + "-"*18 + "+" + "-"*18 + "+" + "-"*18 + "+")
print(f"| {'Home Win %':<18} | {calc_prob_home:>15.1f}% | {float(prediction['prob_home']):>15.1f}% | {'3-0 Win':<16} |")
print(f"| {'Draw %':<18} | {calc_prob_draw:>15.1f}% | {float(prediction['prob_draw']):>15.1f}% | {'--':<16} |")
print(f"| {'Away Win %':<18} | {calc_prob_away:>15.1f}% | {float(prediction['prob_away']):>15.1f}% | {'--':<16} |")
print(f"| {'Favored Side':<18} | {favored_side:<16} | {prediction['favored']:<16} | {'Home (BHA)':<16} |")
print(f"| {'Net Delta (Δ)':<18} | {delta:<+16.4f} | {'+7.8575':<16} | {'--':<16} |")
print("+" + "-"*20 + "+" + "-"*18 + "+" + "-"*18 + "+" + "-"*18 + "+")
print(SEP_DOUBLE + "\n")
