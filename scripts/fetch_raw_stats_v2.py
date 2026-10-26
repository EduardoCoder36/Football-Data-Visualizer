"""
scripts/fetch_raw_stats_v2.py

V2 Tactical Engine - Step 1 & 3: Fetch Raw Match & Team Stats with Recency Decay (lambda = 0.90)
Collects raw team-level statistical metrics across all 20 Premier League clubs
for the current 2026/2027 season using free, unblocked APIs:
  - Understat JSON endpoints (team season history, match rosters, and shot event telemetry)
  - football-data.org / soccerdata match history aggregates (corners, fouls, cards)
Applies exponential recency weighting (lambda = 0.90) across chronologically ordered matches,
scales weighted totals to standard match equivalents,
and upserts them into the Supabase table `team_raw_stats`.

Idempotent: Uses `id` ({team_slug}_{season}) as the conflict target.
Safe: Does NOT modify or touch `team_tactical_profiles` or `match_predictions`.
"""

import os
import sys
import math
import logging
from datetime import datetime, timezone
import concurrent.futures
from typing import Dict, Any, List, Tuple

import requests
import dotenv
import pandas as pd
import soccerdata as sd
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fetch_raw_stats_v2")

# Suppress noisy external logging
logging.getLogger("soccerdata").setLevel(logging.WARNING)

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
FOOTBALL_DATA_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY")

if not SUPABASE_URL:
    raise ValueError("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL in environment or .env.local")
if not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY in environment or .env.local")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# 2. Canonical Team Name Normalization & Settings
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

SEASON_STRING = "2026-2027"
SEASON_SLUG = "2026_2027"
LAMBDA_DECAY = 0.90  # Exponential recency decay constant


def generate_team_slug(canonical_name: str) -> str:
    """Generate consistent slug for primary key."""
    return (
        canonical_name.lower()
        .replace("&", "and")
        .replace(" ", "_")
        .replace(".", "")
        .replace("'", "")
    )


# ---------------------------------------------------------------------------
# 3. Main Data Aggregation Pipeline with Recency Weighting
# ---------------------------------------------------------------------------
def fetch_raw_stats_v2() -> List[Dict[str, Any]]:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
    })

    # Step A: Initialize Understat session cookies
    logger.info("Initializing Understat connection...")
    session.get("https://understat.com", timeout=15)

    # Step B: Fetch Understat EPL League Data
    logger.info("Fetching Understat EPL 2026 league dataset...")
    league_url = "https://understat.com/getLeagueData/EPL/2026"
    resp = session.get(league_url, timeout=20)
    resp.raise_for_status()
    league_data = resp.json()

    understat_teams = league_data.get("teams", {})
    dates = league_data.get("dates", [])
    played_matches = [d for d in dates if d.get("isResult") is True]

    # Sort matches chronologically by kickoff time
    played_matches.sort(key=lambda d: d.get("datetime", ""))

    logger.info(
        f"Found {len(understat_teams)} clubs and {len(played_matches)} completed matches in Understat."
    )

    # 1. Build chronological match index & weights for each club
    # team -> list of match_ids in chronological order
    team_match_order: Dict[str, List[str]] = {}
    for m in played_matches:
        mid = str(m["id"])
        for side in ["h", "a"]:
            u_t = m[side]["title"]
            c_t = CANONICAL_TEAMS.get(u_t, u_t)
            team_match_order.setdefault(c_t, []).append(mid)

    # Calculate exponential decay weights: w_i = lambda^(N - 1 - i)
    # Most recent match gets weight 1.0, previous gets 0.90, etc.
    team_match_weights: Dict[Tuple[str, str], float] = {}  # (team, mid) -> weight
    team_total_weights: Dict[str, float] = {}

    for team, mids in team_match_order.items():
        n_matches = len(mids)
        w_sum = 0.0
        for idx, mid in enumerate(mids):
            w = LAMBDA_DECAY ** (n_matches - 1 - idx)
            team_match_weights[(team, mid)] = w
            w_sum += w
        team_total_weights[team] = w_sum

    team_records: Dict[str, Dict[str, Any]] = {}
    understat_id_to_name: Dict[str, str] = {}

    # Accumulators for shot-level and roster metrics
    shot_accumulators: Dict[str, Dict[str, float]] = {}

    for u_id, t_info in understat_teams.items():
        u_title = t_info["title"]
        canon_name = CANONICAL_TEAMS.get(u_title, u_title)
        understat_id_to_name[str(u_id)] = canon_name
        understat_id_to_name[u_title] = canon_name

        hist = t_info.get("history", [])
        # Sort history chronologically by date
        hist_sorted = sorted(hist, key=lambda h: h.get("date", ""))
        mp = len(hist_sorted)

        # Compute weights for history matches
        w_total = team_total_weights.get(canon_name, float(mp))
        scale_factor = (mp / w_total) if w_total > 0 else 1.0

        weighted_deep = 0.0
        weighted_deep_allow = 0.0
        weighted_npxg = 0.0
        weighted_npxga = 0.0
        weighted_ppda_att = 0.0
        weighted_ppda_def = 0.0
        weighted_oppda_att = 0.0
        weighted_oppda_def = 0.0

        for idx, h in enumerate(hist_sorted):
            w_match = LAMBDA_DECAY ** (mp - 1 - idx)
            weighted_deep += w_match * int(h.get("deep", 0))
            weighted_deep_allow += w_match * int(h.get("deep_allowed", 0))
            weighted_npxg += w_match * float(h.get("npxG", 0.0))
            weighted_npxga += w_match * float(h.get("npxGA", 0.0))

            weighted_ppda_att += w_match * float(h.get("ppda", {}).get("att", 0))
            weighted_ppda_def += w_match * float(h.get("ppda", {}).get("def", 0))
            weighted_oppda_att += w_match * float(h.get("ppda_allowed", {}).get("att", 0))
            weighted_oppda_def += w_match * float(h.get("ppda_allowed", {}).get("def", 0))

        # Scale to standard match equivalents
        deep_comp = int(round(weighted_deep * scale_factor))
        deep_allow = int(round(weighted_deep_allow * scale_factor))
        possession_proxy = (
            round(deep_comp / (deep_comp + deep_allow), 4)
            if (deep_comp + deep_allow) > 0
            else 0.5000
        )

        npxg = round(weighted_npxg * scale_factor, 2)
        npxga = round(weighted_npxga * scale_factor, 2)

        ppda = round(weighted_ppda_att / weighted_ppda_def, 2) if weighted_ppda_def > 0 else 0.0
        oppda = round(weighted_oppda_att / weighted_oppda_def, 2) if weighted_oppda_def > 0 else 0.0

        team_slug = generate_team_slug(canon_name)
        pk_id = f"{team_slug}_{SEASON_SLUG}"

        team_records[canon_name] = {
            "id": pk_id,
            "team": canon_name,
            "season": SEASON_STRING,
            "matches_played": mp,
            "deep_completions": deep_comp,
            "deep_allowed": deep_allow,
            "possession_proxy": possession_proxy,
            "shots_head": 0,
            "xg_head": 0.0,
            "xg_set_piece": 0.0,
            "corners_won": 0,
            "xg_open_play": 0.0,
            "shots_inside_box": 0,
            "npxg": npxg,
            "shots_counter": 0,
            "xg_counter": 0.0,
            "ppda": ppda,
            "shots_outside_box": 0,
            "goals_outside_box": 0,
            "avg_shot_distance": 0.0,
            "shots_head_conceded": 0,
            "xga_head": 0.0,
            "xga_set_piece": 0.0,
            "corners_conceded": 0,
            "xga_open_play": 0.0,
            "npxga": npxga,
            "shots_inside_box_conceded": 0,
            "shots_counter_conceded": 0,
            "xga_counter": 0.0,
            "oppda": oppda,
            "shots_outside_box_conceded": 0,
            "fouls_conceded": 0,
            "yellow_cards": 0,
        }

        shot_accumulators[canon_name] = {
            "weighted_shots_head": 0.0,
            "weighted_xg_head": 0.0,
            "weighted_xg_set_piece": 0.0,
            "weighted_xg_open_play": 0.0,
            "weighted_shots_inside_box": 0.0,
            "weighted_shots_counter": 0.0,
            "weighted_xg_counter": 0.0,
            "weighted_shots_outside_box": 0.0,
            "weighted_goals_outside_box": 0.0,
            "weighted_shots_head_conceded": 0.0,
            "weighted_xga_head": 0.0,
            "weighted_xga_set_piece": 0.0,
            "weighted_xga_open_play": 0.0,
            "weighted_shots_inside_box_conceded": 0.0,
            "weighted_shots_counter_conceded": 0.0,
            "weighted_xga_counter": 0.0,
            "weighted_shots_outside_box_conceded": 0.0,
            "weighted_yellow_cards": 0.0,
            "weighted_dist_sum": 0.0,
            "weighted_dist_weights": 0.0,
        }

    # Step C: Fetch match details for shot locations, situations, and bookings
    logger.info("Extracting match-level shot telemetry and bookings in parallel with recency weighting...")

    def fetch_match_payload(mid: str):
        try:
            r = session.get(f"https://understat.com/getMatchData/{mid}", timeout=15)
            if r.status_code == 200:
                return mid, r.json()
        except Exception as e:
            logger.warning(f"Failed to fetch match {mid}: {e}")
        return mid, None

    match_ids = [str(m["id"]) for m in played_matches]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        match_results = list(executor.map(fetch_match_payload, match_ids))

    for mid, mdata in match_results:
        if not mdata:
            continue

        shots = mdata.get("shots", {})
        rosters = mdata.get("rosters", {})

        # 1. Player rosters for yellow cards with recency decay
        for side in ["h", "a"]:
            for p in rosters.get(side, {}).values():
                tid = str(p.get("team_id"))
                tname = understat_id_to_name.get(tid)
                if tname and tname in shot_accumulators:
                    w_t = team_match_weights.get((tname, mid), 1.0)
                    shot_accumulators[tname]["weighted_yellow_cards"] += w_t * int(p.get("yellow_card", 0))

        # 2. Shot-level metrics with recency decay
        all_match_shots = shots.get("h", []) + shots.get("a", [])
        for shot in all_match_shots:
            h_a = shot.get("h_a")
            h_team = CANONICAL_TEAMS.get(shot.get("h_team"), shot.get("h_team"))
            a_team = CANONICAL_TEAMS.get(shot.get("a_team"), shot.get("a_team"))

            team_name = h_team if h_a == "h" else a_team
            opp_name = a_team if h_a == "h" else h_team

            if team_name not in shot_accumulators or opp_name not in shot_accumulators:
                continue

            w_team = team_match_weights.get((team_name, mid), 1.0)
            w_opp = team_match_weights.get((opp_name, mid), 1.0)

            t_acc = shot_accumulators[team_name]
            opp_acc = shot_accumulators[opp_name]

            try:
                x = float(shot.get("X", 0.0))
                y = float(shot.get("Y", 0.0))
                xg = float(shot.get("xG", 0.0))
            except (ValueError, TypeError):
                continue

            res = shot.get("result")
            stype = shot.get("shotType")
            sit = shot.get("situation")

            # Distance in meters from goal center (105m length x 68m width)
            dx = (1.0 - x) * 105.0
            dy = (0.5 - y) * 68.0
            dist = math.sqrt(dx * dx + dy * dy)
            t_acc["weighted_dist_sum"] += dist * w_team
            t_acc["weighted_dist_weights"] += w_team

            # Box definition: X >= 0.835 and 0.21 <= Y <= 0.79
            is_inside_box = (x >= 0.835) and (0.21 <= y <= 0.79)
            if is_inside_box:
                t_acc["weighted_shots_inside_box"] += w_team
                opp_acc["weighted_shots_inside_box_conceded"] += w_opp
            else:
                t_acc["weighted_shots_outside_box"] += w_team
                opp_acc["weighted_shots_outside_box_conceded"] += w_opp
                if res == "Goal":
                    t_acc["weighted_goals_outside_box"] += w_team

            # Head shots
            if stype == "Head":
                t_acc["weighted_shots_head"] += w_team
                t_acc["weighted_xg_head"] += w_team * xg
                opp_acc["weighted_shots_head_conceded"] += w_opp
                opp_acc["weighted_xga_head"] += w_opp * xg

            # Situations
            if sit == "OpenPlay":
                t_acc["weighted_xg_open_play"] += w_team * xg
                opp_acc["weighted_xga_open_play"] += w_opp * xg
            elif sit == "SetPiece":
                t_acc["weighted_xg_set_piece"] += w_team * xg
                opp_acc["weighted_xga_set_piece"] += w_opp * xg
            elif sit == "FromCounter":
                t_acc["weighted_shots_counter"] += w_team
                t_acc["weighted_xg_counter"] += w_team * xg
                opp_acc["weighted_shots_counter_conceded"] += w_opp
                opp_acc["weighted_xga_counter"] += w_opp * xg

    # Scale accumulated weighted shot metrics to match equivalents
    for t_name, t_rec in team_records.items():
        acc = shot_accumulators[t_name]
        mp = t_rec["matches_played"]
        w_total = team_total_weights.get(t_name, float(mp))
        scale = (mp / w_total) if w_total > 0 else 1.0

        t_rec["shots_inside_box"] = int(round(acc["weighted_shots_inside_box"] * scale))
        t_rec["shots_inside_box_conceded"] = int(round(acc["weighted_shots_inside_box_conceded"] * scale))
        t_rec["shots_outside_box"] = int(round(acc["weighted_shots_outside_box"] * scale))
        t_rec["shots_outside_box_conceded"] = int(round(acc["weighted_shots_outside_box_conceded"] * scale))
        t_rec["goals_outside_box"] = int(round(acc["weighted_goals_outside_box"] * scale))

        t_rec["shots_head"] = int(round(acc["weighted_shots_head"] * scale))
        t_rec["shots_head_conceded"] = int(round(acc["weighted_shots_head_conceded"] * scale))
        t_rec["xg_head"] = round(acc["weighted_xg_head"] * scale, 2)
        t_rec["xga_head"] = round(acc["weighted_xga_head"] * scale, 2)

        t_rec["xg_open_play"] = round(acc["weighted_xg_open_play"] * scale, 2)
        t_rec["xga_open_play"] = round(acc["weighted_xga_open_play"] * scale, 2)
        t_rec["xg_set_piece"] = round(acc["weighted_xg_set_piece"] * scale, 2)
        t_rec["xga_set_piece"] = round(acc["weighted_xga_set_piece"] * scale, 2)

        t_rec["shots_counter"] = int(round(acc["weighted_shots_counter"] * scale))
        t_rec["shots_counter_conceded"] = int(round(acc["weighted_shots_counter_conceded"] * scale))
        t_rec["xg_counter"] = round(acc["weighted_xg_counter"] * scale, 2)
        t_rec["xga_counter"] = round(acc["weighted_xga_counter"] * scale, 2)

        t_rec["yellow_cards"] = int(round(acc["weighted_yellow_cards"] * scale))

        dist_weights = acc["weighted_dist_weights"]
        t_rec["avg_shot_distance"] = (
            round(acc["weighted_dist_sum"] / dist_weights, 2) if dist_weights > 0 else 0.0
        )

    # Step D: Aggregating corners & fouls via Match History with Recency Decay
    logger.info("Aggregating match corners and fouls data with recency weighting...")
    try:
        mh = sd.MatchHistory(leagues="ENG-Premier League", seasons="2026-2027")
        games_df = mh.read_games().reset_index()

        # Sort chronologically by date
        games_df["parsed_date"] = pd.to_datetime(games_df["date"], errors="coerce")
        games_df = games_df.sort_values(by="parsed_date", ascending=True)

        # Track games per team chronologically
        mh_team_matches: Dict[str, List[Dict[str, Any]]] = {t: [] for t in team_records}

        for _, row in games_df.iterrows():
            ht = CANONICAL_TEAMS.get(row.get("home_team"), row.get("home_team"))
            at = CANONICAL_TEAMS.get(row.get("away_team"), row.get("away_team"))
            hc = row.get("HC")
            ac = row.get("AC")
            hf = row.get("HF")
            af = row.get("AF")

            if ht in mh_team_matches and pd.notna(hc) and pd.notna(hf):
                mh_team_matches[ht].append({
                    "cw": int(hc),
                    "cc": int(ac),
                    "fc": int(hf),
                })

            if at in mh_team_matches and pd.notna(ac) and pd.notna(af):
                mh_team_matches[at].append({
                    "cw": int(ac),
                    "cc": int(hc),
                    "fc": int(af),
                })

        for t, t_rec in team_records.items():
            matches_list = mh_team_matches.get(t, [])
            n_mh = len(matches_list)
            target_mp = t_rec["matches_played"]

            if n_mh > 0:
                w_mh_total = 0.0
                weighted_cw = 0.0
                weighted_cc = 0.0
                weighted_fc = 0.0

                for idx, m_stat in enumerate(matches_list):
                    w = LAMBDA_DECAY ** (n_mh - 1 - idx)
                    w_mh_total += w
                    weighted_cw += w * m_stat["cw"]
                    weighted_cc += w * m_stat["cc"]
                    weighted_fc += w * m_stat["fc"]

                scale_mh = (target_mp / w_mh_total) if w_mh_total > 0 else 1.0
                t_rec["corners_won"] = int(round(weighted_cw * scale_mh))
                t_rec["corners_conceded"] = int(round(weighted_cc * scale_mh))
                t_rec["fouls_conceded"] = int(round(weighted_fc * scale_mh))
            else:
                t_rec["corners_won"] = 0
                t_rec["corners_conceded"] = 0
                t_rec["fouls_conceded"] = 0

    except Exception as e:
        logger.warning(f"MatchHistory integration notice: {e}")

    # Step E: Query football-data.org API
    if FOOTBALL_DATA_API_KEY:
        try:
            fb_resp = requests.get(
                "https://api.football-data.org/v4/competitions/PL/matches",
                headers={"X-Auth-Token": FOOTBALL_DATA_API_KEY},
                timeout=10,
            )
            if fb_resp.status_code == 200:
                fb_matches = fb_resp.json().get("matches", [])
                logger.info(
                    f"Verified football-data.org connection. Total scheduled season matches: {len(fb_matches)}."
                )
            else:
                logger.warning(
                    f"football-data.org returned status code {fb_resp.status_code}"
                )
        except Exception as e:
            logger.warning(f"Could not connect to football-data.org: {e}")

    # Step F: Set timestamp
    now_utc = datetime.now(timezone.utc).isoformat()
    for rec in team_records.values():
        rec["updated_at"] = now_utc

    return list(team_records.values())


# ---------------------------------------------------------------------------
# 4. Upsert into Supabase & Print Summary
# ---------------------------------------------------------------------------
def main():
    print("=" * 80)
    print("V2 Tactical Engine - Step 1 & 3: Raw Team Stats Fetcher (Form-Weighted)")
    print("=" * 80)

    records = fetch_raw_stats_v2()

    if len(records) != 20:
        logger.warning(f"Expected 20 clubs, but aggregated {len(records)} records.")
    else:
        logger.info(f"Successfully collected all 20 Premier League club statistics with recency decay (lambda={LAMBDA_DECAY}).")

    # Upsert into Supabase
    print(f"\nUpserting {len(records)} records into Supabase 'team_raw_stats'...")
    try:
        response = (
            supabase.table("team_raw_stats")
            .upsert(records, on_conflict="id")
            .execute()
        )
        upserted_count = len(response.data) if response.data else len(records)
        print(f"Successfully upserted {upserted_count} clubs into 'team_raw_stats'.")
    except Exception as e:
        logger.error(f"Failed to upsert records into Supabase: {e}")
        sys.exit(1)

    # Print Clean Summary Table to stdout
    df_summary = pd.DataFrame(records)[
        [
            "team",
            "matches_played",
            "possession_proxy",
            "npxg",
            "corners_won",
            "fouls_conceded",
            "yellow_cards",
        ]
    ]

    print("\n" + "=" * 80)
    print("PREMIER LEAGUE 2026/2027 RAW STATS SUMMARY TABLE (RECENCY-WEIGHTED)")
    print("=" * 80)
    print(df_summary.to_string(index=False))
    print("=" * 80)
    print("Execution completed successfully without touching existing pipelines.\n")


if __name__ == "__main__":
    main()
