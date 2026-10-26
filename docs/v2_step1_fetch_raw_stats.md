# Task Spec: Step 1 - Fetch Raw Match & Team Stats via Free APIs to Supabase

## Objective
Build a Python script `scripts/fetch_raw_stats_v2.py` that collects raw team-level statistical metrics across all 20 Premier League clubs for the current 2026/2027 season using **free, unblocked APIs (Understat JSON endpoints and football-data.org)** and upserts them into the Supabase table `team_raw_stats`.

Do NOT scrape FBref. Cloudflare blocks datacenter IPs. The script must execute cleanly without browser automation or CAPTCHAs.

---

## 1. Target Supabase Destination
- **Table Name**: `public.team_raw_stats`
- **Primary Key**: `id` format: `{team_slug}_{season}` (e.g., `arsenal_2026_2027`)
- **Key Columns**:
  - `id` (TEXT)
  - `team` (TEXT - canonical team name matching football-data.org)
  - `season` (TEXT - e.g. "2026-2027")
  - `matches_played` (INT)
  - `deep_completions` (INT - Understat 'deep')
  - `deep_allowed` (INT - Understat 'deep_allowed')
  - `possession_proxy` (NUMERIC - deep / (deep + deep_allowed))
  - `shots_head`, `xg_head` (INT, NUMERIC - Understat shotType == 'Head')
  - `xg_set_piece` (NUMERIC - Understat situation == 'SetPiece')
  - `corners_won` (INT - football-data.org match aggregates)
  - `xg_open_play` (NUMERIC - Understat situation == 'OpenPlay')
  - `shots_inside_box` (INT - Understat shot coordinates inside penalty box)
  - `npxg` (NUMERIC - Understat non-penalty xG)
  - `shots_counter`, `xg_counter` (INT, NUMERIC - Understat situation == 'FromCounter')
  - `ppda` (NUMERIC - Understat PPDA)
  - `shots_outside_box`, `goals_outside_box`, `avg_shot_distance` (INT, INT, NUMERIC)
  - `shots_head_conceded`, `xga_head`, `xga_set_piece`, `corners_conceded`
  - `xga_open_play`, `npxga`, `shots_inside_box_conceded`
  - `shots_counter_conceded`, `xga_counter`, `oppda`
  - `shots_outside_box_conceded`, `fouls_conceded`, `yellow_cards`
  - `updated_at` (TIMESTAMPTZ)

---

## 2. Data Sources & Extraction Logic

### Source A: Understat (Free, Unblocked JSON)
- Use `understatapi`, `soccerdata.Understat`, or direct JSON scraping from `https://understat.com/league/EPL` via standard `requests` with a generic browser User-Agent header.
- Aggregate all shot-level and match-level records per Premier League team across the active season:
  - Total `deep` and `deep_allowed`.
  - Shot groupings by `situation` (`OpenPlay`, `SetPiece`, `FromCounter`).
  - Shot groupings by `shotType` (`Head`).
  - Shot locations: Calculate distance or tag box shots based on coordinates $(X, Y)$ where $X \ge 0.835$ and $0.21 \le Y \le 0.79$.
  - Both team offensive metrics and defensive conceded counterparts (`deep_allowed`, `xga_open_play`, etc.).

### Source B: football-data.org API
- Use the existing `FOOTBALL_DATA_API_KEY` from the environment / `.env`.
- Retrieve finished Premier League matches for the season.
- Aggregate per team:
  - `corners_won` vs `corners_conceded`
  - `fouls_conceded`
  - `yellow_cards`

---

## 3. Implementation Requirements
1. **Environment Variables**: Use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`), and `FOOTBALL_DATA_API_KEY` from local `.env`.
2. **Team Name Normalization**: Include a dictionary mapping Understat team names and football-data.org team names to a consistent canonical naming standard (e.g., "Arsenal", "Manchester City", "Newcastle United").
3. **Upsert Logic**: Upsert into `team_raw_stats` using `id` as the conflict target (`on_conflict="id"`).
4. **Idempotency & Clean Output**: Print a clean summary table to stdout upon completion listing team name, matches played, possession proxy, and npxG.
5. **No Interference**: Do NOT modify or delete `team_tactical_profiles` or `match_predictions`. Keep the existing production pipeline completely intact.