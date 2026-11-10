"""
scripts/ingest_fbref_aggregates.py

Polite, one-off Python ingestion pipeline to populate `dev.player_season_aggregates`
using FBref Premier League season summary tables for the 2026/2027 season.

Features:
- Enforces a strict minimum delay of `time.sleep(5)` between HTTP GET requests.
- Uses a polite desktop User-Agent header.
- Caches downloaded raw HTML files locally under `data/fbref_cache/` so subsequent
  runs read from disk without hitting FBref.
- Extracts player tables (unwrapping HTML comment `<!-- ... -->` blocks when needed).
- Normalizes player & club names (via `unicodedata` + `NAME_OVERRIDES`), matches to
  `dev.players`, computes per-90 rates, and batch-upserts to `dev.player_season_aggregates`
  on `(player_id, season)`.
"""

import os
import re
import sys
import time
import logging
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Set

import requests
import dotenv
from bs4 import BeautifulSoup, Comment, Tag
from supabase import create_client, Client

# Ensure UTF-8 console output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ingest_fbref_aggregates")

# ---------------------------------------------------------------------------
# 1. Environment & Constants
# ---------------------------------------------------------------------------
dotenv.load_dotenv(".env.local")
dotenv.load_dotenv(".env")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Missing Supabase credentials. Ensure SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) "
        "and SUPABASE_SERVICE_ROLE_KEY are set in .env.local or environment."
    )

SEASON = "2026/2027"
CACHE_DIR = Path("data/fbref_cache")
REQUEST_DELAY_SECONDS = 5

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Required League Aggregate URLs (plus shooting for shots_total / shots_per_90)
FBREF_PAGES: Dict[str, Dict[str, str]] = {
    "standard": {
        "url": "https://fbref.com/en/comps/9/stats/Premier-League-Stats",
        "table_id": "stats_standard",
    },
    "passing": {
        "url": "https://fbref.com/en/comps/9/passing/Premier-League-Stats",
        "table_id": "stats_passing",
    },
    "defense": {
        "url": "https://fbref.com/en/comps/9/defense/Premier-League-Stats",
        "table_id": "stats_defense",
    },
    "possession": {
        "url": "https://fbref.com/en/comps/9/possession/Premier-League-Stats",
        "table_id": "stats_possession",
    },
    "misc": {
        "url": "https://fbref.com/en/comps/9/misc/Premier-League-Stats",
        "table_id": "stats_misc",
    },
    "shooting": {
        "url": "https://fbref.com/en/comps/9/shooting/Premier-League-Stats",
        "table_id": "stats_shooting",
    },
}

# Squad name mapping from FBref squad string -> canonical normalized club key
FBREF_SQUAD_ALIASES: Dict[str, str] = {
    "arsenal": "arsenal",
    "aston villa": "aston villa",
    "bournemouth": "bournemouth",
    "afc bournemouth": "bournemouth",
    "brentford": "brentford",
    "brighton": "brighton",
    "brighton & hove albion": "brighton",
    "brighton and hove albion": "brighton",
    "burnley": "burnley",
    "chelsea": "chelsea",
    "coventry city": "coventry",
    "coventry": "coventry",
    "crystal palace": "crystal palace",
    "everton": "everton",
    "fulham": "fulham",
    "hull city": "hull",
    "hull": "hull",
    "ipswich town": "ipswich",
    "ipswich": "ipswich",
    "leeds united": "leeds",
    "leeds": "leeds",
    "leicester city": "leicester",
    "leicester": "leicester",
    "liverpool": "liverpool",
    "manchester city": "manchester city",
    "man city": "manchester city",
    "manchester utd": "manchester united",
    "manchester united": "manchester united",
    "man utd": "manchester united",
    "newcastle": "newcastle",
    "newcastle united": "newcastle",
    "nottingham": "nottingham forest",
    "nottingham forest": "nottingham forest",
    "nott'm forest": "nottingham forest",
    "southampton": "southampton",
    "sunderland": "sunderland",
    "tottenham": "tottenham",
    "tottenham hotspur": "tottenham",
    "spurs": "tottenham",
    "west ham": "west ham",
    "west ham united": "west ham",
    "wolves": "wolves",
    "wolverhampton": "wolves",
    "wolverhampton wanderers": "wolves",
}

# Explicit player name overrides: normalized FBref name -> normalized DB full_name or web_name
NAME_OVERRIDES: Dict[str, str] = {
    "riquelme angulo": "juan angulo",
    "chema": "jose maria andres baixauli",
    "nicolas gonzalez": "nico gonzalez iglesias",
    "eli junior kroupi": "junior kroupi",
    "ferdi kadioglu": "ferdi kadioglu",
    "timur tuterov": "tymur tutierov",
    "jorge cuenca": "jorge cuenca barreno",
    "igor": "igor julio dos santos de paulo",
    "morato": "felipe rodrigues da silva",
    "murillo": "murillo santiago costa dos santos",
    "savinho": "savio moreira de oliveira",
    "ederson": "ederson santana de moraes",
    "alisson": "alisson ramses becker",
    "richarlison": "richarlison de andrade",
    "joelinton": "joelinton cassio apolinario de lira",
    "casemiro": "carlos henrique casimiro",
    "antony": "antony matheus dos santos",
    "jorginho": "jorge luiz frello filho",
    "emerson": "emerson palmieri dos santos",
    "beto": "norberto bercique gomes betuncal",
}


# ---------------------------------------------------------------------------
# 2. String & Number Normalization Utilities
# ---------------------------------------------------------------------------
CHAR_REPLACEMENTS = str.maketrans(
    {
        "Ø": "O",
        "ø": "o",
        "Đ": "D",
        "đ": "d",
        "Ł": "L",
        "ł": "l",
        "ı": "i",
        "İ": "i",
        "ß": "ss",
        "Æ": "AE",
        "æ": "ae",
        "Œ": "OE",
        "œ": "oe",
    }
)


def normalize_name(name: str) -> str:
    """Strip accents/diacritics, punctuation, and extra whitespace."""
    if not name:
        return ""
    s = name.translate(CHAR_REPLACEMENTS)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def normalize_club(club_name: str) -> str:
    """Normalize club name to canonical key."""
    if not club_name:
        return ""
    cleaned = re.sub(r"\b(fc|afc)\b", "", club_name.lower()).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return FBREF_SQUAD_ALIASES.get(cleaned, cleaned)


def parse_int(val: Any) -> int:
    """Safely parse integer from string (removing commas)."""
    if val is None:
        return 0
    s = str(val).replace(",", "").strip()
    if not s:
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_float(val: Any) -> float:
    """Safely parse float from string (removing commas)."""
    if val is None:
        return 0.0
    s = str(val).replace(",", "").strip()
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


# ---------------------------------------------------------------------------
# 3. Polite Fetching & Local HTML Caching
# ---------------------------------------------------------------------------
def fetch_or_load_cached_html(key: str, url: str) -> str:
    """
    Load raw HTML from `data/fbref_cache/{key}.html` if present.
    Otherwise, enforce a strict minimum delay of `time.sleep(5)` before making
    an HTTP GET request with polite headers, and save to `data/fbref_cache/`.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{key}.html"

    if cache_path.exists() and cache_path.stat().st_size > 10_000:
        logger.info(f"📂 Cache hit for '{key}' -> reading from {cache_path}")
        return cache_path.read_text(encoding="utf-8", errors="replace")

    logger.info(
        f"⏳ Enforcing polite rate-limit: sleeping {REQUEST_DELAY_SECONDS}s before fetching '{key}' ({url})..."
    )
    time.sleep(REQUEST_DELAY_SECONDS)

    response = requests.get(url, headers=HEADERS, timeout=30)
    if response.status_code == 200 and "Just a moment..." not in response.text:
        html = response.text
        cache_path.write_text(html, encoding="utf-8")
        logger.info(f"✅ Downloaded and cached '{key}' ({len(html):,} bytes) -> {cache_path}")
        return html

    # Fallback if Cloudflare challenge blocks plain requests
    logger.warning(
        f"⚠️ Standard GET returned status {response.status_code} (Cloudflare challenge). "
        f"Attempting polite headless browser fetch for '{key}'..."
    )
    try:
        import seleniumbase as sb  # type: ignore

        driver = sb.Driver(uc=True, headless=True)
        try:
            driver.get(url)
            time.sleep(REQUEST_DELAY_SECONDS)
            html = driver.page_source
            if "stats_" in html:
                cache_path.write_text(html, encoding="utf-8")
                logger.info(
                    f"✅ Downloaded and cached '{key}' via browser ({len(html):,} bytes) -> {cache_path}"
                )
                return html
        finally:
            driver.quit()
    except Exception as exc:
        logger.error(f"Browser fallback failed for '{key}': {exc}")

    raise RuntimeError(
        f"Failed to fetch valid FBref HTML for '{key}' from {url} (HTTP {response.status_code})."
    )


# ---------------------------------------------------------------------------
# 4. HTML Table Extraction & Parsing
# ---------------------------------------------------------------------------
def extract_table_from_html(html: str, table_id: str) -> Optional[Tag]:
    """
    Find a `<table id="{table_id}">` in the page HTML.
    Handles FBref's convention of embedding secondary player tables inside
    HTML comments `<!-- ... -->`.
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1. Check direct DOM first
    table = soup.find("table", id=table_id)
    if isinstance(table, Tag):
        return table

    # 2. Check inside HTML comments <!-- ... -->
    comments = soup.find_all(string=lambda text: isinstance(text, Comment))
    for comment in comments:
        if table_id in comment and "<table" in comment:
            comment_soup = BeautifulSoup(comment, "html.parser")
            table = comment_soup.find("table", id=table_id)
            if isinstance(table, Tag):
                return table

    return None


def parse_fbref_player_table(html: str, table_id: str) -> List[Dict[str, str]]:
    """
    Extract all player data rows from an FBref stats table as dictionaries
    keyed by `data-stat`. Also captures `_fbref_id` from `data-append-csv`.
    """
    table = extract_table_from_html(html, table_id)
    if not table:
        logger.warning(f"⚠️ Could not find table #{table_id} in HTML.")
        return []

    tbody = table.find("tbody")
    if not isinstance(tbody, Tag):
        return []

    parsed_rows: List[Dict[str, str]] = []
    for tr in tbody.find_all("tr"):
        classes = tr.get("class") or []
        if "thead" in classes or "spacer" in classes:
            continue

        player_cell = tr.find(["td", "th"], {"data-stat": "player"})
        if not player_cell:
            continue

        player_name = player_cell.get_text(strip=True)
        if not player_name or player_name.lower() == "player":
            continue

        row_dict: Dict[str, str] = {}
        fbref_id = player_cell.get("data-append-csv")
        if fbref_id:
            row_dict["_fbref_id"] = str(fbref_id).strip()

        for cell in tr.find_all(["th", "td"]):
            stat_name = cell.get("data-stat")
            if stat_name:
                row_dict[str(stat_name)] = cell.get_text(strip=True)

        parsed_rows.append(row_dict)

    logger.info(f"📊 Parsed {len(parsed_rows)} player rows from #{table_id}")
    return parsed_rows


# ---------------------------------------------------------------------------
# 5. Merging Multi-Table FBref Rows & Handling Multi-Club Stints
# ---------------------------------------------------------------------------
def merge_fbref_tables(tables_by_key: Dict[str, List[Dict[str, str]]]) -> List[Dict[str, Any]]:
    """
    Merge player rows across standard, passing, defense, possession, misc, and shooting.
    First merges row-by-row on `(player_key, squad)`, then aggregates across squads if a
    player transferred mid-season within the Premier League so each player has a single
    unified season aggregate record.
    """
    # Step 1: Merge tables per (player_identity, team)
    stint_records: Dict[Tuple[str, str], Dict[str, str]] = {}

    for table_key, rows in tables_by_key.items():
        for row in rows:
            player_id_key = row.get("_fbref_id") or normalize_name(row.get("player", ""))
            team_name = row.get("team", "").strip()
            stint_key = (player_id_key, team_name)

            if stint_key not in stint_records:
                stint_records[stint_key] = dict(row)
            else:
                # Merge non-empty values from supplementary table
                for k, v in row.items():
                    if v != "" or k not in stint_records[stint_key]:
                        stint_records[stint_key][k] = v

    # Step 2: Group stints by player_id_key (handles mid-season transfers)
    grouped_by_player: Dict[str, List[Dict[str, str]]] = {}
    for (player_id_key, _), stint in stint_records.items():
        grouped_by_player.setdefault(player_id_key, []).append(stint)

    unified_players: List[Dict[str, Any]] = []

    for player_id_key, stints in grouped_by_player.items():
        # Sort stints by minutes played ascending so the latest/primary stint can be identified
        primary = stints[-1]
        squads = [s.get("team", "").strip() for s in stints if s.get("team")]

        # Sum counting metrics across all Premier League stints in the season
        matches_played = sum(parse_int(s.get("games")) for s in stints)
        starts = sum(parse_int(s.get("games_starts")) for s in stints)
        minutes_played = sum(parse_int(s.get("minutes")) for s in stints)

        goals = sum(parse_int(s.get("goals")) for s in stints)
        npxg = sum(parse_float(s.get("npxg")) for s in stints)
        shots_total = sum(parse_int(s.get("shots") or s.get("shots_total")) for s in stints)
        shots_on_target = sum(parse_int(s.get("shots_on_target")) for s in stints)

        assists = sum(parse_int(s.get("assists")) for s in stints)
        xa = sum(
            parse_float(s.get("xg_assist") or s.get("xa") or s.get("xg_assist_net"))
            for s in stints
        )
        key_passes = sum(parse_int(s.get("assisted_shots") or s.get("key_passes")) for s in stints)

        passes_completed = sum(parse_int(s.get("passes_completed")) for s in stints)
        passes_attempted = sum(parse_int(s.get("passes")) for s in stints)
        passes_completed_short = sum(parse_int(s.get("passes_completed_short")) for s in stints)
        passes_attempted_short = sum(parse_int(s.get("passes_short")) for s in stints)
        passes_completed_long = sum(parse_int(s.get("passes_completed_long")) for s in stints)
        passes_attempted_long = sum(parse_int(s.get("passes_long")) for s in stints)

        crosses_into_box = sum(parse_int(s.get("crosses_into_penalty_area")) for s in stints)
        crosses_total = sum(parse_int(s.get("crosses")) for s in stints)
        crosses_completed = crosses_into_box if crosses_into_box > 0 else crosses_total

        touches = sum(parse_int(s.get("touches")) for s in stints)
        touches_in_box = sum(parse_int(s.get("touches_att_pen_area")) for s in stints)
        progressive_carries = sum(
            parse_int(s.get("progressive_carries") or s.get("carries_into_final_third"))
            for s in stints
        )
        take_ons_won = sum(parse_int(s.get("take_ons_won")) for s in stints)
        take_ons_attempted = sum(parse_int(s.get("take_ons")) for s in stints)
        miscontrols = sum(parse_int(s.get("miscontrols")) for s in stints)
        dispossessed = sum(parse_int(s.get("dispossessed")) for s in stints)

        tackles_won = sum(parse_int(s.get("tackles_won")) for s in stints)
        tackles_attempted = sum(parse_int(s.get("tackles")) for s in stints)
        interceptions = sum(parse_int(s.get("interceptions")) for s in stints)
        blocks = sum(parse_int(s.get("blocks")) for s in stints)
        clearances = sum(parse_int(s.get("clearances")) for s in stints)

        aerial_duels_won = sum(parse_int(s.get("aerials_won")) for s in stints)
        aerial_duels_lost = sum(parse_int(s.get("aerials_lost")) for s in stints)
        fouls_committed = sum(parse_int(s.get("fouls")) for s in stints)
        fouls_drawn = sum(parse_int(s.get("fouled")) for s in stints)

        # Compute per-90 rates (val / (minutes_played / 90.0)) where minutes_played > 0
        nineties = minutes_played / 90.0 if minutes_played > 0 else 0.0

        def per_90(val: float) -> float:
            return round(val / nineties, 2) if nineties > 0 else 0.0

        def pct(num: float, den: float, fallback_str: Optional[str] = None) -> float:
            if den > 0:
                return round((num / den) * 100.0, 1)
            if fallback_str:
                return round(parse_float(fallback_str), 1)
            return 0.0

        shot_accuracy_pct = pct(
            shots_on_target, shots_total, primary.get("shots_on_target_pct")
        )
        pass_completion_pct = pct(
            passes_completed, passes_attempted, primary.get("passes_pct")
        )
        pass_short_completion_pct = pct(
            passes_completed_short, passes_attempted_short, primary.get("passes_pct_short")
        )
        pass_long_completion_pct = pct(
            passes_completed_long, passes_attempted_long, primary.get("passes_pct_long")
        )
        cross_completion_pct = (
            pct(crosses_into_box, crosses_total) if crosses_into_box > 0 else 0.0
        )
        take_on_success_pct = pct(
            take_ons_won, take_ons_attempted, primary.get("take_ons_won_pct")
        )

        # Tackle count & success percentage: if tackles_attempted is not populated on FBref,
        # use tackles_won for tackles_per_90
        effective_tackles = tackles_attempted if tackles_attempted > 0 else tackles_won
        tackle_success_pct = pct(
            tackles_won, tackles_attempted, primary.get("challenge_tackles_pct")
        )

        aerial_total = aerial_duels_won + aerial_duels_lost
        aerial_win_pct = pct(
            aerial_duels_won, aerial_total, primary.get("aerials_won_pct")
        )

        unified_players.append(
            {
                "_fbref_id": primary.get("_fbref_id"),
                "_player_name": primary.get("player", ""),
                "_squads": squads,
                "_birth_year": primary.get("birth_year", ""),
                "metrics": {
                    "matches_played": matches_played,
                    "starts": starts,
                    "minutes_played": minutes_played,
                    "goals": goals,
                    "npxg": round(npxg, 2),
                    "shots_total": shots_total,
                    "shots_on_target": shots_on_target,
                    "shot_accuracy_pct": shot_accuracy_pct,
                    "shots_per_90": per_90(shots_total),
                    "assists": assists,
                    "xa": round(xa, 2),
                    "key_passes": key_passes,
                    "key_passes_per_90": per_90(key_passes),
                    "passes_completed": passes_completed,
                    "passes_attempted": passes_attempted,
                    "pass_completion_pct": pass_completion_pct,
                    "passes_completed_short": passes_completed_short,
                    "pass_short_completion_pct": pass_short_completion_pct,
                    "passes_completed_long": passes_completed_long,
                    "pass_long_completion_pct": pass_long_completion_pct,
                    "crosses_completed": crosses_completed,
                    "cross_completion_pct": cross_completion_pct,
                    "touches": touches,
                    "touches_in_box": touches_in_box,
                    "progressive_carries": progressive_carries,
                    "progressive_carries_per_90": per_90(progressive_carries),
                    "take_ons_won": take_ons_won,
                    "take_on_success_pct": take_on_success_pct,
                    "dispossessed_per_90": per_90(dispossessed),
                    "miscontrols_per_90": per_90(miscontrols),
                    "tackles_won": tackles_won,
                    "tackles_per_90": per_90(effective_tackles),
                    "tackle_success_pct": tackle_success_pct,
                    "interceptions": interceptions,
                    "interceptions_per_90": per_90(interceptions),
                    "blocks": blocks,
                    "clearances": clearances,
                    "aerial_duels_won": aerial_duels_won,
                    "aerial_duels_lost": aerial_duels_lost,
                    "aerial_win_pct": aerial_win_pct,
                    "fouls_committed": fouls_committed,
                    "fouls_drawn": fouls_drawn,
                },
            }
        )

    return unified_players


# ---------------------------------------------------------------------------
# 6. Player & Club Matching
# ---------------------------------------------------------------------------
def match_fbref_player_to_db(
    fb_player: Dict[str, Any],
    db_players_by_club: Dict[str, List[Dict[str, Any]]],
    all_db_players: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Match an FBref player record to a `dev.players` row by:
    1. Checking `NAME_OVERRIDES` + squad match.
    2. Exact normalized name match (`full_name` or `web_name`) + squad match.
    3. Fallback to matching `web_name` inside the FBref player string (or token subset) + squad match.
    """
    raw_name = fb_player["_player_name"]
    norm_fb = normalize_name(raw_name)
    target_name = NAME_OVERRIDES.get(norm_fb, norm_fb)
    target_tokens = set(target_name.split())

    candidate_clubs = [normalize_club(sq) for sq in fb_player["_squads"] if sq]

    # Collect candidate DB players belonging to the player's squad(s)
    club_candidates: List[Dict[str, Any]] = []
    for club_key in candidate_clubs:
        club_candidates.extend(db_players_by_club.get(club_key, []))

    # 1. Exact normalized match on full_name or web_name within squad
    for p in club_candidates:
        if p["_norm_full"] == target_name or p["_norm_web"] == target_name:
            return p

    # 2. Fallback: web_name contained inside FBref name or token subset match within squad
    for p in club_candidates:
        norm_web = p["_norm_web"]
        norm_full = p["_norm_full"]
        full_tokens = p["_full_tokens"]

        if (
            (norm_web and norm_web in norm_fb)
            or (norm_fb and norm_fb in norm_full)
            or (target_tokens and target_tokens.issubset(full_tokens))
            or (full_tokens and full_tokens.issubset(target_tokens))
        ):
            return p

    # 3. Last-resort cross-squad check if player transferred after FBref snapshot
    for p in all_db_players:
        if p["_norm_full"] == target_name:
            return p

    return None


# ---------------------------------------------------------------------------
# 7. Main Pipeline Execution
# ---------------------------------------------------------------------------
def main() -> None:
    logger.info("🚀 Starting FBref Season Aggregates Ingestion Pipeline...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Fetch public.teams and dev.players from Supabase
    logger.info("🔍 Loading teams from public.teams and players from dev.players...")
    teams_res = supabase.table("teams").select("id, name, short_name").execute()
    db_teams = teams_res.data or []
    team_id_to_club_key: Dict[int, str] = {
        t["id"]: normalize_club(t["name"]) for t in db_teams
    }

    players_res = (
        supabase.schema("dev")
        .table("players")
        .select("id, fpl_id, web_name, full_name, team_id")
        .execute()
    )
    db_players = players_res.data or []
    logger.info(f"📋 Loaded {len(db_players)} players across {len(db_teams)} teams from Supabase.")

    # Precompute normalized names and group DB players by canonical club key
    db_players_by_club: Dict[str, List[Dict[str, Any]]] = {}
    for p in db_players:
        p["_norm_full"] = normalize_name(p.get("full_name") or "")
        p["_norm_web"] = normalize_name(p.get("web_name") or "")
        p["_full_tokens"] = set(p["_norm_full"].split())
        club_key = team_id_to_club_key.get(p.get("team_id"), "")
        db_players_by_club.setdefault(club_key, []).append(p)

    # 2. Fetch or load cached FBref HTML pages and parse tables
    tables_by_key: Dict[str, List[Dict[str, str]]] = {}
    for page_key, cfg in FBREF_PAGES.items():
        html = fetch_or_load_cached_html(page_key, cfg["url"])
        tables_by_key[page_key] = parse_fbref_player_table(html, cfg["table_id"])

    # 3. Merge multi-table player stats
    unified_fbref_players = merge_fbref_tables(tables_by_key)
    logger.info(
        f"🔄 Consolidated {len(unified_fbref_players)} unique Premier League players from FBref tables."
    )

    # 4. Match FBref players to dev.players
    upsert_rows_by_player_id: Dict[str, Dict[str, Any]] = {}
    matched_count = 0
    unmatched_rows: List[str] = []

    now_iso = datetime.now(timezone.utc).isoformat()

    for fb_player in unified_fbref_players:
        matched_db_player = match_fbref_player_to_db(
            fb_player, db_players_by_club, db_players
        )
        if not matched_db_player:
            squad_str = ", ".join(fb_player["_squads"])
            unmatched_rows.append(f"{fb_player['_player_name']} ({squad_str})")
            continue

        matched_count += 1
        player_uuid = matched_db_player["id"]
        team_id = matched_db_player["team_id"]

        record = {
            "player_id": player_uuid,
            "season": SEASON,
            "team_id": team_id,
            **fb_player["metrics"],
            "updated_at": now_iso,
        }
        upsert_rows_by_player_id[player_uuid] = record

    logger.info(
        f"✅ Matching Summary: {matched_count} matched | {len(unmatched_rows)} unmatched/skipped."
    )
    if unmatched_rows:
        logger.warning("⚠️ Unmatched FBref player rows:")
        for u in unmatched_rows:
            logger.warning(f"   - {u}")

    # 5. Batch Upsert to dev.player_season_aggregates
    records_to_upsert = list(upsert_rows_by_player_id.values())
    batch_size = 100
    total_batches = (len(records_to_upsert) + batch_size - 1) // batch_size

    logger.info(
        f"📦 Upserting {len(records_to_upsert)} player aggregate records into "
        f"dev.player_season_aggregates (season='{SEASON}') in {total_batches} batches..."
    )

    total_upserted = 0
    for i in range(0, len(records_to_upsert), batch_size):
        batch = records_to_upsert[i : i + batch_size]
        batch_num = (i // batch_size) + 1
        res = (
            supabase.schema("dev")
            .table("player_season_aggregates")
            .upsert(batch, on_conflict="player_id,season")
            .execute()
        )
        total_upserted += len(res.data or batch)
        logger.info(
            f"  ✓ Batch {batch_num}/{total_batches} upserted ({total_upserted}/{len(records_to_upsert)})"
        )

    # 6. Verify Final Row Count in dev.player_season_aggregates
    count_res = (
        supabase.schema("dev")
        .table("player_season_aggregates")
        .select("id", count="exact")
        .eq("season", SEASON)
        .execute()
    )
    final_count = count_res.count if count_res.count is not None else len(count_res.data or [])
    logger.info(
        f"🎉 Ingestion complete! Verified row count in dev.player_season_aggregates "
        f"for season '{SEASON}': {final_count}"
    )


if __name__ == "__main__":
    main()
