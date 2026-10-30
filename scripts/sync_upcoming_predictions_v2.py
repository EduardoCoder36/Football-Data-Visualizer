"""
scripts/sync_upcoming_predictions_v2.py

V2 Tactical Engine - Step 4: Multi-Pillar Match Prediction Engine V2
Calculates match predictions for upcoming and completed Premier League fixtures
using tactical profiles from `team_tactical_profiles_v2` and writes them
to `match_predictions_v2`.

Safe: Does NOT modify or overwrite `match_predictions` (legacy V1 table remains untouched).
"""

import os
import sys
import math
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

import requests
import dotenv
import pandas as pd
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync_upcoming_predictions_v2")

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
if not FOOTBALL_DATA_API_KEY:
    raise ValueError("Missing FOOTBALL_DATA_API_KEY in environment or .env.local")

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


# ---------------------------------------------------------------------------
# 3. Rolling Form History & Match Prediction Calculation Engine
# ---------------------------------------------------------------------------
def build_team_match_history(matches: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    history: Dict[str, List[Dict[str, Any]]] = {}
    finished = [
        m
        for m in matches
        if m.get("status") == "FINISHED"
        and m.get("score", {}).get("fullTime", {}).get("home") is not None
    ]
    # Sort chronologically
    finished.sort(key=lambda x: x.get("utcDate", ""))

    for m in finished:
        raw_h = m.get("homeTeam", {}).get("name", "")
        raw_a = m.get("awayTeam", {}).get("name", "")
        h_team = CANONICAL_TEAMS.get(raw_h, raw_h)
        a_team = CANONICAL_TEAMS.get(raw_a, raw_a)
        utc = m.get("utcDate", "")
        h_goals = m["score"]["fullTime"]["home"]
        a_goals = m["score"]["fullTime"]["away"]

        history.setdefault(h_team, []).append({
            "utc_date": utc,
            "result": "W" if h_goals > a_goals else ("D" if h_goals == a_goals else "L"),
        })
        history.setdefault(a_team, []).append({
            "utc_date": utc,
            "result": "W" if a_goals > h_goals else ("D" if a_goals == h_goals else "L"),
        })
    return history


def get_recent_form_score(
    history: List[Dict[str, Any]], target_utc_date: str, n_matches: int = 4
) -> float:
    prior_matches = [m for m in history if m["utc_date"] < target_utc_date]
    last_n = prior_matches[-n_matches:] if prior_matches else []

    score = 0.0
    for m in last_n:
        if m["result"] == "W":
            score += 2.0
        elif m["result"] == "L":
            score -= 2.0
    return score


def compute_match_probabilities(
    hp: Dict[str, Any],
    ap: Dict[str, Any],
    d_form: float = 0.0,
) -> Tuple[float, float, float, float, float, float]:
    """
    Computes (prob_home, prob_draw, prob_away, d_tactical, rating_edge_h, chaos)
    using the V2 Multi-Pillar Delta & Chaos-Tapered Softmax Engine.
    """
    # A. 4-Pillar Matchup Deltas
    # Home attacking vs Away defending
    d_aerial_h = hp["atk_box_aerial"] - ap["def_box_aerial_suppression"]
    d_central_h = hp["atk_central_penetration"] - ap["def_central_space_denial"]
    d_transition_h = hp["atk_transition_speed"] - ap["def_rest_defense"]
    d_perimeter_h = hp["atk_perimeter_chaos"] - ap["def_perimeter_suppression"]

    # Away attacking vs Home defending
    d_aerial_a = ap["atk_box_aerial"] - hp["def_box_aerial_suppression"]
    d_central_a = ap["atk_central_penetration"] - hp["def_central_space_denial"]
    d_transition_a = ap["atk_transition_speed"] - hp["def_rest_defense"]
    d_perimeter_a = ap["atk_perimeter_chaos"] - hp["def_perimeter_suppression"]

    # Net Tactical Advantage for Home
    d_tactical = (
        0.30 * (d_central_h - d_central_a)
        + 0.25 * (d_transition_h - d_transition_a)
        + 0.25 * (d_aerial_h - d_aerial_a)
        + 0.20 * (d_perimeter_h - d_perimeter_a)
    )

    # B. Baseline Quality Advantage
    d_quality = (hp["floor"] + hp["ceiling"]) - (ap["floor"] + ap["ceiling"])

    # C. Home Advantage & Combined Rating Edge (incorporating 4-game form modifier)
    rating_edge_h = d_quality + 0.50 * d_tactical + 8.0 + d_form

    # D. Chaos Flattening & Tapered Softmax
    chaos = (hp["chaos_index"] + ap["chaos_index"]) / 2.0
    temperature = 35.0 + 0.25 * chaos

    logit_h = rating_edge_h / temperature
    logit_a = -rating_edge_h / temperature
    logit_draw = -0.27 - (0.80 * abs(rating_edge_h)) / temperature

    exp_h = math.exp(logit_h)
    exp_d = math.exp(logit_draw)
    exp_a = math.exp(logit_a)
    denom = exp_h + exp_d + exp_a

    prob_h = round(exp_h / denom, 4)
    prob_d = round(exp_d / denom, 4)
    prob_a = round(exp_a / denom, 4)

    return prob_h, prob_d, prob_a, round(d_tactical, 2), round(rating_edge_h, 2), round(chaos, 2)


# ---------------------------------------------------------------------------
# 4. Pipeline Execution
# ---------------------------------------------------------------------------
def sync_predictions_v2():
    logger.info("Loading V2 tactical profiles from Supabase 'team_tactical_profiles_v2'...")
    p_res = supabase.table("team_tactical_profiles_v2").select("*").execute()
    if not p_res.data:
        raise ValueError("No records found in 'team_tactical_profiles_v2'. Run compute_tactical_profiles_v2.py first.")

    profiles = {r["team"]: r for r in p_res.data}
    logger.info(f"Loaded {len(profiles)} tactical profiles.")

    logger.info("Fetching fixtures from football-data.org API...")
    url = "https://api.football-data.org/v4/competitions/PL/matches"
    resp = requests.get(url, headers={"X-Auth-Token": FOOTBALL_DATA_API_KEY}, timeout=15)
    resp.raise_for_status()
    matches = resp.json().get("matches", [])
    logger.info(f"Retrieved {len(matches)} fixtures from football-data.org.")

    team_history = build_team_match_history(matches)

    now_utc = datetime.now(timezone.utc).isoformat()
    records: List[Dict[str, Any]] = []
    form_deltas: Dict[str, float] = {}

    for m in matches:
        mid = m.get("id")
        raw_h = m.get("homeTeam", {}).get("name", "")
        raw_a = m.get("awayTeam", {}).get("name", "")
        home_team = CANONICAL_TEAMS.get(raw_h, raw_h)
        away_team = CANONICAL_TEAMS.get(raw_a, raw_a)

        if home_team not in profiles or away_team not in profiles:
            logger.warning(f"Skipping match {mid} ({home_team} vs {away_team}): missing tactical profile.")
            continue

        hp = profiles[home_team]
        ap = profiles[away_team]

        match_utc = m.get("utcDate", "")
        form_h = get_recent_form_score(team_history.get(home_team, []), match_utc)
        form_a = get_recent_form_score(team_history.get(away_team, []), match_utc)
        d_form = max(-8.0, min(8.0, form_h - form_a))
        form_deltas[str(mid)] = d_form

        prob_h, prob_d, prob_a, d_tactical, rating_edge, chaos = compute_match_probabilities(
            hp, ap, d_form
        )

        status = m.get("status", "SCHEDULED")
        score = m.get("score", {}).get("fullTime", {})
        home_score = None
        away_score = None

        if status == "FINISHED" and score:
            home_score = score.get("home")
            away_score = score.get("away")

        records.append({
            "id": str(mid),
            "match_id": int(mid),
            "home_team": home_team,
            "away_team": away_team,
            "matchday": int(m.get("matchday", 1)),
            "utc_date": match_utc,
            "status": status,
            "home_score": home_score,
            "away_score": away_score,
            "prob_home": prob_h,
            "prob_draw": prob_d,
            "prob_away": prob_a,
            "tactical_delta": d_tactical,
            "chaos_rating": chaos,
            "home_floor": float(hp["floor"]),
            "home_ceiling": float(hp["ceiling"]),
            "away_floor": float(ap["floor"]),
            "away_ceiling": float(ap["ceiling"]),
            "updated_at": now_utc,
        })

    logger.info(f"Built {len(records)} prediction records.")

    # Batch upsert into Supabase
    print(f"\nUpserting {len(records)} fixtures to Supabase table 'match_predictions_v2'...")
    batch_size = 50
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        supabase.table("match_predictions_v2").upsert(batch, on_conflict="id").execute()

    print(f"Successfully upserted {len(records)} fixtures into 'match_predictions_v2'.")

    # Determine next upcoming matchday
    upcoming_matches = [r for r in records if r["status"] in ("SCHEDULED", "TIMED")]
    upcoming_matches.sort(key=lambda r: (r["matchday"], r["utc_date"]))

    next_matchday = upcoming_matches[0]["matchday"] if upcoming_matches else None

    if next_matchday is not None:
        next_fixtures = [r for r in upcoming_matches if r["matchday"] == next_matchday]

        preview_rows = []
        for f in next_fixtures:
            f_delta = form_deltas.get(f["id"], 0.0)
            preview_rows.append({
                "Matchday": f["matchday"],
                "Fixture": f"{f['home_team']} vs {f['away_team']}",
                "Home Win %": f"{f['prob_home'] * 100:.1f}%",
                "Draw %": f"{f['prob_draw'] * 100:.1f}%",
                "Away Win %": f"{f['prob_away'] * 100:.1f}%",
                "Tactical Delta": f"{f['tactical_delta']:+.2f}",
                "Form Delta": f"{f_delta:+.1f}",
                "Chaos": f"{f['chaos_rating']:.1f}",
            })

        print("\n" + "=" * 90)
        print(f"UPCOMING MATCHDAY {next_matchday} PREDICTIONS & TACTICAL DELTAS")
        print("=" * 90)
        print(pd.DataFrame(preview_rows).to_string(index=False))
        print("=" * 90)
        print("Predictions successfully synced to match_predictions_v2.\n")


def main():
    print("=" * 90)
    print("V2 Tactical Engine - Step 4: Multi-Pillar Match Prediction Engine")
    print("=" * 90)
    sync_predictions_v2()


if __name__ == "__main__":
    main()
