# Player Database Architecture (Dev Schema)

## Overview
This document outlines the 4-tier relational schema designed inside Supabase under the `dev` schema for player intelligence, procedural avatars, Football Manager-style 1–100 attribute modeling, injury replacement impacts, and FPL recommendations.

---

## 1. Data Schema Architecture
dev.players (Master Bio & Regens)
│
├──> dev.player_fixture_stats (Granular per-match event logs)
│
├──> dev.player_season_aggregates (Season totals & per-90 rates)
│       │
│       └──> dev.player_ratings (FM 1-100 attributes & Spider Radars)

### Table 1: `dev.players` (Master Entity)
* **Purpose**: Master registry of all active players in the Premier League.
* **Primary Key**: `id` (UUID).
* **Data Sources**: Official FPL API (`/api/bootstrap-static/`).
* **Key Columns**:
  * `fpl_id`: Integer foreign key matching official FPL player element IDs.
  * `team_id`: References `public.teams(id)`.
  * `face_seed`: Deterministic hash (`fpl-{fpl_id}-{web_name}`) used to render procedural retro FM regens (zero image copyright liabilities).
  * `primary_position`: High-level cohort (`GKP`, `DEF`, `MID`, `FWD`).
  * `is_injured`, `chance_of_playing_next_round`, `news`: Real-time availability indicators for fixture simulation penalties.

### Table 2: `dev.player_season_aggregates` (Season Per-90 Foundation)
* **Purpose**: Season-level volume, efficiency, and per-90 metrics.
* **Primary Key**: `id` (UUID); Unique across `(player_id, season)`.
* **Data Sources**: FBref / Scraped event aggregators + FPL totals.
* **Role**: Powers the mathematical engine that derives 1–100 attributes without running expensive ad-hoc joins across hundreds of raw match records.

### Table 3: `dev.player_fixture_stats` (Granular Event Timeline)
* **Purpose**: Granular, single-fixture performance telemetry.
* **Primary Key**: `id` (UUID); Unique across `(player_id, fixture_id)`.
* **Data Sources**: Post-gameweek ingestion workers.
* **Role**: Visualizing player form trajectory, recent match logs, minutes trends, and granular rolling performance windows (e.g. Last 5 GWs).

### Table 4: `dev.player_ratings` (FM 1–100 Scores & Spider Radar)
* **Purpose**: Normalized 1–100 attributes across 16 core categories plus 6 macro radar polygon vertices.
* **Primary Key**: `id` (UUID); Unique across `(player_id, season)`.
* **Normalization Logic**: Percentile ranking ($0–100$) against the player's positional cohort (`cohort_position`) with a minimum minutes-played floor (e.g. $\ge 450$ mins).
* **Categories**:
  * **Physical**: `stat_speed`, `stat_strength`, `stat_jumping`, `stat_acceleration`, `stat_stamina`.
  * **Technical / Tactical**: `stat_touch`, `stat_vision`, `stat_positioning`, `stat_short_passing`, `stat_long_passing`, `stat_shots`, `stat_long_shots`, `stat_crossing`, `stat_heading`, `stat_tackling`, `stat_defensive_positioning`.
  * **Spider Radar Vertices (0–100)**: `radar_shooting`, `radar_passing`, `radar_dribbling`, `radar_defending`, `radar_physical`, `radar_aerial`.

---

## 2. Row-Level Security (RLS) Policy Baseline
Every table in `dev.*` implements standard split policies:
1. `SELECT`: Open to `public` (anon & authenticated) so web clients and SSR can read data.
2. `INSERT / UPDATE / DELETE`: Strictly locked to `service_role` (backend ingestion scripts and scheduled GitHub Actions).

---

## 3. Ingestion Workflow Sequence
1. **Bootstrap Master Players**: Ingest active Premier League elements from FPL into `dev.players`.
2. **Sync Season Aggregates**: Populate `dev.player_season_aggregates` with season totals.
3. **Calculate Ratings**: Run normalization script to populate `dev.player_ratings`.
4. **Weekly Fixture Sync**: Append new gameweek records to `dev.player_fixture_stats`.