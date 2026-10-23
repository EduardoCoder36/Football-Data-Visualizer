# Premier League Tactical Analytics & Simulation Engine

A Next.js and Supabase platform for Premier League tracking, 18-month recency-decay models, tactical archetype clashes, and calibrated multinomial Softmax probability forecasting.

---

## Portals & Features

1. **Central Hub (`/`)**: Main landing page with portal cards for both tools and methodology breakdown.
2. **Team Trajectory & Metric Visualizer (`/visualizer`)**: 38-game rolling pace vs prior-season equivalents, cumulative points, and goal differential tracking across up to 4 concurrent teams.
3. **Matchday Predictions Engine (`/predictions`)**: Gameweek-by-gameweek fixture forecasts with Rock-Paper-Scissors tactical clash modifiers, calibrated Softmax probability distributions, and round-by-round accuracy tracking.

---

## Automated GitHub Actions Sync

The repository includes an automated workflow [`.github/workflows/update_predictions.yml`](.github/workflows/update_predictions.yml) that automatically runs:
- **Mondays at 06:00 UTC (`0 6 * * 1`)**: Scrapes weekend match scores, marks outcomes (`✓ Hit`, `½ Double Chance`, `✗ Miss`), and updates round-by-round accuracy.
- **Thursdays at 14:00 UTC (`0 14 * * 4`)**: Ingests fresh schedules and computes projected probabilities for the upcoming matchweek.
- **Manual Trigger**: Can be dispatched manually anytime via the **Actions** tab in GitHub.

### Required GitHub Repository Secrets

To enable the scheduled workflows to authenticate and write to Supabase, configure the following secrets in your GitHub repository:

1. Navigate to: **GitHub Repository** $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
2. Click **New repository secret** and add:

| Secret Name | Value Description | Example / Location |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Your Supabase project URL | `https://xyzcompany.supabase.co` (from Supabase Project Settings $\rightarrow$ API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key (bypasses RLS for write access) | `eyJhbGciOi...` (from Supabase Project Settings $\rightarrow$ API $\rightarrow$ Project API keys) |
| `SUPABASE_ANON_KEY` *(Optional)* | Supabase Anonymous Public Key (fallback key) | `eyJhbGciOi...` |

---

## Local Development & Python Scripts

### Prerequisites
- Node.js 18+ (or 20/22)
- Python 3.11+
- Supabase Project configured

### Python Scripts Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the Matchday Predictions sync manually
python scripts/sync_upcoming_predictions.py
```

### Next.js Frontend
```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Hub.
