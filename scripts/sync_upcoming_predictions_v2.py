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
# 3. Schedule Synchronization & Multi-Competition Rest History
# ---------------------------------------------------------------------------
def sync_all_fixtures_schedule() -> List[Dict[str, Any]]:
    competitions = ["PL", "CL"]
    all_schedule_records = []
    headers = {"X-Auth-Token": FOOTBALL_DATA_API_KEY}
    now_utc = datetime.now(timezone.utc).isoformat()

    for comp in competitions:
        url = f"https://api.football-data.org/v4/competitions/{comp}/matches"
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200:
                comp_matches = resp.json().get("matches", [])
                comp_name = resp.json().get("competition", {}).get("name", comp)
                for m in comp_matches:
                    mid = m.get("id")
                    raw_h = m.get("homeTeam", {}).get("name", "")
                    raw_a = m.get("awayTeam", {}).get("name", "")
                    h_team = CANONICAL_TEAMS.get(raw_h, raw_h)
                    a_team = CANONICAL_TEAMS.get(raw_a, raw_a)
                    status = m.get("status", "SCHEDULED")
                    score = m.get("score", {}).get("fullTime", {})
                    h_score = score.get("home") if status == "FINISHED" else None
                    a_score = score.get("away") if status == "FINISHED" else None

                    all_schedule_records.append({
                        "id": f"{comp}_{mid}",
                        "competition_code": comp,
                        "competition_name": comp_name,
                        "match_id": int(mid),
                        "matchday": int(m.get("matchday", 1) or 1),
                        "home_team": h_team,
                        "away_team": a_team,
                        "utc_date": m.get("utcDate", ""),
                        "status": status,
                        "home_score": h_score,
                        "away_score": a_score,
                        "updated_at": now_utc,
                    })
            else:
                logger.warning(f"Failed to fetch {comp}: HTTP {resp.status_code}")
        except Exception as e:
            logger.error(f"Error fetching competition {comp}: {e}")

    if all_schedule_records:
        logger.info(f"Upserting {len(all_schedule_records)} matches to 'all_fixtures_schedule'...")
        # Prepare records for Supabase table (which does not have matchday column)
        db_records = [
            {
                "id": r["id"],
                "competition_code": r["competition_code"],
                "competition_name": r["competition_name"],
                "match_id": r["match_id"],
                "home_team": r["home_team"],
                "away_team": r["away_team"],
                "utc_date": r["utc_date"],
                "status": r["status"],
                "home_score": r["home_score"],
                "away_score": r["away_score"],
                "updated_at": r["updated_at"],
            }
            for r in all_schedule_records
        ]
        batch_size = 100
        for i in range(0, len(db_records), batch_size):
            supabase.table("all_fixtures_schedule").upsert(
                db_records[i : i + batch_size], on_conflict="id"
            ).execute()
        logger.info("Successfully updated 'all_fixtures_schedule'.")

    return all_schedule_records


def build_all_competition_match_history(
    schedule_records: List[Dict[str, Any]]
) -> Dict[str, List[Dict[str, Any]]]:
    history: Dict[str, List[Dict[str, Any]]] = {}
    finished = [
        r for r in schedule_records if r["status"] == "FINISHED" and r["utc_date"]
    ]
    finished.sort(key=lambda x: x["utc_date"])
    for r in finished:
        history.setdefault(r["home_team"], []).append({"utc_date": r["utc_date"]})
        history.setdefault(r["away_team"], []).append({"utc_date": r["utc_date"]})
    return history


def build_team_match_history(pl_matches: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    history: Dict[str, List[Dict[str, Any]]] = {}
    finished = []
    for m in pl_matches:
        if m.get("status") != "FINISHED":
            continue
        if "home_score" in m and m.get("home_score") is not None:
            finished.append({
                "home_team": m["home_team"],
                "away_team": m["away_team"],
                "utc_date": m.get("utc_date", ""),
                "home_score": m["home_score"],
                "away_score": m["away_score"],
            })
        elif "score" in m:
            score = m.get("score", {}).get("fullTime", {})
            h_score = score.get("home")
            a_score = score.get("away")
            if h_score is not None and a_score is not None:
                raw_h = m.get("homeTeam", {}).get("name", "")
                raw_a = m.get("awayTeam", {}).get("name", "")
                finished.append({
                    "home_team": CANONICAL_TEAMS.get(raw_h, raw_h),
                    "away_team": CANONICAL_TEAMS.get(raw_a, raw_a),
                    "utc_date": m.get("utcDate", ""),
                    "home_score": h_score,
                    "away_score": a_score,
                })

    finished.sort(key=lambda x: x["utc_date"])

    for m in finished:
        h_team = m["home_team"]
        a_team = m["away_team"]
        utc = m["utc_date"]
        h_goals = m["home_score"]
        a_goals = m["away_score"]

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


def calculate_rest_days(history: List[Dict[str, Any]], target_utc_date: str) -> float:
    prior_matches = [m for m in history if m["utc_date"] < target_utc_date]
    if not prior_matches:
        return 7.0

    try:
        t_target = datetime.fromisoformat(target_utc_date.replace("Z", "+00:00"))
        t_last = datetime.fromisoformat(prior_matches[-1]["utc_date"].replace("Z", "+00:00"))
        diff_days = (t_target - t_last).total_seconds() / 86400.0
        if diff_days > 21.0:
            return 7.0
        return max(0.0, diff_days)
    except Exception:
        return 7.0


def compute_fatigue_penalty(days_rest: float) -> float:
    if days_rest >= 5.0:
        return 0.0
    elif days_rest >= 3.5:
        return -1.0
    elif days_rest >= 2.5:
        return -2.5
    else:
        return -4.0


def compute_match_probabilities(
    hp: Dict[str, Any],
    ap: Dict[str, Any],
    d_form: float = 0.0,
    d_rest: float = 0.0,
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

    # C. Home Advantage & Combined Rating Edge (incorporating form and rest modifiers)
    rating_edge_h = d_quality + 0.50 * d_tactical + 8.0 + d_form + d_rest

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

    prob_h = exp_h / denom
    prob_d = exp_d / denom
    prob_a = exp_a / denom

    # E. Soft Favourite Taper (Diminishing Returns Above 78.0%)
    CAP_THRESHOLD = 0.78

    if prob_h > CAP_THRESHOLD:
        excess = prob_h - CAP_THRESHOLD
        prob_h = CAP_THRESHOLD + 0.45 * excess
        prob_d = prob_d + 0.40 * excess
        prob_a = prob_a + 0.15 * excess
    elif prob_a > CAP_THRESHOLD:
        excess = prob_a - CAP_THRESHOLD
        prob_a = CAP_THRESHOLD + 0.45 * excess
        prob_d = prob_d + 0.40 * excess
        prob_h = prob_h + 0.15 * excess

    # Round to 4 decimal places after redistribution
    prob_h = round(prob_h, 4)
    prob_d = round(prob_d, 4)
    prob_a = round(prob_a, 4)

    return prob_h, prob_d, prob_a, round(d_tactical, 2), round(rating_edge_h, 2), round(chaos, 2)


# ---------------------------------------------------------------------------
# 4. Pipeline Execution
# ---------------------------------------------------------------------------
def validate_prediction_probabilities(batch: List[Dict[str, Any]]):
    """
    Strict assertion ensuring no batch ever contains None, null, or NaN
    for prob_home, prob_draw, or prob_away before upserting into Supabase.
    """
    for r in batch:
        for key in ("prob_home", "prob_draw", "prob_away"):
            val = r.get(key)
            if val is None or not isinstance(val, (int, float)) or math.isnan(val):
                raise ValueError(
                    f"CRITICAL: Record {r.get('id')} ({r.get('home_team')} vs {r.get('away_team')}) "
                    f"has invalid/null {key}={val}. Aborting upsert to protect database integrity."
                )


def lock_finished_matches_v2():
    """
    Step 1 of pipeline:
    Checks match results from Football-Data API and locks finished or live matches
    in `match_predictions_v2`.
    Updates scores and status without recalculating or modifying pre-match probabilities.
    Ensures prob_home, prob_draw, and prob_away are never None or null.
    """
    logger.info("Syncing fixture schedule and locking finished match results...")
    pl_cl_records = sync_all_fixtures_schedule()
    pl_matches = [r for r in pl_cl_records if r.get("competition_code") == "PL"]

    logger.info("Fetching existing records from 'match_predictions_v2' to preserve pre-match predictions...")
    pred_res = supabase.table("match_predictions_v2").select("*").limit(2000).execute()
    existing_preds: Dict[str, Dict[str, Any]] = {
        str(r["id"]): r for r in (pred_res.data or [])
    }

    # Optional profile fallback for brand new matches that were already finished
    profiles = {}
    try:
        p_res = supabase.table("team_tactical_profiles_v2").select("*").execute()
        if p_res.data:
            profiles = {r["team"]: r for r in p_res.data}
    except Exception as e:
        logger.warning(f"Could not load tactical profiles for finished-matches fallback: {e}")

    now_utc = datetime.now(timezone.utc).isoformat()
    locked_records: List[Dict[str, Any]] = []

    for m in pl_matches:
        mid_str = str(m.get("match_id"))
        status = m.get("status", "SCHEDULED")
        home_score = m.get("home_score")
        away_score = m.get("away_score")

        is_finished = status in ("FINISHED", "AWARDED") or home_score is not None
        if not is_finished:
            continue

        home_team = m.get("home_team", "")
        away_team = m.get("away_team", "")

        if mid_str in existing_preds:
            prev = existing_preds[mid_str]
            p_h = prev.get("prob_home")
            p_d = prev.get("prob_draw")
            p_a = prev.get("prob_away")

            # Fallback if previous DB row somehow had null/NaN
            p_h = 0.36 if p_h is None or math.isnan(p_h) else float(p_h)
            p_d = 0.28 if p_d is None or math.isnan(p_d) else float(p_d)
            p_a = 0.36 if p_a is None or math.isnan(p_a) else float(p_a)

            record = {
                "id": mid_str,
                "match_id": int(mid_str),
                "home_team": prev.get("home_team", home_team),
                "away_team": prev.get("away_team", away_team),
                "matchday": int(prev.get("matchday", m.get("matchday", 1))),
                "utc_date": prev.get("utc_date", m.get("utc_date", "")),
                "status": status,
                "home_score": home_score,
                "away_score": away_score,
                "prob_home": round(p_h, 4),
                "prob_draw": round(p_d, 4),
                "prob_away": round(p_a, 4),
                "tactical_delta": prev.get("tactical_delta", 0.0),
                "chaos_rating": prev.get("chaos_rating", 50.0),
                "home_floor": prev.get("home_floor", 50.0),
                "home_ceiling": prev.get("home_ceiling", 50.0),
                "away_floor": prev.get("away_floor", 50.0),
                "away_ceiling": prev.get("away_ceiling", 50.0),
                "updated_at": now_utc,
            }
        else:
            # Match never had a record in match_predictions_v2 before: compute baseline
            hp = profiles.get(home_team, {"floor": 50.0, "ceiling": 50.0, "chaos_index": 50.0})
            ap = profiles.get(away_team, {"floor": 50.0, "ceiling": 50.0, "chaos_index": 50.0})
            record = {
                "id": mid_str,
                "match_id": int(mid_str),
                "home_team": home_team,
                "away_team": away_team,
                "matchday": int(m.get("matchday", 1)),
                "utc_date": m.get("utc_date", ""),
                "status": status,
                "home_score": home_score,
                "away_score": away_score,
                "prob_home": 0.36,
                "prob_draw": 0.28,
                "prob_away": 0.36,
                "tactical_delta": 0.0,
                "chaos_rating": 50.0,
                "home_floor": float(hp.get("floor", 50.0)),
                "home_ceiling": float(hp.get("ceiling", 50.0)),
                "away_floor": float(ap.get("floor", 50.0)),
                "away_ceiling": float(ap.get("ceiling", 50.0)),
                "updated_at": now_utc,
            }

        locked_records.append(record)

    if locked_records:
        logger.info(f"Upserting {len(locked_records)} locked finished matches to 'match_predictions_v2'...")
        batch_size = 50
        for i in range(0, len(locked_records), batch_size):
            batch = locked_records[i : i + batch_size]
            validate_prediction_probabilities(batch)
            supabase.table("match_predictions_v2").upsert(batch, on_conflict="id").execute()
        logger.info(f"Successfully locked and updated {len(locked_records)} finished matches.")
    else:
        logger.info("No finished matches required locking.")


def sync_predictions_v2(sync_cups: bool = False, sync_stats: bool = False):
    if sync_cups:
        try:
            try:
                from scripts.sync_cups_and_europe import sync_cups_and_europe
            except ImportError:
                from sync_cups_and_europe import sync_cups_and_europe
            logger.info("Invoking cup and European fixture sync...")
            sync_cups_and_europe()
        except Exception as e:
            logger.warning(f"Optional cup sync failed: {e}")

    if sync_stats or sync_cups:
        try:
            try:
                from scripts.sync_match_raw_stats import sync_match_raw_stats
            except ImportError:
                from sync_match_raw_stats import sync_match_raw_stats
            logger.info("Invoking per-match raw stats sync...")
            sync_match_raw_stats()
        except Exception as e:
            logger.warning(f"Optional raw stats sync failed: {e}")

    logger.info("Syncing Premier League & Champions League fixtures...")
    pl_cl_records = sync_all_fixtures_schedule()

    logger.info("Loading complete multi-competition schedule from 'all_fixtures_schedule'...")
    sched_res = supabase.table("all_fixtures_schedule").select("*").execute()
    all_schedule = sched_res.data if sched_res.data else pl_cl_records
    rest_history = build_all_competition_match_history(all_schedule)

    pl_matches = [r for r in pl_cl_records if r.get("competition_code") == "PL"]
    team_history = build_team_match_history(pl_matches)

    logger.info("Loading existing predictions from 'match_predictions_v2' to protect locked matches...")
    pred_res = supabase.table("match_predictions_v2").select("*").limit(2000).execute()
    existing_preds: Dict[str, Dict[str, Any]] = {
        str(r["id"]): r for r in (pred_res.data or [])
    }

    logger.info("Loading V2 tactical profiles from Supabase 'team_tactical_profiles_v2'...")
    p_res = supabase.table("team_tactical_profiles_v2").select("*").execute()
    if not p_res.data:
        raise ValueError("No records found in 'team_tactical_profiles_v2'. Run compute_tactical_profiles_v2.py first.")

    profiles = {r["team"]: r for r in p_res.data}
    logger.info(f"Loaded {len(profiles)} tactical profiles.")

    now_utc = datetime.now(timezone.utc).isoformat()
    records: List[Dict[str, Any]] = []
    form_deltas: Dict[str, float] = {}
    rest_deltas: Dict[str, float] = {}

    locked_count = 0
    updated_count = 0

    for m in pl_matches:
        mid = m.get("match_id")
        mid_str = str(mid)
        home_team = m.get("home_team", "")
        away_team = m.get("away_team", "")

        if home_team not in profiles or away_team not in profiles:
            logger.warning(f"Skipping match {mid} ({home_team} vs {away_team}): missing tactical profile.")
            continue

        hp = profiles[home_team]
        ap = profiles[away_team]

        match_utc = m.get("utc_date", "")
        status = m.get("status", "SCHEDULED")
        home_score = m.get("home_score")
        away_score = m.get("away_score")

        # A match is locked once it has kicked off (IN_PLAY, PAUSED, FINISHED, AWARDED) or has a score
        is_locked = status in ("FINISHED", "AWARDED", "IN_PLAY", "PAUSED") or home_score is not None

        if is_locked and mid_str in existing_preds:
            # PRESERVE FROZEN PRE-MATCH PREDICTION
            prev = existing_preds[mid_str]
            prev_ph = prev.get("prob_home")
            prev_pd = prev.get("prob_draw")
            prev_pa = prev.get("prob_away")

            # Fallback only if previous DB value was somehow null or NaN
            if prev_ph is not None and prev_pd is not None and prev_pa is not None and not (
                math.isnan(prev_ph) or math.isnan(prev_pd) or math.isnan(prev_pa)
            ):
                prob_h = float(prev_ph)
                prob_d = float(prev_pd)
                prob_a = float(prev_pa)
                d_tactical = prev.get("tactical_delta", 0.0)
                chaos = prev.get("chaos_rating", 50.0)
                h_floor = prev.get("home_floor", float(hp["floor"]))
                h_ceiling = prev.get("home_ceiling", float(hp["ceiling"]))
                a_floor = prev.get("away_floor", float(ap["floor"]))
                a_ceiling = prev.get("away_ceiling", float(ap["ceiling"]))
            else:
                form_h = get_recent_form_score(team_history.get(home_team, []), match_utc)
                form_a = get_recent_form_score(team_history.get(away_team, []), match_utc)
                d_form = max(-8.0, min(8.0, form_h - form_a))
                rest_h = calculate_rest_days(rest_history.get(home_team, []), match_utc)
                rest_a = calculate_rest_days(rest_history.get(away_team, []), match_utc)
                fatigue_h = compute_fatigue_penalty(rest_h)
                fatigue_a = compute_fatigue_penalty(rest_a)
                d_rest = max(-5.0, min(5.0, fatigue_h - fatigue_a))
                prob_h, prob_d, prob_a, d_tactical, rating_edge, chaos = compute_match_probabilities(
                    hp, ap, d_form, d_rest
                )
                h_floor = float(hp["floor"])
                h_ceiling = float(hp["ceiling"])
                a_floor = float(ap["floor"])
                a_ceiling = float(ap["ceiling"])
            locked_count += 1
        else:
            # UPCOMING FIXTURE (OR NEW FIXTURE): Calculate fresh predictions from tactical profiles
            form_h = get_recent_form_score(team_history.get(home_team, []), match_utc)
            form_a = get_recent_form_score(team_history.get(away_team, []), match_utc)
            d_form = max(-8.0, min(8.0, form_h - form_a))
            form_deltas[mid_str] = d_form

            rest_h = calculate_rest_days(rest_history.get(home_team, []), match_utc)
            rest_a = calculate_rest_days(rest_history.get(away_team, []), match_utc)
            fatigue_h = compute_fatigue_penalty(rest_h)
            fatigue_a = compute_fatigue_penalty(rest_a)
            d_rest = max(-5.0, min(5.0, fatigue_h - fatigue_a))
            rest_deltas[mid_str] = d_rest

            prob_h, prob_d, prob_a, d_tactical, rating_edge, chaos = compute_match_probabilities(
                hp, ap, d_form, d_rest
            )
            h_floor = float(hp["floor"])
            h_ceiling = float(hp["ceiling"])
            a_floor = float(ap["floor"])
            a_ceiling = float(ap["ceiling"])
            updated_count += 1

        # Absolute protection against None / null / NaN
        if prob_h is None or math.isnan(prob_h):
            prob_h = 0.36
        if prob_d is None or math.isnan(prob_d):
            prob_d = 0.28
        if prob_a is None or math.isnan(prob_a):
            prob_a = 0.36

        # Normalization safeguard
        prob_sum = prob_h + prob_d + prob_a
        if abs(prob_sum - 1.0) > 0.01 and prob_sum > 0:
            prob_h = round(prob_h / prob_sum, 4)
            prob_d = round(prob_d / prob_sum, 4)
            prob_a = round(prob_a / prob_sum, 4)

        records.append({
            "id": mid_str,
            "match_id": int(mid),
            "home_team": home_team,
            "away_team": away_team,
            "matchday": int(m.get("matchday", 1)),
            "utc_date": match_utc,
            "status": status,
            "home_score": home_score,
            "away_score": away_score,
            "prob_home": float(round(prob_h, 4)),
            "prob_draw": float(round(prob_d, 4)),
            "prob_away": float(round(prob_a, 4)),
            "tactical_delta": float(d_tactical) if d_tactical is not None else 0.0,
            "chaos_rating": float(chaos) if chaos is not None else 50.0,
            "home_floor": float(h_floor),
            "home_ceiling": float(h_ceiling),
            "away_floor": float(a_floor),
            "away_ceiling": float(a_ceiling),
            "updated_at": now_utc,
        })

    logger.info(
        f"Built {len(records)} prediction records "
        f"({locked_count} locked historical/live, {updated_count} recalculated upcoming)."
    )

    # Batch upsert into Supabase with strict non-null probability validation
    print(f"\nUpserting {len(records)} fixtures to Supabase table 'match_predictions_v2'...")
    batch_size = 50
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        validate_prediction_probabilities(batch)
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
            r_delta = rest_deltas.get(f["id"], 0.0)
            preview_rows.append({
                "Matchday": f["matchday"],
                "Fixture": f"{f['home_team']} vs {f['away_team']}",
                "Home Win %": f"{f['prob_home'] * 100:.1f}%",
                "Draw %": f"{f['prob_draw'] * 100:.1f}%",
                "Away Win %": f"{f['prob_away'] * 100:.1f}%",
                "Tactical Delta": f"{f['tactical_delta']:+.2f}",
                "Form Delta": f"{f_delta:+.1f}",
                "Rest Delta": f"{r_delta:+.1f}",
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
    if "--lock-finished" in sys.argv or "--lock-results" in sys.argv:
        lock_finished_matches_v2()
        return

    sync_cups = "--sync-cups" in sys.argv
    sync_stats = "--sync-stats" in sys.argv
    sync_predictions_v2(sync_cups=sync_cups, sync_stats=sync_stats)


if __name__ == "__main__":
    main()
