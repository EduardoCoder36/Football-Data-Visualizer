import os
import pandas as pd
import soccerdata as sd
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv(".env.local")

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url:
    raise RuntimeError("Missing Supabase URL (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL) in environment or .env.local")
if not supabase_key:
    raise RuntimeError("Missing Supabase service role key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY) in environment or .env.local")

supabase: Client = create_client(supabase_url, supabase_key)

print("1. Fetching tables...")
fbref = sd.FBref(leagues="ENG-Premier League", seasons="2025-2026")

df_std = fbref.read_team_season_stats(stat_type="standard")
df_misc = fbref.read_team_season_stats(stat_type="misc")

# Flatten column headers
df_std.columns = ['_'.join(str(c) for c in col).strip('_') if isinstance(col, tuple) else str(col) for col in df_std.columns]
df_std = df_std.reset_index()

df_misc.columns = ['_'.join(str(c) for c in col).strip('_') if isinstance(col, tuple) else str(col) for col in df_misc.columns]
df_misc = df_misc.reset_index()

# Merge tables
merged = pd.merge(
    df_std[['team', 'Poss', 'Performance_Gls', 'Playing Time_MP']],
    df_misc[['team', '90s', 'Performance_TklW', 'Performance_Int', 'Performance_Crs', 'Performance_Fls', 'Performance_CrdY']],
    on='team'
)

n90 = merged['90s'].astype(float)
merged['Tkl_Int_p90'] = (merged['Performance_TklW'] + merged['Performance_Int']) / n90
merged['Crosses_p90'] = (merged['Performance_Crs'] / n90)
merged['Fouls_p90'] = (merged['Performance_Fls'] / n90)

# Normalize to 0-100
def normalize(series):
    return (((series - series.min()) / (series.max() - series.min())) * 100).round(1)

merged['score_control'] = normalize(merged['Poss'].astype(float))
merged['score_transition'] = normalize(merged['Tkl_Int_p90'])
merged['score_direct'] = normalize(merged['Crosses_p90'])

# Archetype
def pick_archetype(row):
    scores = {
        'Control': row['score_control'],
        'Transition': row['score_transition'],
        'Direct': row['score_direct']
    }
    return max(scores, key=scores.get)

merged['archetype'] = merged.apply(pick_archetype, axis=1)

# Baseline rating (0-100 scaled from goals scored per match)
gp = merged['Playing Time_MP'].astype(float)
gls_per_game = merged['Performance_Gls'].astype(float) / gp
base_rating = 45 + (normalize(gls_per_game) * 0.45) # maps to range ~45 to 90

# Chaos Index (0-100 based on fouls per 90)
merged['chaos_index'] = normalize(merged['Fouls_p90'])

# Spread based on Chaos (minimum 7 points, maximum 15 points spread)
spread = 7 + (merged['chaos_index'] / 100.0 * 8)

merged['floor'] = (base_rating - spread).round(1)
merged['ceiling'] = (base_rating + spread).round(1)

# Preview final table
final_cols = ['team', 'archetype', 'floor', 'ceiling', 'chaos_index', 'score_control', 'score_transition', 'score_direct']
final_df = merged[final_cols].sort_values(by='ceiling', ascending=False)

print("\n=== Engine-Ready Tactical Profiles ===")
print(final_df.to_string(index=False))

# Export to CSV inside scripts folder
final_df.to_csv("scripts/tactical_profiles_2025_2026.csv", index=False)
print("\nSaved output to scripts/tactical_profiles_2025_2026.csv")

# Construct records for Supabase table team_tactical_profiles
records = []
for _, row in merged.iterrows():
    records.append({
        "id": f"2025-2026_{row['team']}",
        "season": "2025-2026",
        "team": str(row['team']),
        "matches_played": int(row['Playing Time_MP']),
        "possession": float(row['Poss']),
        "goals_scored": int(row['Performance_Gls']),
        "tackles_won": int(row['Performance_TklW']),
        "interceptions": int(row['Performance_Int']),
        "crosses": int(row['Performance_Crs']),
        "fouls": int(row['Performance_Fls']),
        "yellow_cards": int(row['Performance_CrdY']),
        "tkl_int_p90": round(float(row['Tkl_Int_p90']), 2),
        "crosses_p90": round(float(row['Crosses_p90']), 2),
        "fouls_p90": round(float(row['Fouls_p90']), 2),
        "score_control": float(row['score_control']),
        "score_transition": float(row['score_transition']),
        "score_direct": float(row['score_direct']),
        "archetype": str(row['archetype']),
        "chaos_index": float(row['chaos_index']),
        "floor": float(row['floor']),
        "ceiling": float(row['ceiling']),
    })

# Upsert to Supabase
print(f"\nUpserting {len(records)} tactical profiles to Supabase table 'team_tactical_profiles'...")
response = supabase.table("team_tactical_profiles").upsert(records, on_conflict="id").execute()
print(f"Successfully upserted {len(response.data or records)} team records to 'team_tactical_profiles'.")