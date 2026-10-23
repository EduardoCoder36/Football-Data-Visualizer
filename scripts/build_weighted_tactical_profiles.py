import soccerdata as sd
import pandas as pd
import numpy as np
from datetime import datetime

print("1. Fetching match logs across 2025-2026 and 2026-2027...")
fbref = sd.FBref(leagues="ENG-Premier League", seasons=["2025-2026", "2026-2027"])

# Read schedule to get dates, venues, and scores
schedule = fbref.read_schedule().reset_index()
schedule = schedule.dropna(subset=['score']).copy()
schedule['date'] = pd.to_datetime(schedule['date'])

# Split into home and away match logs
home_logs = schedule[['game_id', 'date', 'home_team', 'score']].copy()
home_logs.columns = ['game_id', 'date', 'team', 'score']
home_logs['venue'] = 'Home'

away_logs = schedule[['game_id', 'date', 'away_team', 'score']].copy()
away_logs.columns = ['game_id', 'date', 'team', 'score']
away_logs['venue'] = 'Away'

match_logs = pd.concat([home_logs, away_logs], ignore_index=True)

# Parse goals scored
def parse_goals(row):
    try:
        raw = str(row['score']).replace('–', '-').replace('—', '-')
        h, a = map(int, raw.split('-'))
        return h if row['venue'] == 'Home' else a
    except Exception:
        return 0

match_logs['goals_scored'] = match_logs.apply(parse_goals, axis=1)

# 2. Fetch standard and misc season metrics to map style ratios per club
df_std = fbref.read_team_season_stats(stat_type="standard").reset_index()
df_misc = fbref.read_team_season_stats(stat_type="misc").reset_index()

# Flatten columns if multi-indexed
df_std.columns = ['_'.join(str(c) for c in col).strip('_') if isinstance(col, tuple) else str(col) for col in df_std.columns]
df_misc.columns = ['_'.join(str(c) for c in col).strip('_') if isinstance(col, tuple) else str(col) for col in df_misc.columns]

# Calculate recency weights (Half-life = 120 days)
now = pd.Timestamp.now()
days_ago = (now - match_logs['date']).dt.total_seconds() / (24 * 3600)
HALF_LIFE = 120.0
match_logs['weight'] = 0.5 ** (days_ago / HALF_LIFE)

# Weighted goals per team
grouped = match_logs.groupby('team').apply(
    lambda g: pd.Series({
        'weighted_gls_p90': (g['goals_scored'] * g['weight']).sum() / g['weight'].sum(),
        'total_games': len(g),
        'recent_form_games': (g['date'] >= (now - pd.Timedelta(days=90))).sum()
    })
).reset_index()

# Merge with underlying tactical metrics from the recent period
# If a team only exists in 26/27 (promoted), soccerdata takes their latest season row
latest_std = df_std.sort_values('season').groupby('team').last().reset_index()
latest_misc = df_misc.sort_values('season').groupby('team').last().reset_index()

merged = pd.merge(latest_std[['team', 'Poss']], latest_misc[['team', 'Performance_Crs', 'Performance_TklW', 'Performance_Int', 'Performance_Fls', '90s']], on='team')
merged = pd.merge(grouped, merged, on='team')

n90 = merged['90s'].astype(float)
merged['Tkl_Int_p90'] = (merged['Performance_TklW'] + merged['Performance_Int']) / n90
merged['Crosses_p90'] = merged['Performance_Crs'] / n90
merged['Fouls_p90'] = merged['Performance_Fls'] / n90

# Min-Max Normalization (0-100)
def normalize(s):
    return (((s - s.min()) / (s.max() - s.min())) * 100).round(1)

merged['score_control'] = normalize(merged['Poss'].astype(float))
merged['score_transition'] = normalize(merged['Tkl_Int_p90'])
merged['score_direct'] = normalize(merged['Crosses_p90'])

# Assign Archetype
def pick_archetype(row):
    scores = {'Control': row['score_control'], 'Transition': row['score_transition'], 'Direct': row['score_direct']}
    return max(scores, key=scores.get)

merged['archetype'] = merged.apply(pick_archetype, axis=1)

# Base rating weighted by recency goals
base_rating = 45 + (normalize(merged['weighted_gls_p90']) * 0.45)
merged['chaos_index'] = normalize(merged['Fouls_p90'])
spread = 7 + (merged['chaos_index'] / 100.0 * 8)

merged['floor'] = (base_rating - spread).round(1)
merged['ceiling'] = (base_rating + spread).round(1)

final_cols = ['team', 'archetype', 'floor', 'ceiling', 'chaos_index', 'total_games', 'score_control', 'score_transition', 'score_direct']
final_df = merged[final_cols].sort_values(by='ceiling', ascending=False)

print("\n=== 18-Month Recency-Weighted Tactical Profiles ===")
print(final_df.to_string(index=False))

# Export clean CSV
final_df.to_csv("scripts/tactical_profiles_rolling_18m.csv", index=False)
print("\nSaved to scripts/tactical_profiles_rolling_18m.csv")