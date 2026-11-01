# Product Roadmap, OKRs & Architectural Guardrails

## 1. Vision & Core Philosophy
The platform exists to transform complex football analytics into an engaging, intuitive, and delightful experience. The UI should bring moments of joy to the user on every visit through purposeful, subtle animations, tactical visualizations, and polished design.

### Core Business Pillars
* **Pillar 1: Team & League Process Analytics**
  Interactive metric visualizers tracking underlying performance (xG, pace, finishing/keeping efficiency, territorial dominance) benchmarked against historical baselines.
* **Pillar 1a: Player-Level Metric Visualisation**
  Drill-downs into individual player output, underlying shot and progression profiles, and replacement/depth metrics.
* **Pillar 2: Evolving Prediction Engine**
  A transparent machine learning/tactical engine. A legacy version (e.g., v2) remains perpetually visible as an open historical benchmark tracking model evolution over time.
* **Pillar 3: Pure-Data FPL Intelligence**
  Unbiased, data-driven Fantasy Premier League recommendations driven entirely by underlying metrics (xGI, minutes security, fixture difficulty) rather than subjective punditry.
* **Pillar 4: No-Code Custom Tactical Sandbox**
  A visual modeling suite enabling users to define high-level concepts, assign sub-metric weights, configure home-advantage modifiers, select timeframes, and generate custom match outcome probabilities.

---

## 2. Objectives & Key Results (OKRs)

### Objective 1: Deliver an Engaging, Intuitive Analytics Experience
* **KR 1.1:** Maintain UI visual polish with subtle, high-performance tactical animations (e.g., dynamic pitch charts, matchday momentum badges) with zero layout shift (CLS < 0.05).
* **KR 1.2:** Ensure 100% of public charts are one-click exportable or shareable with clean visual citations.

### Objective 2: Establish Demonstrable Predictive Authority
* **KR 2.1:** Achieve ≥ 75% accuracy on season-long Double Chance predictions across the Premier League.
* **KR 2.2:** Achieve ≥ 50% strike rate on primary "Top Pick" value selections over a full 380-match campaign.
* **KR 2.3:** Maintain public, immutable historical tracking of legacy vs current model versions.

### Objective 3: Deliver Elite Objective FPL Recommendations
* **KR 3.1:** Rank within the top 10% of all overall FPL managers over a full 38-gameweek season using automated, algorithmic transfer and captaincy recommendations.
* **KR 3.2:** Provide transparent per-player xGI vs actual points regression tracking to highlight imminent mean-reversions.

### Objective 4: Launch the No-Code Tactical Model Builder
* **KR 4.1:** Ship an intuitive, step-by-step visual modeling workflow allowing users to:
  * Name macro concepts (e.g., "Pace & Transition", "Aerial Dominance").
  * Map specific sub-metrics with weight sliders summing to 100%.
  * Apply team-specific or global home-advantage offsets.
  * Define historical lookback windows (current season, last season, rolling 10 games).
* **KR 4.2:** Return real-time simulated match probabilities (H/D/A percentage splits and certainty bands).

### Objective 5: Build a Self-Sustaining Community & Commercial Model
* **KR 5.1:** Operate an initial 6-month free access window across all premium features to drive engagement.
* **KR 5.2:** Onboard up to 50 Founding Lifetime Members with perpetual full-tier access.
* **KR 5.3:** Track referral networks via Supabase, granting each founding member 50 invite codes that lock in a guaranteed 33% lifetime subscription discount.
* **KR 5.4:** Convert and maintain at least 10 paying subscribers following the introductory window.

---

## 3. Autonomous Agent Guardrails & Operating Constraints

Any autonomous agent operating within this repository must strictly adhere to the following rules prior to presenting changes for human review:

### Rule 1: Production Database Protection & Dev Isolation
* **Dev Schema Sandboxing:** All local development, agent testing, data mutations, and experimental migrations must target the `dev` schema (`NEXT_PUBLIC_SUPABASE_SCHEMA=dev`).
* **Zero Production Mutations:** The agent may **never** touch, mutate, or run DDL (`DROP`, `TRUNCATE`, `ALTER`) against the `public` schema.
* **Explicit Migration Files:** Any schema change (new tables, columns, or indexes created in `dev`) must be saved as an isolated `.sql` migration file in `supabase/migrations/` (e.g. `YYYYMMDD_feature_name.sql`) so it can be reviewed and manually promoted to `public`.
* **API Quota Lock:** Scrapers and sync scripts must default to test limits unless explicitly invoked. Automated cron workflows must never be triggered arbitrarily.

### Rule 2: Git Hygiene & Branch Isolation
* Work must occur on isolated feature branches (`feat/*`, `fix/*`).
* The agent may never push directly to `main`.
* Commits must be atomic, descriptive, and follow conventional commit standards (`feat:`, `fix:`, `refactor:`, `test:`).

### Rule 3: Automated Quality & Build Gates
Prior to completing any task or declaring work ready for review, the agent must run and pass:
1. `npx tsc --noEmit` — 0 TypeScript compiler errors.
2. `npm run build` — Clean Next.js production compilation.
3. Dynamic season logic must remain agnostic (no hardcoding of specific calendar years).