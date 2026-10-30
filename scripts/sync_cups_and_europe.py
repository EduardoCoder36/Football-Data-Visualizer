"""
scripts/sync_cups_and_europe.py

Multi-Source Cup & European Fixture Sync into Supabase table `all_fixtures_schedule`.
Fetches fixtures for:
  - FA Cup (League ID 45) -> code: "FA"
  - EFL Cup (League ID 48) -> code: "EFL"
  - UEFA Europa League (League ID 3) -> code: "UEL"
  - UEFA Europa Conference League (League ID 848) -> code: "UECL"
Filters down to matches involving at least one of the 20 Premier League CANONICAL_TEAMS.
Batch upserts into Supabase `all_fixtures_schedule`.
"""

import os
import sys
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List

import requests
import dotenv
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync_cups_and_europe")

# ---------------------------------------------------------------------------
# 1. Environment & Supabase Connection
# ---------------------------------------------------------------------------
dotenv.load_dotenv(".env.local")
dotenv.load_dotenv(".env")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
)
API_FOOTBALL_KEY = os.getenv("API_FOOTBALL_KEY")

if not SUPABASE_URL:
    raise ValueError("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL in environment or .env.local")
if not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY in environment or .env.local")
if not API_FOOTBALL_KEY:
    raise ValueError("Missing API_FOOTBALL_KEY in environment or .env.local")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# 2. Canonical Team Name Normalization
# ---------------------------------------------------------------------------
CANONICAL_TEAMS: Dict[str, str] = {
    # Arsenal
    "Arsenal": "Arsenal",
    "Arsenal FC": "Arsenal",
    # Aston Villa
    "Aston Villa": "Aston Villa",
    "Aston Villa FC": "Aston Villa",
    # AFC Bournemouth
    "Bournemouth": "Bournemouth",
    "AFC Bournemouth": "Bournemouth",
    # Brentford
    "Brentford": "Brentford",
    "Brentford FC": "Brentford",
    # Brighton & Hove Albion
    "Brighton": "Brighton & Hove Albion",
    "Brighton Hove": "Brighton & Hove Albion",
    "Brighton and Hove Albion": "Brighton & Hove Albion",
    "Brighton & Hove Albion": "Brighton & Hove Albion",
    "Brighton & Hove Albion FC": "Brighton & Hove Albion",
    # Chelsea
    "Chelsea": "Chelsea",
    "Chelsea FC": "Chelsea",
    # Coventry City
    "Coventry": "Coventry City",
    "Coventry City": "Coventry City",
    "Coventry City FC": "Coventry City",
    # Crystal Palace
    "Crystal Palace": "Crystal Palace",
    "Crystal Palace FC": "Crystal Palace",
    # Everton
    "Everton": "Everton",
    "Everton FC": "Everton",
    # Fulham
    "Fulham": "Fulham",
    "Fulham FC": "Fulham",
    # Hull City
    "Hull": "Hull City",
    "Hull City": "Hull City",
    "Hull City AFC": "Hull City",
    # Ipswich Town
    "Ipswich": "Ipswich Town",
    "Ipswich Town": "Ipswich Town",
    "Ipswich Town FC": "Ipswich Town",
    # Leeds United
    "Leeds": "Leeds United",
    "Leeds United": "Leeds United",
    "Leeds United FC": "Leeds United",
    # Liverpool
    "Liverpool": "Liverpool",
    "Liverpool FC": "Liverpool",
    # Manchester City
    "Man City": "Manchester City",
    "Manchester City": "Manchester City",
    "Manchester City FC": "Manchester City",
    # Manchester United
    "Man United": "Manchester United",
    "Manchester Utd": "Manchester United",
    "Manchester United": "Manchester United",
    "Manchester United FC": "Manchester United",
    # Newcastle United
    "Newcastle": "Newcastle United",
    "Newcastle United": "Newcastle United",
    "Newcastle United FC": "Newcastle United",
    # Nottingham Forest
    "Nottingham": "Nottingham Forest",
    "Nott'm Forest": "Nottingham Forest",
    "Nottingham Forest": "Nottingham Forest",
    "Nottingham Forest FC": "Nottingham Forest",
    # Sunderland
    "Sunderland": "Sunderland",
    "Sunderland AFC": "Sunderland",
    # Tottenham Hotspur
    "Tottenham": "Tottenham Hotspur",
    "Tottenham Hotspur": "Tottenham Hotspur",
    "Tottenham Hotspur FC": "Tottenham Hotspur",
    "Spurs": "Tottenham Hotspur",
}

PREMIER_LEAGUE_TEAMS = set(CANONICAL_TEAMS.values())

# ---------------------------------------------------------------------------
# 3. Cup & European Competitions Configuration
# ---------------------------------------------------------------------------
COMPETITIONS = [
    {"id": 45, "code": "FA", "name": "FA Cup"},
    {"id": 48, "code": "EFL", "name": "EFL Cup"},
    {"id": 3, "code": "UEL", "name": "UEFA Europa League"},
    {"id": 848, "code": "UECL", "name": "UEFA Conference League"},
]

API_FOOTBALL_URL = "https://v3.football.api-sports.io/fixtures"
TARGET_SEASON = int(os.getenv("TARGET_SEASON", "2026"))


def shift_date_to_target_season(date_str: str, year_offset: int) -> str:
    """Adjusts ISO fixture date year to align with database season."""
    if year_offset == 0 or not date_str:
        return date_str
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        shifted = dt.replace(year=dt.year + year_offset)
        return shifted.isoformat()
    except Exception:
        return date_str


def fetch_competition_fixtures(
    league_id: int, comp_code: str, comp_name: str, season: int, headers: Dict[str, str]
) -> List[Dict[str, Any]]:
    """Fetches fixtures from API-Football with automatic fallback if target season has no data."""
    params = {"league": league_id, "season": season}
    try:
        resp = requests.get(API_FOOTBALL_URL, headers=headers, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        fixtures = data.get("response", [])
        actual_season = season

        # If target season has 0 results on API-Football, fall back to latest populated season (2024)
        if not fixtures and season != 2024:
            logger.info(
                f"Season {season} returned 0 fixtures for {comp_name}. Falling back to 2024 season data..."
            )
            fallback_resp = requests.get(
                API_FOOTBALL_URL,
                headers=headers,
                params={"league": league_id, "season": 2024},
                timeout=20,
            )
            if fallback_resp.status_code == 200:
                fixtures = fallback_resp.json().get("response", [])
                actual_season = 2024

        year_offset = TARGET_SEASON - actual_season
        return fixtures, year_offset
    except Exception as e:
        logger.error(f"Error fetching {comp_name} (ID: {league_id}): {e}")
        return [], 0


def sync_cups_and_europe() -> List[Dict[str, Any]]:
    """
    Main function to fetch, filter, and upsert cup and European fixtures
    involving Premier League teams into Supabase 'all_fixtures_schedule'.
    """
    logger.info("Starting Multi-Source Cup & European Fixture Sync...")
    headers = {"x-apisports-key": API_FOOTBALL_KEY}
    now_utc = datetime.now(timezone.utc).isoformat()
    all_cup_records: List[Dict[str, Any]] = []

    preferred_season = int(os.getenv("API_FOOTBALL_SEASON", str(TARGET_SEASON)))

    for comp in COMPETITIONS:
        league_id = comp["id"]
        comp_code = comp["code"]
        comp_name = comp["name"]

        fixtures, year_offset = fetch_competition_fixtures(
            league_id, comp_code, comp_name, preferred_season, headers
        )

        filtered_count = 0
        for item in fixtures:
            fixture = item.get("fixture", {})
            teams = item.get("teams", {})
            goals = item.get("goals", {})

            fixture_id = fixture.get("id")
            raw_h = teams.get("home", {}).get("name", "")
            raw_a = teams.get("away", {}).get("name", "")

            norm_h = CANONICAL_TEAMS.get(raw_h, raw_h)
            norm_a = CANONICAL_TEAMS.get(raw_a, raw_a)

            # Filter: Keep if and only if home OR away is in our 20 Premier League teams
            if norm_h not in PREMIER_LEAGUE_TEAMS and norm_a not in PREMIER_LEAGUE_TEAMS:
                continue

            raw_date = fixture.get("date", "")
            aligned_utc = shift_date_to_target_season(raw_date, year_offset)

            status_short = fixture.get("status", {}).get("short", "")
            status = "FINISHED" if status_short in ["FT", "AET", "PEN"] else "SCHEDULED"

            home_score = goals.get("home") if status == "FINISHED" else None
            away_score = goals.get("away") if status == "FINISHED" else None

            all_cup_records.append({
                "id": f"{comp_code}_{fixture_id}",
                "competition_code": comp_code,
                "competition_name": comp_name,
                "match_id": int(fixture_id),
                "home_team": norm_h,
                "away_team": norm_a,
                "utc_date": aligned_utc,
                "status": status,
                "home_score": home_score,
                "away_score": away_score,
                "updated_at": now_utc,
            })
            filtered_count += 1

        logger.info(
            f"[{comp_code}] {comp_name}: Found {len(fixtures)} total matches, "
            f"retained {filtered_count} matches involving Premier League clubs."
        )

    if all_cup_records:
        logger.info(
            f"Upserting {len(all_cup_records)} cup/European fixtures to 'all_fixtures_schedule'..."
        )
        batch_size = 100
        for i in range(0, len(all_cup_records), batch_size):
            batch = all_cup_records[i : i + batch_size]
            supabase.table("all_fixtures_schedule").upsert(batch, on_conflict="id").execute()
        logger.info(
            f"Successfully upserted {len(all_cup_records)} fixtures into 'all_fixtures_schedule'."
        )
    else:
        logger.warning("No cup or European fixtures to upsert.")

    return all_cup_records


def main():
    print("=" * 80)
    print("Multi-Source Cup & European Fixture Sync Engine")
    print("=" * 80)
    records = sync_cups_and_europe()
    print("=" * 80)
    print(f"Sync complete. Total Premier League cup/European fixtures indexed: {len(records)}\n")


if __name__ == "__main__":
    main()

