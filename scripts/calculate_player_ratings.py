"""
scripts/calculate_player_ratings.py

Calculates FM 1-100 attributes, radar polygon vertices, and role-weighted overall ratings
for Premier League players from `dev.player_season_aggregates` for season 2026/2027,
and persists them into `dev.player_ratings`.
"""

import os
import sys
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import numpy as np
import pandas as pd
import dotenv
from supabase import create_client, Client

# Ensure UTF-8 console output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("calculate_player_ratings")

# ---------------------------------------------------------------------------
# 1. Environment & Database Setup
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
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
SEASON = "2026/2027"
MIN_MINUTES_THRESHOLD = 270

STAT_KEYS = [
    "speed",
    "acceleration",
    "strength",
    "jumping",
    "stamina",
    "touch",
    "vision",
    "positioning",
    "short_passing",
    "long_passing",
    "shots",
    "long_shots",
    "crossing",
    "heading",
    "tackling",
    "defensive_positioning",
]


# ---------------------------------------------------------------------------
# 2. Calibration Function (Percentile -> FM Rating)
# ---------------------------------------------------------------------------
def to_fm_rating(percentile: float) -> int:
    """
    Transforms cohort percentile (0.0 <= p <= 1.0) into an authentic FM 1-100 distribution:
    - 50th percentile maps to ~64
    - 99th percentile hits 95-98
    - Low end bottoms around 25-30
    """
    val = round(30 + (percentile * 67))
    return max(15, min(99, int(val)))


def calculate_cohort_percentiles(values: np.ndarray) -> np.ndarray:
    """
    Computes percentiles in [0.0, 1.0] for an array of metric values within a cohort.
    Uses positional percentile ranking (rank / cohort_size) with ties averaged.
    """
    n = len(values)
    if n == 0:
        return np.array([], dtype=float)
    if n == 1:
        return np.array([0.5], dtype=float)
    
    s = pd.Series(values)
    # rank with method='average' gives 1.0 to N; dividing by N gives (0, 1.0]
    return (s.rank(method="average", ascending=True) / n).to_numpy()


# ---------------------------------------------------------------------------
# 3. Data Fetching Helpers
# ---------------------------------------------------------------------------
def fetch_all_aggregates(season: str) -> List[Dict[str, Any]]:
    """Fetches all player_season_aggregates for the target season with pagination."""
    all_data = []
    page_size = 1000
    start = 0
    while True:
        res = (
            supabase.schema("dev")
            .table("player_season_aggregates")
            .select("*")
            .eq("season", season)
            .range(start, start + page_size - 1)
            .execute()
        )
        if not res.data:
            break
        all_data.extend(res.data)
        if len(res.data) < page_size:
            break
        start += page_size
    logger.info(f"Fetched {len(all_data)} season aggregate records for {season}.")
    return all_data


def fetch_all_players() -> Dict[str, Dict[str, Any]]:
    """Fetches master players registry with pagination."""
    all_players = {}
    page_size = 1000
    start = 0
    while True:
        res = (
            supabase.schema("dev")
            .table("players")
            .select("id, web_name, full_name, primary_position")
            .range(start, start + page_size - 1)
            .execute()
        )
        if not res.data:
            break
        for p in res.data:
            all_players[p["id"]] = p
        if len(res.data) < page_size:
            break
        start += page_size
    logger.info(f"Fetched {len(all_players)} players from master registry.")
    return all_players


# ---------------------------------------------------------------------------
# 4. Proxy & Raw Metric Calculation
# ---------------------------------------------------------------------------
def compute_raw_metrics(row: pd.Series) -> pd.Series:
    """Computes proxy metrics and unnormalized raw indicators for attribute evaluation."""
    pos = row.get("primary_position") or "MID"
    mins = float(row.get("minutes_played") or 0)
    matches = float(row.get("matches_played") or 0)
    nineties = max(0.1, mins / 90.0)

    # 1. Missing Column Proxies
    shots_total = float(row.get("shots_total") or 0)
    touches_in_box = float(row.get("touches_in_box") or 0)
    shots_outside_box_proxy = max(0.0, shots_total - round(touches_in_box * 0.45))

    xa = float(row.get("xa") or 0.0)
    key_passes = float(row.get("key_passes") or 0)
    through_balls_proxy = (xa * 0.5) + (key_passes * 0.25)

    clearances = float(row.get("clearances") or 0)
    aerial_factor_proxy = clearances * (1.2 if pos in ["DEF", "FWD"] else 0.6)

    take_ons_won = float(row.get("take_ons_won") or 0)
    take_on_success_pct = float(row.get("take_on_success_pct") or 0.0)
    take_ons_attempted = row.get("take_ons_attempted")
    if take_ons_attempted is None or pd.isna(take_ons_attempted):
        if take_on_success_pct > 0:
            take_ons_attempted = round(take_ons_won / (take_on_success_pct / 100.0))
        else:
            take_ons_attempted = take_ons_won
    else:
        take_ons_attempted = float(take_ons_attempted)
    dispossessed_proxy = max(0.0, take_ons_attempted - take_ons_won)

    # Additional metrics & rates
    prog_carries_p90 = float(row.get("progressive_carries_per_90") or 0.0)
    ground_duel_win_pct = float(row.get("ground_duel_win_pct") or 0.0)
    stamina_raw = mins / matches if matches > 0 else 0.0
    key_passes_p90 = float(row.get("key_passes_per_90") or 0.0)
    pass_completion_pct = float(row.get("pass_completion_pct") or 0.0)

    passes_completed_long = row.get("passes_completed_long")
    if passes_completed_long is not None and not pd.isna(passes_completed_long):
        long_pass_raw = float(passes_completed_long)
    else:
        passes_completed = float(row.get("passes_completed") or 0.0)
        long_pass_raw = passes_completed * (pass_completion_pct / 100.0)

    shots_p90 = float(row.get("shots_per_90") or 0.0)
    shot_accuracy_pct = float(row.get("shot_accuracy_pct") or 0.0)
    crosses_completed = float(row.get("crosses_completed") or 0.0)
    tackles_p90 = float(row.get("tackles_per_90") or 0.0)
    tackle_success_pct = float(row.get("tackle_success_pct") or 0.0)
    interceptions_p90 = float(row.get("interceptions_per_90") or 0.0)
    blocks = float(row.get("blocks") or 0.0)
    interceptions = float(row.get("interceptions") or 0.0)

    # Physical Attributes
    # stat_speed: progressive_carries_per_90
    raw_speed = prog_carries_p90
    # stat_acceleration: take_ons_won / (minutes_played / 90.0)
    raw_acceleration = take_ons_won / nineties
    # stat_strength: ground_duel_win_pct
    raw_strength = ground_duel_win_pct
    # stat_jumping: aerial_factor_proxy / (minutes_played / 90.0)
    raw_jumping = aerial_factor_proxy / nineties
    # stat_stamina: minutes_played / matches_played
    raw_stamina = stamina_raw

    # Technical & Tactical Attributes
    # stat_touch: take_on_success_pct - (dispossessed_proxy / (minutes_played / 90.0) * 5.0)
    raw_touch = take_on_success_pct - ((dispossessed_proxy / nineties) * 5.0)
    # stat_vision: (xa / (minutes_played / 90.0)) * 0.6 + (key_passes_per_90 * 0.4)
    raw_vision = (xa / nineties) * 0.6 + (key_passes_p90 * 0.4)
    # stat_positioning: touches_in_box / 90 (FWD/MID) or (interceptions + clearances) / 90 (DEF/GKP)
    if pos in ["FWD", "MID"]:
        raw_positioning = touches_in_box / nineties
    else:
        raw_positioning = (interceptions + clearances) / nineties
    # stat_short_passing: pass_completion_pct
    raw_short_passing = pass_completion_pct
    # stat_long_passing: passes_completed_long (fallback: passes_completed * pass_completion_pct)
    raw_long_passing = long_pass_raw
    # stat_shots: (shots_per_90 * 0.5) + (shot_accuracy_pct * 0.5)
    raw_shots = (shots_p90 * 0.5) + (shot_accuracy_pct * 0.5)
    # stat_long_shots: shots_outside_box_proxy / (minutes_played / 90.0)
    raw_long_shots = shots_outside_box_proxy / nineties
    # stat_crossing: crosses_completed / (minutes_played / 90.0)
    raw_crossing = crosses_completed / nineties
    # stat_heading: aerial_factor_proxy
    raw_heading = aerial_factor_proxy
    # stat_tackling: (tackles_per_90 * 0.6) + (tackle_success_pct * 0.4)
    raw_tackling = (tackles_p90 * 0.6) + (tackle_success_pct * 0.4)
    # stat_defensive_positioning: (interceptions_per_90 * 0.6) + (blocks + clearances) / 90 * 0.4
    raw_defensive_positioning = (interceptions_p90 * 0.6) + (((blocks + clearances) / nineties) * 0.4)

    return pd.Series({
        "raw_speed": raw_speed,
        "raw_acceleration": raw_acceleration,
        "raw_strength": raw_strength,
        "raw_jumping": raw_jumping,
        "raw_stamina": raw_stamina,
        "raw_touch": raw_touch,
        "raw_vision": raw_vision,
        "raw_positioning": raw_positioning,
        "raw_short_passing": raw_short_passing,
        "raw_long_passing": raw_long_passing,
        "raw_shots": raw_shots,
        "raw_long_shots": raw_long_shots,
        "raw_crossing": raw_crossing,
        "raw_heading": raw_heading,
        "raw_tackling": raw_tackling,
        "raw_defensive_positioning": raw_defensive_positioning,
    })


# ---------------------------------------------------------------------------
# 5. Radar & Role-Weighted Overall Calculation
# ---------------------------------------------------------------------------
def compute_radar_and_overall(row: pd.Series) -> pd.Series:
    """Computes the 6 macro radar polygon vertices and role-weighted overall rating."""
    mins = float(row.get("minutes_played") or 0)
    if mins < MIN_MINUTES_THRESHOLD:
        return pd.Series({
            "radar_shooting": 50,
            "radar_passing": 50,
            "radar_dribbling": 50,
            "radar_defending": 50,
            "radar_physical": 50,
            "radar_aerial": 50,
            "overall_rating": 50,
        })

    s_shots = int(row["stat_shots"])
    s_lshots = int(row["stat_long_shots"])
    s_spass = int(row["stat_short_passing"])
    s_lpass = int(row["stat_long_passing"])
    s_vis = int(row["stat_vision"])
    s_touch = int(row["stat_touch"])
    s_acc = int(row["stat_acceleration"])
    s_tack = int(row["stat_tackling"])
    s_defpos = int(row["stat_defensive_positioning"])
    s_spd = int(row["stat_speed"])
    s_str = int(row["stat_strength"])
    s_stam = int(row["stat_stamina"])
    s_jmp = int(row["stat_jumping"])
    s_head = int(row["stat_heading"])
    s_pos = int(row["stat_positioning"])

    # Macro Radar Vertices (0-100)
    r_shooting = round((s_shots * 0.6) + (s_lshots * 0.4))
    r_passing = round((s_spass * 0.4) + (s_lpass * 0.3) + (s_vis * 0.3))
    r_dribbling = round((s_touch * 0.5) + (s_acc * 0.5))
    r_defending = round((s_tack * 0.5) + (s_defpos * 0.5))
    r_physical = round((s_spd * 0.4) + (s_str * 0.3) + (s_stam * 0.3))
    r_aerial = round((s_jmp * 0.5) + (s_head * 0.5))

    # Role-Weighted Overall Rating
    pos = row.get("primary_position") or "MID"
    if pos == "FWD":
        ovr = round(
            s_shots * 0.22
            + s_spd * 0.15
            + s_acc * 0.15
            + s_pos * 0.15
            + s_touch * 0.10
            + s_str * 0.08
            + s_head * 0.08
            + s_vis * 0.07
        )
    elif pos == "MID":
        ovr = round(
            s_vis * 0.20
            + s_spass * 0.18
            + s_touch * 0.14
            + s_stam * 0.12
            + s_lpass * 0.10
            + s_defpos * 0.10
            + s_tack * 0.08
            + s_shots * 0.08
        )
    elif pos == "DEF":
        ovr = round(
            s_tack * 0.22
            + s_defpos * 0.22
            + s_str * 0.14
            + s_head * 0.14
            + s_spass * 0.10
            + s_stam * 0.10
            + s_spd * 0.08
        )
    elif pos == "GKP":
        ovr = round(
            s_defpos * 0.35
            + s_spass * 0.25
            + s_lpass * 0.20
            + s_touch * 0.10
            + s_str * 0.10
        )
    else:
        ovr = 50

    return pd.Series({
        "radar_shooting": max(0, min(100, int(r_shooting))),
        "radar_passing": max(0, min(100, int(r_passing))),
        "radar_dribbling": max(0, min(100, int(r_dribbling))),
        "radar_defending": max(0, min(100, int(r_defending))),
        "radar_physical": max(0, min(100, int(r_physical))),
        "radar_aerial": max(0, min(100, int(r_aerial))),
        "overall_rating": max(15, min(99, int(ovr))),
    })


# ---------------------------------------------------------------------------
# 6. Main Pipeline Execution
# ---------------------------------------------------------------------------
def run_player_ratings_pipeline() -> pd.DataFrame:
    """Executes full ingestion, calibration, upsert, and returns processed dataframe."""
    logger.info(f"Starting player ratings calculation for season {SEASON}...")

    # Step 1: Ingestion & Joins
    aggregates = fetch_all_aggregates(SEASON)
    if not aggregates:
        raise ValueError(f"No records found in dev.player_season_aggregates for {SEASON}")

    players = fetch_all_players()

    records = []
    for agg in aggregates:
        pid = agg["player_id"]
        player_info = players.get(pid)
        if not player_info:
            logger.warning(f"Player ID {pid} not found in dev.players master registry; skipping.")
            continue
        row = dict(agg)
        row["web_name"] = player_info.get("web_name", "")
        row["full_name"] = player_info.get("full_name", "")
        row["primary_position"] = player_info.get("primary_position", "MID")
        records.append(row)

    df = pd.DataFrame(records)
    logger.info(f"Total matched player season records: {len(df)}")

    # Step 2: Compute raw metrics & proxies
    raw_metrics_df = df.apply(compute_raw_metrics, axis=1)
    df = pd.concat([df, raw_metrics_df], axis=1)

    # Step 3: Initialize stat ratings with baseline 50
    for k in STAT_KEYS:
        df[f"stat_{k}"] = 50

    # Step 4: Cohort ranking for qualified players (minutes_played >= 270)
    cohorts = ["GKP", "DEF", "MID", "FWD"]
    for cohort in cohorts:
        mask = (df["primary_position"] == cohort) & (df["minutes_played"] >= MIN_MINUTES_THRESHOLD)
        sub = df[mask]
        n = len(sub)
        logger.info(f"Cohort '{cohort}': {n} qualified players (>= {MIN_MINUTES_THRESHOLD} mins)")
        if n == 0:
            continue
        for k in STAT_KEYS:
            raw_vals = sub[f"raw_{k}"].to_numpy()
            pcts = calculate_cohort_percentiles(raw_vals)
            fm_ratings = [to_fm_rating(p) for p in pcts]
            df.loc[mask, f"stat_{k}"] = fm_ratings

    # Step 5: Radar & Overall
    radar_ovr_df = df.apply(compute_radar_and_overall, axis=1)
    df = pd.concat([df, radar_ovr_df], axis=1)

    # Step 6: Prepare upsert records for dev.player_ratings
    now_iso = datetime.now(timezone.utc).isoformat()
    upsert_rows = []
    for _, row in df.iterrows():
        mins = int(row.get("minutes_played") or 0)
        pos = row.get("primary_position") or "MID"
        payload = {
            "player_id": row["player_id"],
            "season": SEASON,
            "sample_minutes": mins,
            "cohort_position": pos,
            "overall_rating": int(row["overall_rating"]),
            "stat_speed": int(row["stat_speed"]),
            "stat_strength": int(row["stat_strength"]),
            "stat_jumping": int(row["stat_jumping"]),
            "stat_acceleration": int(row["stat_acceleration"]),
            "stat_stamina": int(row["stat_stamina"]),
            "stat_touch": int(row["stat_touch"]),
            "stat_vision": int(row["stat_vision"]),
            "stat_positioning": int(row["stat_positioning"]),
            "stat_short_passing": int(row["stat_short_passing"]),
            "stat_long_passing": int(row["stat_long_passing"]),
            "stat_shots": int(row["stat_shots"]),
            "stat_long_shots": int(row["stat_long_shots"]),
            "stat_crossing": int(row["stat_crossing"]),
            "stat_heading": int(row["stat_heading"]),
            "stat_tackling": int(row["stat_tackling"]),
            "stat_defensive_positioning": int(row["stat_defensive_positioning"]),
            "radar_shooting": int(row["radar_shooting"]),
            "radar_passing": int(row["radar_passing"]),
            "radar_dribbling": int(row["radar_dribbling"]),
            "radar_defending": int(row["radar_defending"]),
            "radar_physical": int(row["radar_physical"]),
            "radar_aerial": int(row["radar_aerial"]),
            "updated_at": now_iso,
        }
        upsert_rows.append(payload)

    # Step 7: Batch upsert into dev.player_ratings
    logger.info(f"Upserting {len(upsert_rows)} records into dev.player_ratings on conflict (player_id, season)...")
    batch_size = 100
    for i in range(0, len(upsert_rows), batch_size):
        batch = upsert_rows[i : i + batch_size]
        res = (
            supabase.schema("dev")
            .table("player_ratings")
            .upsert(batch, on_conflict="player_id,season")
            .execute()
        )
        logger.info(f"Upserted batch {i // batch_size + 1}/{(len(upsert_rows) + batch_size - 1) // batch_size} ({len(batch)} rows).")

    logger.info("Successfully populated dev.player_ratings!")
    return df


def print_spotlight_summary(df: pd.DataFrame) -> None:
    """Prints a formatted markdown summary table for the 5 target spotlight players."""
    spotlight_names = [
        ("Erling Haaland", "Haaland"),
        ("Bruno Borges Fernandes", "B.Fernandes"),
        ("Martin", "Ødegaard"),
        ("Bukayo Saka", "Saka"),
        ("Declan Rice", "Rice"),
    ]

    selected_rows = []
    for full_sub, web_sub in spotlight_names:
        match = df[
            df["full_name"].str.contains(full_sub, case=False, na=False)
            | df["web_name"].str.contains(web_sub, case=False, na=False)
        ]
        # Filter exact or best match
        if full_sub == "Bruno Borges Fernandes":
            match = match[match["full_name"].str.contains("Bruno Borges Fernandes", case=False, na=False)]
        elif full_sub == "Bukayo Saka":
            match = match[match["full_name"].str.contains("Bukayo", case=False, na=False)]
        elif full_sub == "Martin":
            match = match[match["full_name"].str.contains("Martin", case=False, na=False)]
        elif full_sub == "Declan Rice":
            match = match[match["full_name"].str.contains("Rice", case=False, na=False)]
        elif full_sub == "Erling Haaland":
            match = match[match["full_name"].str.contains("Haaland", case=False, na=False)]

        if not match.empty:
            selected_rows.append(match.iloc[0])

    print("\n" + "=" * 80)
    print("### Spotlight Player Ratings Summary (Season 2026/2027)")
    print("=" * 80 + "\n")

    headers = [
        "Player",
        "Pos",
        "Mins",
        "OVR",
        "SHT",
        "PAS",
        "DRI",
        "DEF",
        "PHY",
        "AER",
        "Key Attributes",
    ]
    print(f"| {' | '.join(headers)} |")
    print(f"|{'|'.join(['---' for _ in headers])}|")

    for r in selected_rows:
        name = r["full_name"]
        pos = r["primary_position"]
        mins = int(r["minutes_played"])
        ovr = int(r["overall_rating"])
        sht = int(r["radar_shooting"])
        pas = int(r["radar_passing"])
        dri = int(r["radar_dribbling"])
        defe = int(r["radar_defending"])
        phy = int(r["radar_physical"])
        aer = int(r["radar_aerial"])

        # Highlight key attributes based on role
        if pos == "FWD":
            key_attrs = f"Shots: {r['stat_shots']}, Spd: {r['stat_speed']}, Acc: {r['stat_acceleration']}, Pos: {r['stat_positioning']}"
        elif pos == "MID":
            key_attrs = f"Vis: {r['stat_vision']}, SPas: {r['stat_short_passing']}, Touch: {r['stat_touch']}, DefPos: {r['stat_defensive_positioning']}"
        elif pos == "DEF":
            key_attrs = f"Tack: {r['stat_tackling']}, DefPos: {r['stat_defensive_positioning']}, Str: {r['stat_strength']}, Head: {r['stat_heading']}"
        else:
            key_attrs = f"DefPos: {r['stat_defensive_positioning']}, SPas: {r['stat_short_passing']}, LPass: {r['stat_long_passing']}"

        row_str = f"| **{name}** | `{pos}` | {mins} | **{ovr}** | {sht} | {pas} | {dri} | {defe} | {phy} | {aer} | {key_attrs} |"
        print(row_str)

    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    df_result = run_player_ratings_pipeline()
    print_spotlight_summary(df_result)
