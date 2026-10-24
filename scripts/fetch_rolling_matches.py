import soccerdata as sd
import pandas as pd
from datetime import datetime, timedelta

print("Initializing FBref for rolling 18 months (2025-2026 and 2026-2027)...")

# Target the completed 25/26 season and the ongoing 26/27 campaign
fbref = sd.FBref(leagues="ENG-Premier League", seasons=["2025-2026", "2026-2027"])

print("Reading schedule & match logs...")
schedule = fbref.read_schedule().reset_index()

# Filter for matches that have actually taken place (score is recorded)
played = schedule.dropna(subset=['score']).copy()
played['date'] = pd.to_datetime(played['date'])

# Rolling 18 months cutoff (~548 days from today)
cutoff = datetime.now() - timedelta(days=548)
rolling_played = played[played['date'] >= cutoff].sort_values('date', ascending=False)

print(f"\nTotal completed matches found: {len(rolling_played)}")
print(f"Earliest game: {rolling_played['date'].min().date()}")
print(f"Latest game:   {rolling_played['date'].max().date()}")

print("\nBreakdown by season:")
print(rolling_played['season'].value_counts().to_string())

# Preview latest 5 results from the current 26/27 season
print("\nLatest 5 fixtures (2026-2027):")
preview_cols = ['date', 'season', 'home_team', 'score', 'away_team']
print(rolling_played[preview_cols].head(5).to_string(index=False))