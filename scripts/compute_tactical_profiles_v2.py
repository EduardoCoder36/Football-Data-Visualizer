"""
scripts/compute_tactical_profiles_v2.py

V2 Tactical Engine - Step 2 (Calibrated): Compute V2 Tactical Profiles from Raw Stats
Reads aggregated records from Supabase table `team_raw_stats`,
applies calibrated possession-normalized feature engineering (with clamped factors),
anchors floor and ceiling in net open-play quality (npxG delta),
scales the 4 attacking and 4 defensive pillars onto a 0-100 percentile/min-max distribution,
and upserts the result into `team_tactical_profiles_v2`.

Safe: Does NOT modify or delete legacy `team_tactical_profiles` or `match_predictions`.
"""

import os
import sys
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List

import dotenv
import numpy as np
import pandas as pd
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("compute_tactical_profiles_v2")

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
# 2. Helper: Min-Max Scaler S(x) -> [0, 100]
# ---------------------------------------------------------------------------
def scale_0_100(series: pd.Series) -> pd.Series:
    """Min-max scale a series to 0-100 across all clubs."""
    s_min = series.min()
    s_max = series.max()
    if s_max == s_min:
        return pd.Series(50.0, index=series.index)
    return ((series - s_min) / (s_max - s_min) * 100.0).round(2)


# ---------------------------------------------------------------------------
# 3. Tactical Profile Computation Engine (Calibrated)
# ---------------------------------------------------------------------------
def compute_tactical_profiles_v2() -> List[Dict[str, Any]]:
    logger.info("Reading raw team statistics from Supabase table 'team_raw_stats'...")
    res = supabase.table("team_raw_stats").select("*").execute()
    data = res.data

    if not data:
        raise ValueError("No data returned from 'team_raw_stats'. Run fetch_raw_stats_v2.py first.")

    df = pd.DataFrame(data)
    logger.info(f"Loaded {len(df)} club records from 'team_raw_stats'.")

    # Ensure matches_played is valid
    mp = df["matches_played"].astype(float).clip(lower=1.0)

    # Possession Proxy & Clamped Factors (clamped strictly to [0.75, 1.30] to tame distortions)
    p_raw = df["possession_proxy"].astype(float).fillna(0.50)
    p_clamped = p_raw.clip(lower=0.20, upper=0.80)
    f_in = (0.50 / p_clamped).clip(lower=0.75, upper=1.30)

    # -----------------------------------------------------------------------
    # A. Attacking Profiles (Possession-Adjusted with Clamped Factor)
    # -----------------------------------------------------------------------
    # 1. atk_box_aerial (Cross / Set Piece / Head Threat)
    m_shots_head = (df["shots_head"].astype(float) / mp) * f_in
    m_xg_head = (df["xg_head"].astype(float) / mp) * f_in
    m_xg_set_piece = (df["xg_set_piece"].astype(float) / mp) * f_in
    m_corners_won = (df["corners_won"].astype(float) / mp) * f_in

    s_xg_set_piece = scale_0_100(m_xg_set_piece)
    s_xg_head = scale_0_100(m_xg_head)
    s_shots_head = scale_0_100(m_shots_head)
    s_corners = scale_0_100(m_corners_won)

    atk_box_aerial = (
        0.35 * s_xg_set_piece + 0.35 * s_xg_head + 0.15 * s_shots_head + 0.15 * s_corners
    ).round(2)

    # 2. atk_central_penetration (Blend of deep_p90 and xg_open_play_p90)
    s_deep = scale_0_100((df["deep_completions"].astype(float) / mp) * f_in)
    s_xg_open = scale_0_100((df["xg_open_play"].astype(float) / mp) * f_in)

    atk_central_penetration = (0.50 * s_deep + 0.50 * s_xg_open).round(2)

    # 3. atk_transition_speed (Fast Break / Counter xG / Turnover Pressure)
    m_shots_counter = (df["shots_counter"].astype(float) / mp) * f_in
    m_xg_counter = (df["xg_counter"].astype(float) / mp) * f_in
    ppda_inverted = 100.0 - scale_0_100(df["ppda"].astype(float))

    s_xg_counter = scale_0_100(m_xg_counter)
    s_shots_counter = scale_0_100(m_shots_counter)
    s_ppda_inverted = scale_0_100(ppda_inverted)

    atk_transition_speed = (
        0.45 * s_xg_counter + 0.25 * s_shots_counter + 0.30 * s_ppda_inverted
    ).round(2)

    # 4. atk_perimeter_chaos (Distance Striking / Speculative Shooting)
    m_shots_outside = (df["shots_outside_box"].astype(float) / mp) * f_in
    m_avg_distance = df["avg_shot_distance"].astype(float)
    denom_shots = df["shots_outside_box"].astype(float).clip(lower=1.0)
    m_long_threat = df["goals_outside_box"].astype(float) / denom_shots

    s_shots_outside = scale_0_100(m_shots_outside)
    s_avg_distance = scale_0_100(m_avg_distance)
    s_long_threat = scale_0_100(m_long_threat)

    atk_perimeter_chaos = (
        0.40 * s_shots_outside + 0.30 * s_avg_distance + 0.30 * s_long_threat
    ).round(2)

    # -----------------------------------------------------------------------
    # B. Defensive Profiles (Out-of-Possession Suppression — Per-Match Basis)
    # Evaluated primarily per match to avoid inflating conceded stats for high-possession sides
    # -----------------------------------------------------------------------
    # 1. def_box_aerial_suppression
    conceded_box_aerial = (
        df["xga_head"].astype(float) + df["xga_set_piece"].astype(float)
    ) / mp
    def_box_aerial_suppression = (100.0 - scale_0_100(conceded_box_aerial)).round(2)

    # 2. def_central_space_denial (Blend of 100 - S(deep_allowed_p90) and 100 - S(npxga_p90))
    s_deep_allowed_p90 = scale_0_100(df["deep_allowed"].astype(float) / mp)
    s_npxga_p90 = scale_0_100(df["npxga"].astype(float) / mp)

    def_central_space_denial = (
        0.50 * (100.0 - s_deep_allowed_p90) + 0.50 * (100.0 - s_npxga_p90)
    ).round(2)

    # 3. def_rest_defense
    conceded_counter = (
        df["shots_counter_conceded"].astype(float) + df["xga_counter"].astype(float)
    ) / mp
    s_counter_conceded = scale_0_100(conceded_counter)
    s_oppda = scale_0_100(df["oppda"].astype(float))

    def_rest_defense = (0.70 * (100.0 - s_counter_conceded) + 0.30 * s_oppda).round(2)

    # 4. def_perimeter_suppression
    conceded_outside = df["shots_outside_box_conceded"].astype(float) / mp
    discipline = (
        df["fouls_conceded"].astype(float) + 2.0 * df["yellow_cards"].astype(float)
    ) / mp

    s_outside_conceded = scale_0_100(conceded_outside)
    s_discipline = scale_0_100(discipline)

    def_perimeter_suppression = (
        0.50 * (100.0 - s_outside_conceded) + 0.50 * (100.0 - s_discipline)
    ).round(2)

    # -----------------------------------------------------------------------
    # C. Anchor Floor & Ceiling in Net Performance (npxG Delta)
    # -----------------------------------------------------------------------
    net_npxg_p90 = (df["npxg"].astype(float) - df["npxga"].astype(float)) / mp
    net_quality_score = scale_0_100(net_npxg_p90)
    s_npxg_p90 = scale_0_100(df["npxg"].astype(float) / mp)

    # floor = 0.50 * net_quality_score + 0.30 * (100 - S(npxga_p90)) + 0.20 * (P * 100)
    floor = (
        0.50 * net_quality_score
        + 0.30 * (100.0 - s_npxga_p90)
        + 0.20 * (p_raw * 100.0)
    ).round(2)

    # ceiling = 0.50 * net_quality_score + 0.35 * S(npxg_p90) + 0.15 * atk_central_penetration
    ceiling = (
        0.50 * net_quality_score
        + 0.35 * s_npxg_p90
        + 0.15 * atk_central_penetration
    ).round(2)

    # Guarantee ceiling >= floor + 5.0
    for i in range(len(floor)):
        if ceiling.iloc[i] < floor.iloc[i] + 5.0:
            ceiling.iloc[i] = round(floor.iloc[i] + 5.0, 2)

    chaos_index = (
        0.40 * atk_perimeter_chaos
        + 0.30 * (100.0 - def_perimeter_suppression)
        + 0.30 * (ceiling - floor).abs()
    ).round(2)

    now_utc = datetime.now(timezone.utc).isoformat()

    # Construct records matching public.team_tactical_profiles_v2 schema
    records = []
    for i, row in df.iterrows():
        records.append({
            "id": str(row["id"]),
            "team": str(row["team"]),
            "season": str(row["season"]),
            "matches_played": int(row["matches_played"]),
            "possession_proxy": round(float(row["possession_proxy"]), 4),
            "atk_box_aerial": float(atk_box_aerial.iloc[i]),
            "atk_central_penetration": float(atk_central_penetration.iloc[i]),
            "atk_transition_speed": float(atk_transition_speed.iloc[i]),
            "atk_perimeter_chaos": float(atk_perimeter_chaos.iloc[i]),
            "def_box_aerial_suppression": float(def_box_aerial_suppression.iloc[i]),
            "def_central_space_denial": float(def_central_space_denial.iloc[i]),
            "def_rest_defense": float(def_rest_defense.iloc[i]),
            "def_perimeter_suppression": float(def_perimeter_suppression.iloc[i]),
            "floor": float(floor.iloc[i]),
            "ceiling": float(ceiling.iloc[i]),
            "chaos_index": float(chaos_index.iloc[i]),
            "updated_at": now_utc,
        })

    return records


# ---------------------------------------------------------------------------
# 4. Upsert into Supabase & Print Summary
# ---------------------------------------------------------------------------
def main():
    print("=" * 80)
    print("V2 Tactical Engine - Step 2 (Calibrated): Tactical Profiles Engine")
    print("=" * 80)

    records = compute_tactical_profiles_v2()

    if len(records) != 20:
        logger.warning(f"Expected 20 clubs, but computed {len(records)} profiles.")
    else:
        logger.info(f"Successfully computed calibrated tactical profiles for all 20 clubs.")

    # Upsert into Supabase
    print(f"\nUpserting {len(records)} profiles into Supabase 'team_tactical_profiles_v2'...")
    try:
        response = (
            supabase.table("team_tactical_profiles_v2")
            .upsert(records, on_conflict="id")
            .execute()
        )
        upserted_count = len(response.data) if response.data else len(records)
        print(f"Successfully upserted {upserted_count} profiles into 'team_tactical_profiles_v2'.")
    except Exception as e:
        logger.error(f"Failed to upsert profiles into Supabase: {e}")
        sys.exit(1)

    # Print Clean Preview Table: Team, Floor, Ceiling, Chaos, Atk Central, Def Central
    df_preview = pd.DataFrame(records)[
        [
            "team",
            "floor",
            "ceiling",
            "chaos_index",
            "atk_central_penetration",
            "def_central_space_denial",
        ]
    ].sort_values(by="floor", ascending=False)

    print("\n" + "=" * 80)
    print("PREMIER LEAGUE 2026/2027 CALIBRATED V2 TACTICAL PROFILES PREVIEW")
    print("=" * 80)
    print(df_preview.to_string(index=False))
    print("=" * 80)
    print("Execution completed successfully without touching existing pipelines.\n")


if __name__ == "__main__":
    main()
