import os
import re
import numpy as np
import pandas as pd
import soccerdata as sd
import dotenv
from supabase import create_client
from collections import Counter

# 1. Connect to Supabase
dotenv.load_dotenv('.env.local')
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = (
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    or os.getenv('SUPABASE_KEY')
    or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    or os.getenv('SUPABASE_ANON_KEY')
)

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials in environment or .env.local")

supabase = create_client(supabase_url, supabase_key)

# 2. Load tactical profiles
script_dir = os.path.dirname(os.path.abspath(__file__))
profile_csv_path = os.path.join(script_dir, "tactical_profiles_rolling_18m.csv")
if not os.path.exists(profile_csv_path):
    profile_csv_path = "scripts/tactical_profiles_rolling_18m.csv"

profiles_df = pd.read_csv(profile_csv_path)
profiles = profiles_df.set_index("team").to_dict(orient="index")

# Load 2025-2026 anchor baselines for velocity limiter
anchor_csv_path = os.path.join(script_dir, "tactical_profiles_2025_2026.csv")
if not os.path.exists(anchor_csv_path):
    anchor_csv_path = "scripts/tactical_profiles_2025_2026.csv"

if os.path.exists(anchor_csv_path):
    anchor_df = pd.read_csv(anchor_csv_path).set_index("team")
    anchor_ratings = ((anchor_df["floor"] + anchor_df["ceiling"]) / 2.0).to_dict()
else:
    anchor_ratings = {}

# Standard team aliases for Premier League clubs
TEAM_ALIASES = {
    "Manchester United": "Manchester Utd",
    "Man United": "Manchester Utd",
    "Man Utd": "Manchester Utd",
    "Manchester Utd": "Manchester Utd",
    "Manchester City": "Manchester City",
    "Man City": "Manchester City",
    "Nottingham Forest": "Nottingham",
    "Nott'm Forest": "Nottingham",
    "Nottingham": "Nottingham",
    "Tottenham Hotspur": "Tottenham",
    "Spurs": "Tottenham",
    "Tottenham": "Tottenham",
    "Brighton & Hove Albion": "Brighton",
    "Brighton and Hove Albion": "Brighton",
    "Brighton": "Brighton",
    "Newcastle United": "Newcastle",
    "Newcastle": "Newcastle",
    "West Ham United": "West Ham",
    "West Ham": "West Ham",
    "Wolverhampton Wanderers": "Wolves",
    "Wolverhampton": "Wolves",
    "Wolves": "Wolves",
    "AFC Bournemouth": "Bournemouth",
    "Bournemouth": "Bournemouth",
    "Leeds": "Leeds United",
    "Leeds United": "Leeds United",
    "Ipswich": "Ipswich Town",
    "Ipswich Town": "Ipswich Town",
    "Coventry": "Coventry City",
    "Coventry City": "Coventry City",
    "Hull": "Hull City",
    "Hull City": "Hull City",
    "Leicester": "Leicester City",
    "Leicester City": "Leicester City",
    "Arsenal": "Arsenal",
    "Aston Villa": "Aston Villa",
    "Brentford": "Brentford",
    "Chelsea": "Chelsea",
    "Crystal Palace": "Crystal Palace",
    "Everton": "Everton",
    "Fulham": "Fulham",
    "Liverpool": "Liverpool",
    "Sunderland": "Sunderland",
    "Burnley": "Burnley",
}

def clean_team_name(name: str) -> str:
    """Normalize team name using alias mapping."""
    if not name or pd.isna(name):
        return ""
    name_str = str(name).strip()
    return TEAM_ALIASES.get(name_str, name_str)

def extract_gameweek(row) -> str:
    """Clean the round / week column to extract a normalized string integer (e.g. '9')."""
    val = None
    if 'round' in row and pd.notna(row['round']):
        val = row['round']
    elif 'week' in row and pd.notna(row['week']):
        val = row['week']
        
    if val is None or pd.isna(val):
        return ""
        
    match = re.search(r'(\d+)', str(val).strip())
    if match:
        return str(int(match.group(1)))
    return str(val).strip()

def parse_score(raw_score):
    """
    Extract actual score string (e.g. '2-1') handling any dash variants (–, —, -)
    and calculate actual result ('H', 'D', 'A').
    """
    if pd.isna(raw_score) or not raw_score:
        return None, None
    raw_str = str(raw_score).strip()
    match = re.search(r'(\d+)\s*[-–—:\u2212]\s*(\d+)', raw_str)
    if not match:
        return None, None
    h_s, a_s = int(match.group(1)), int(match.group(2))
    actual_score = f"{h_s}-{a_s}"
    actual_result = "H" if h_s > a_s else ("A" if a_s > h_s else "D")
    return actual_score, actual_result

# 3. Tactical clash modifiers
CLASH_ADVANTAGE = {
    ("Control", "Direct"): 4.5,
    ("Direct", "Transition"): 4.5,
    ("Transition", "Control"): 4.5,
    ("Direct", "Control"): -4.5,
    ("Transition", "Direct"): -4.5,
    ("Control", "Transition"): -4.5,
}

def calculate_probabilities(delta: float):
    """Calibrated Softmax probability engine (c = 0.20, k = 0.075, beta = 0.065)."""
    c = 0.20
    k = 0.075
    beta = 0.065
    
    logit_h = beta * delta
    logit_a = -beta * delta
    logit_d = c - (k * abs(delta))
    
    logits = np.array([logit_h, logit_d, logit_a])
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)
    
    return round(float(probs[0] * 100), 1), round(float(probs[1] * 100), 1), round(float(probs[2] * 100), 1)

# 4. Fetch 2026-2027 schedule from FBref
print("Fetching 2026-2027 schedule from soccerdata FBref...")
fbref = sd.FBref(leagues="ENG-Premier League", seasons="2026-2027", headless=True)
schedule = fbref.read_schedule().reset_index()

# Clean team names and gameweek
schedule['home_team_clean'] = schedule['home_team'].apply(clean_team_name)
schedule['away_team_clean'] = schedule['away_team'].apply(clean_team_name)
schedule['gameweek'] = schedule.apply(extract_gameweek, axis=1)

# Parse scores and results
parsed_scores = [parse_score(s) for s in schedule['score']]
schedule['actual_score'] = [p[0] for p in parsed_scores]
schedule['actual_result'] = [p[1] for p in parsed_scores]

# Segment into Completed Matches vs Upcoming Fixtures
completed_df = schedule[schedule['actual_score'].notna()].copy()
upcoming_df = schedule[schedule['actual_score'].isna()].copy()

# Sort upcoming matches chronologically and pick the next 3-4 gameweeks
upcoming_df['date_dt'] = pd.to_datetime(upcoming_df['date'])
upcoming_df = upcoming_df.sort_values(['date_dt', 'gameweek'])

next_gameweeks = []
for gw in upcoming_df['gameweek']:
    if gw and gw not in next_gameweeks:
        next_gameweeks.append(gw)
        if len(next_gameweeks) == 4:
            break

upcoming_selected = upcoming_df[upcoming_df['gameweek'].isin(next_gameweeks)].copy()

print(f"Total fixtures in schedule: {len(schedule)}")
print(f"Completed matches with scores: {len(completed_df)}")
print(f"Upcoming fixtures selected (next {len(next_gameweeks)} Gameweeks: {next_gameweeks}): {len(upcoming_selected)}")

# 5. Build records for database upsert
def build_prediction_records(df: pd.DataFrame, is_completed: bool):
    records = []
    skipped = []
    
    for _, row in df.iterrows():
        h_team = row['home_team_clean']
        a_team = row['away_team_clean']
        
        if h_team not in profiles or a_team not in profiles:
            skipped.append((h_team, a_team))
            continue
            
        h_p = profiles[h_team]
        a_p = profiles[a_team]
        h_uncon = (h_p['floor'] + h_p['ceiling']) / 2.0
        a_uncon = (a_p['floor'] + a_p['ceiling']) / 2.0
        
        # Velocity Limiter (Option B): clamp to anchor baseline ± (1.25 * active_gameweeks_completed)
        gw_int = int(row['gameweek']) if str(row.get('gameweek', '')).isdigit() else 1
        active_gw_completed = max(0, gw_int - 1) if not is_completed else max(0, gw_int - 1)
        max_allowed_delta = 1.25 * active_gw_completed
        
        if h_team in anchor_ratings:
            h_anchor = anchor_ratings[h_team]
            h_rating = max(h_anchor - max_allowed_delta, min(h_anchor + max_allowed_delta, h_uncon))
        else:
            h_rating = h_uncon
            
        if a_team in anchor_ratings:
            a_anchor = anchor_ratings[a_team]
            a_rating = max(a_anchor - max_allowed_delta, min(a_anchor + max_allowed_delta, a_uncon))
        else:
            a_rating = a_uncon
        
        clash_key = (h_p['archetype'], a_p['archetype'])
        clash = CLASH_ADVANTAGE.get(clash_key, 0.0)
        
        h_eff = h_rating * 1.05 + (clash / 2.0)
        a_eff = a_rating - (clash / 2.0)
        delta = h_eff - a_eff
        
        p_h, p_d, p_a = calculate_probabilities(delta)
        max_p = max(p_h, p_d, p_a)
        favored = "Home" if max_p == p_h else ("Away" if max_p == p_a else "Draw")
        
        match_date_str = str(row['date'])[:10]
        fixture_id = f"{match_date_str}_{h_team.replace(' ', '_')}_{a_team.replace(' ', '_')}"
        
        records.append({
            "id": fixture_id,
            "match_date": f"{match_date_str}T00:00:00+00:00",
            "gameweek": str(row['gameweek']),
            "home_team": h_team,
            "away_team": a_team,
            "prob_home": p_h,
            "prob_draw": p_d,
            "prob_away": p_a,
            "favored": favored,
            "clash_type": f"{h_p['archetype']} vs {a_p['archetype']}",
            "actual_score": row['actual_score'] if is_completed else None,
            "actual_result": row['actual_result'] if is_completed else None,
        })
        
    return records, skipped

completed_records, skipped_completed = build_prediction_records(completed_df, is_completed=True)
upcoming_records, skipped_upcoming = build_prediction_records(upcoming_selected, is_completed=False)

if skipped_completed:
    print(f"Warning: {len(skipped_completed)} completed matches skipped due to missing profiles: {skipped_completed[:3]}")
if skipped_upcoming:
    print(f"Warning: {len(skipped_upcoming)} upcoming matches skipped due to missing profiles: {skipped_upcoming[:3]}")

all_records = completed_records + upcoming_records

# 6. Upsert records into Supabase in batches
if all_records:
    print(f"\nUpserting {len(all_records)} matches to Supabase table 'match_predictions'...")
    batch_size = 50
    for i in range(0, len(all_records), batch_size):
        batch = all_records[i:i + batch_size]
        supabase.table('match_predictions').upsert(batch).execute()
    print("Database upsert successfully completed!")

# 7. Print Console Summary
print("\n" + "=" * 60)
print("             MATCH PREDICTIONS SYNC SUMMARY             ")
print("=" * 60)
print(f"Total Completed Matches Synced (with scores): {len(completed_records)}")
completed_gw_counts = Counter(r['gameweek'] for r in completed_records)
for gw in sorted(completed_gw_counts.keys(), key=lambda x: int(x) if x.isdigit() else 999):
    print(f"  - Gameweek {gw}: {completed_gw_counts[gw]} matches")

print(f"\nTotal Upcoming Matches Synced: {len(upcoming_records)}")
upcoming_gw_counts = Counter(r['gameweek'] for r in upcoming_records)
for gw in sorted(upcoming_gw_counts.keys(), key=lambda x: int(x) if x.isdigit() else 999):
    print(f"  - Gameweek {gw}: {upcoming_gw_counts[gw]} fixtures")

print("\nRecent Completed Matches Preview:")
preview_completed = pd.DataFrame(completed_records)[['match_date', 'gameweek', 'home_team', 'away_team', 'actual_score', 'actual_result', 'prob_home', 'prob_draw', 'prob_away', 'favored']]
print(preview_completed.tail(5).to_string(index=False))

print("\nUpcoming Fixtures Preview:")
preview_upcoming = pd.DataFrame(upcoming_records)[['match_date', 'gameweek', 'home_team', 'away_team', 'prob_home', 'prob_draw', 'prob_away', 'favored', 'clash_type']]
print(preview_upcoming.head(8).to_string(index=False))
print("=" * 60)