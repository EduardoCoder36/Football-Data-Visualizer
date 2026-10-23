# Tactical Modeling & Sync Scripts

This directory contains data scraping, model calibration, and Supabase synchronization scripts for Premier League analytics.

## Files

- `sync_upcoming_predictions.py`: Primary production worker that ingests completed matches with scores and projects upcoming fixtures for the next 3–4 gameweeks. Calculates calibrated Softmax probabilities, handles team aliasing, and upserts to `match_predictions`.
- `tactical_profiles_rolling_18m.csv`: 18-month rolling performance baselines, archetypes (`Control`, `Transition`, `Direct`), floor/ceiling ratings, and chaos indices.
- `build_weighted_tactical_profiles.py`: Generates recency-weighted tactical profiles from FBref match logs using a 120-day half-life decay function.
- `backtest_predictions.py`: Historical model evaluation script computing top-pick hit rates and double chance accuracies.
- `sync_to_supabase.py`: Seeds baseline club profiles into `team_tactical_profiles`.

## GitHub Actions Secret Configuration

When executed via [`.github/workflows/update_predictions.yml`](../.github/workflows/update_predictions.yml), the script requires:
- `SUPABASE_URL`: The project endpoint URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key with database write privileges.
- Alternatively, `SUPABASE_KEY` or `SUPABASE_ANON_KEY`.

Configure these in **GitHub Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
