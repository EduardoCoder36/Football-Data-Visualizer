"""
scripts/scrape_last_season_stats.py

One-Off Web Scraper for 2025/2026 Premier League Match Stats.
Scrapes all 380 Premier League matches from the 2025/2026 season from Understat
and populates them into the Supabase table `match_raw_stats` without consuming
API-Football quotas.

Target Source:
  Understat EPL 2025 (https://understat.com/league/EPL/2025)
  and match telemetry endpoint (https://understat.com/getMatchData/{match_id})

Database Target:
  `match_raw_stats`
  Primary Key `id`: PL_2526_US_{understat_match_id}_{norm_team_slug}
  Conflict Target: fixture_id,team_name,season
"""

import os
import re
import sys
import time
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import dotenv
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scrape_last_season_stats")

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

if not SUPABASE_URL:
    raise ValueError("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL in environment or .env.local")
if not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY in environment or .env.local")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# 2. Canonical Team Mapping
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
    # Burnley
    "Burnley": "Burnley",
    "Burnley FC": "Burnley",
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
    # West Ham United
    "West Ham": "West Ham United",
    "West Ham United": "West Ham United",
    "West Ham United FC": "West Ham United",
    # Wolverhampton Wanderers
    "Wolverhampton Wanderers": "Wolverhampton Wanderers",
    "Wolves": "Wolverhampton Wanderers",
    "Wolverhampton Wanderers FC": "Wolverhampton Wanderers",
    # Leicester City
    "Leicester": "Leicester City",
    "Leicester City": "Leicester City",
    # Southampton
    "Southampton": "Southampton",
    "Southampton FC": "Southampton",
}


def normalize_team(name: str) -> str:
    """Map raw team title to canonical club representation."""
    if not name:
        return ""
    clean = name.strip()
    return CANONICAL_TEAMS.get(clean, clean)


def slugify_team(canon_name: str) -> str:
    """Generate consistent slug for primary key ID."""
    return (
        canon_name.lower()
        .replace("&", "and")
        .replace(" ", "_")
        .replace(".", "")
        .replace("'", "")
    )


# ---------------------------------------------------------------------------
# 3. Understat Scraper Engine
# ---------------------------------------------------------------------------
SEASON_YEAR = 2025
SEASON_LABEL = "2025/2026"
FIXTURE_ID_OFFSET = 2526000

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "X-Requested-With": "XMLHttpRequest",
}


def create_session() -> requests.Session:
    """Create requests session with initial cookies from Understat."""
    session = requests.Session()
    session.headers.update(HTTP_HEADERS)
    try:
        session.get("https://understat.com", timeout=15)
    except Exception as e:
        logger.warning(f"Initial understat.com handshake notice: {e}")
    return session


def fetch_league_matches(session: requests.Session) -> List[Dict[str, Any]]:
    """
    Fetches all match schedules and scores for EPL 2025 from Understat.
    Tries the direct JSON endpoint first, then falls back to regex HTML extraction.
    """
    logger.info(f"Fetching EPL {SEASON_YEAR} season fixture overview from Understat...")

    # Method A: Direct getLeagueData endpoint
    try:
        url = f"https://understat.com/getLeagueData/EPL/{SEASON_YEAR}"
        resp = session.get(url, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            dates = data.get("dates", [])
            finished = [d for d in dates if d.get("isResult") is True]
            if len(finished) >= 380:
                logger.info(f"Retrieved {len(finished)} completed fixtures via getLeagueData.")
                return finished
    except Exception as e:
        logger.warning(f"getLeagueData endpoint notice: {e}")

    # Method B: Regex HTML extraction from /league/EPL/2025
    try:
        url = f"https://understat.com/league/EPL/{SEASON_YEAR}"
        resp = session.get(url, timeout=20)
        if resp.status_code == 200:
            # Look for datesData = JSON.parse('...')
            m = re.search(r"datesData\s*=\s*JSON\.parse\('(.*?)'\)", resp.text)
            if m:
                raw_json = bytes(m.group(1), "utf-8").decode("unicode-escape")
                data = json.loads(raw_json)
                finished = [d for d in data if d.get("isResult") is True]
                logger.info(f"Retrieved {len(finished)} completed fixtures via HTML regex.")
                return finished
    except Exception as e:
        logger.error(f"HTML extraction failed: {e}")

    raise RuntimeError(f"Failed to fetch completed matches for EPL {SEASON_YEAR} from Understat.")


def fetch_match_drilldown(
    session: requests.Session, match_id: str
) -> Dict[str, Dict[str, Any]]:
    """
    Scrapes detailed match shot telemetry from Understat for a single fixture.
    Returns shot counts and disciplinary statistics for home ('h') and away ('a').
    """
    url = f"https://understat.com/getMatchData/{match_id}"
    result = {
        "h": {
            "shots_total": None,
            "shots_on_target": None,
            "shots_off_target": None,
            "shots_blocked": None,
            "shots_inside_box": None,
            "shots_outside_box": None,
            "yellow_cards": None,
            "red_cards": None,
        },
        "a": {
            "shots_total": None,
            "shots_on_target": None,
            "shots_off_target": None,
            "shots_blocked": None,
            "shots_inside_box": None,
            "shots_outside_box": None,
            "yellow_cards": None,
            "red_cards": None,
        },
    }

    try:
        # Respectful small delay
        time.sleep(0.15)
        resp = session.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            shots_data = data.get("shots", {})
            rosters_data = data.get("rosters", {})

            for side in ["h", "a"]:
                side_shots = shots_data.get(side, [])
                total_shots = len(side_shots)
                sot = sum(1 for s in side_shots if s.get("result") in ("Goal", "SavedShot"))
                soff = sum(1 for s in side_shots if s.get("result") in ("MissedShots", "ShotOnPost"))
                sblocked = sum(1 for s in side_shots if s.get("result") == "BlockedShot")

                # Box boundary definition: X >= 0.835 and 0.21 <= Y <= 0.79
                inside = sum(
                    1
                    for s in side_shots
                    if float(s.get("X", 0.0)) >= 0.835 and 0.21 <= float(s.get("Y", 0.0)) <= 0.79
                )
                outside = max(0, total_shots - inside)

                side_roster = rosters_data.get(side, {})
                yellows = sum(int(p.get("yellow_card", 0)) for p in side_roster.values())
                reds = sum(int(p.get("red_card", 0)) for p in side_roster.values())

                result[side] = {
                    "shots_total": total_shots,
                    "shots_on_target": sot,
                    "shots_off_target": soff,
                    "shots_blocked": sblocked,
                    "shots_inside_box": inside,
                    "shots_outside_box": outside,
                    "yellow_cards": yellows,
                    "red_cards": reds,
                }
    except Exception as e:
        logger.debug(f"Detail fetch failed for match {match_id}: {e}")

    return result


# ---------------------------------------------------------------------------
# 4. Main Transformation & Sync Pipeline
# ---------------------------------------------------------------------------
def scrape_last_season_stats(include_drilldown: bool = True) -> List[Dict[str, Any]]:
    """
    Main orchestration routine:
      1. Scrapes all 380 Premier League 2025/2026 matches from Understat.
      2. Optionally fetches per-match shot telemetry.
      3. Normalizes into 760 records (2 rows per match: Home and Away).
      4. Batch upserts into Supabase `match_raw_stats` using on_conflict="fixture_id,team_name,season".
    """
    logger.info("=" * 80)
    logger.info(f"Starting Understat Scraper for {SEASON_LABEL} Premier League Season...")
    logger.info("=" * 80)

    session = create_session()
    matches = fetch_league_matches(session)

    if len(matches) != 380:
        logger.warning(f"Expected 380 matches, found {len(matches)}. Proceeding with available matches...")

    # Sort matches chronologically
    matches.sort(key=lambda m: m.get("datetime", ""))

    # Step 2: Fetch shot details concurrently if requested
    match_details: Dict[str, Dict[str, Any]] = {}

    if include_drilldown:
        logger.info("Scraping detailed shot counts for all 380 matches with respectful client throttling...")
        t_start = time.time()
        match_ids = [str(m["id"]) for m in matches]

        # Use 6 workers with internal delay to balance throughput and politeness
        with ThreadPoolExecutor(max_workers=6) as executor:
            future_to_id = {
                executor.submit(fetch_match_drilldown, session, mid): mid for mid in match_ids
            }
            completed = 0
            for future in as_completed(future_to_id):
                mid = future_to_id[future]
                try:
                    stats = future.result()
                    match_details[mid] = stats
                except Exception as e:
                    logger.warning(f"Failed to process details for match {mid}: {e}")
                completed += 1
                if completed % 50 == 0 or completed == len(match_ids):
                    logger.info(f"Progress: {completed}/{len(match_ids)} match details scraped...")

        elapsed = time.time() - t_start
        logger.info(f"Completed match detail drilldown in {elapsed:.1f}s.")

    # Step 3: Transform into database records
    all_records: List[Dict[str, Any]] = []
    now_utc = datetime.now(timezone.utc).isoformat()

    for m in matches:
        u_id = str(m.get("id"))
        numeric_fixture_id = FIXTURE_ID_OFFSET + int(u_id)

        raw_h = m.get("h", {}).get("title", "")
        raw_a = m.get("a", {}).get("title", "")

        norm_h = normalize_team(raw_h)
        norm_a = normalize_team(raw_a)

        slug_h = slugify_team(norm_h)
        slug_a = slugify_team(norm_a)

        # Parse date to ISO 8601
        raw_dt = m.get("datetime", "")
        try:
            dt_iso = datetime.fromisoformat(raw_dt.replace(" ", "T")).replace(tzinfo=timezone.utc).isoformat()
        except Exception:
            dt_iso = raw_dt

        # Goals & xG
        h_goals = int(m.get("goals", {}).get("h", 0))
        a_goals = int(m.get("goals", {}).get("a", 0))

        h_xg = round(float(m.get("xG", {}).get("h", 0.0)), 2)
        a_xg = round(float(m.get("xG", {}).get("a", 0.0)), 2)

        # Shot details if available
        details = match_details.get(u_id, {})
        h_details = details.get("h", {})
        a_details = details.get("a", {})

        # Home Record
        home_record = {
            "id": f"PL_2526_US_{u_id}_{slug_h}",
            "fixture_id": numeric_fixture_id,
            "competition_code": "PL",
            "season": SEASON_LABEL,
            "match_date": dt_iso,
            "team_name": norm_h,
            "opponent_name": norm_a,
            "is_home": True,
            "goals": h_goals,
            "expected_goals": h_xg,
            "shots_total": h_details.get("shots_total"),
            "shots_on_target": h_details.get("shots_on_target"),
            "shots_off_target": h_details.get("shots_off_target"),
            "shots_blocked": h_details.get("shots_blocked"),
            "shots_inside_box": h_details.get("shots_inside_box"),
            "shots_outside_box": h_details.get("shots_outside_box"),
            "yellow_cards": h_details.get("yellow_cards"),
            "red_cards": h_details.get("red_cards"),
            "created_at": now_utc,
            "updated_at": now_utc,
        }

        # Away Record
        away_record = {
            "id": f"PL_2526_US_{u_id}_{slug_a}",
            "fixture_id": numeric_fixture_id,
            "competition_code": "PL",
            "season": SEASON_LABEL,
            "match_date": dt_iso,
            "team_name": norm_a,
            "opponent_name": norm_h,
            "is_home": False,
            "goals": a_goals,
            "expected_goals": a_xg,
            "shots_total": a_details.get("shots_total"),
            "shots_on_target": a_details.get("shots_on_target"),
            "shots_off_target": a_details.get("shots_off_target"),
            "shots_blocked": a_details.get("shots_blocked"),
            "shots_inside_box": a_details.get("shots_inside_box"),
            "shots_outside_box": a_details.get("shots_outside_box"),
            "yellow_cards": a_details.get("yellow_cards"),
            "red_cards": a_details.get("red_cards"),
            "created_at": now_utc,
            "updated_at": now_utc,
        }

        all_records.append(home_record)
        all_records.append(away_record)

    logger.info(f"Built {len(all_records)} database records ({len(matches)} matches x 2 teams).")

    # Step 4: Batch upsert into Supabase match_raw_stats
    batch_size = 50
    logger.info(f"Upserting {len(all_records)} records into Supabase 'match_raw_stats' (batches of {batch_size})...")

    for i in range(0, len(all_records), batch_size):
        batch = all_records[i : i + batch_size]
        try:
            supabase.table("match_raw_stats").upsert(
                batch, on_conflict="fixture_id,team_name,season"
            ).execute()
        except Exception as e:
            logger.error(f"Error upserting batch {i//batch_size + 1}: {e}")
            raise

    logger.info(
        f"Successfully upserted {len(all_records)} records into Supabase 'match_raw_stats' "
        f"for season '{SEASON_LABEL}'."
    )
    return all_records


def main():
    skip_details = "--skip-details" in sys.argv
    scrape_last_season_stats(include_drilldown=not skip_details)


if __name__ == "__main__":
    main()

