# Architecture & Supabase Integration Plan

## 1. Context & Recommendation

### Should we use your existing Supabase DB & Site?
**Recommendation: Yes.** Integrating the tactical modeling engine directly into your existing football performance tracker provides immediate advantages:

* **Shared Identifiers:** You already have canonical `teams`, `seasons`, and `fixtures` records. Maintaining a single ID space prevents mapping errors.
* **Contextual Blending:** Your current project tracks performance against last season's equivalent opponents. Layering tactical style scores on top explains *why* a team under- or over-performed against an equivalent opponent (e.g., "They struggled vs. Everton not because Everton were better, but because Everton's deep block negated their direct transition floor").
* **Single Deployment Footprint:** One Supabase instance, one Auth layer, and one frontend dashboard with new tabs for tactical profiles and match projections.

---

## 2. Proposed Database Schema Extension

These tables sit cleanly alongside your existing match tracking tables.

```sql
-- 1. Style Profile definitions (Versioned metrics per team per rolling window or season)
create table team_style_profiles (
    id uuid default gen_random_uuid() primary key,
    team_id uuid references teams(id) on delete cascade,
    season_id text not null,
    window_type text default 'season_to_date', -- e.g., 'last_5_games', 'season_to_date'
    
    -- Normalized Style Ratings (0.0 to 100.0)
    control_score numeric(5, 2) not null,
    transition_threat numeric(5, 2) not null,
    pressing_intensity numeric(5, 2) not null,
    directness_score numeric(5, 2) not null,
    defensive_line_height numeric(5, 2) not null,
    
    -- Calculated baseline capabilities
    floor_rating numeric(5, 2) not null,   -- Minimum guaranteed quality output
    ceiling_rating numeric(5, 2) not null, -- Maximum potential output in optimal match-up
    
    archetype text not null,               -- e.g., 'Positional Control', 'Direct Transition', 'Compact Block'
    updated_at timestamp with time zone default now()
);

-- 2. Rock-Paper-Scissors Interaction Matrix (Coefficients for style clashes)
create table tactical_clash_rules (
    id serial primary key,
    team_a_archetype text not null,
    team_b_archetype text not null,
    advantage_modifier numeric(4, 3) not null, -- e.g., 1.15 (+15% toward ceiling) or 0.85 (-15% toward floor)
    notes text
);

-- 3. Match Predictions & Retrospective Testing
create table match_tactical_projections (
    id uuid default gen_random_uuid() primary key,
    fixture_id uuid references fixtures(id) on delete cascade,
    home_team_id uuid references teams(id),
    away_team_id uuid references teams(id),
    
    -- Projected outcomes based on style clash
    home_projected_performance numeric(5, 2),
    away_projected_performance numeric(5, 2),
    tactical_advantage_team_id uuid references teams(id),
    
    -- Actual post-game outcome for validation
    actual_result text,
    prediction_accuracy_score numeric(5, 2),
    created_at timestamp with time zone default now()
);
```

---

## 3. Data Pipeline & Workflow

```
[Open Match Feeds (StatsBomb / Understat / FBref)]
                       │
                       ▼
          [Python Ingestion Worker]
    - Computes event aggregations
    - Normalizes scores into 0-100 ranges
    - Determines team archetype & floor/ceiling
                       │
                       ▼
       [Supabase DB: team_style_profiles]
                       │
                       ▼
          [Clash Engine / Edge Function]
    - Applies Rock-Paper-Scissors matrix
    - Computes match projected outcome
                       │
                       ▼
        [Your Existing Web Dashboard]
    - Tactical Profile cards
    - Clash simulator & upcoming match ratings
```