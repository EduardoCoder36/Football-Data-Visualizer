import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-emerald-500 selection:text-neutral-950">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />

      {/* Main Container */}
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top Status Bar */}
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-900 pb-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-semibold tracking-wider uppercase text-neutral-300">
              2026/2027 Season Active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-neutral-500 font-mono text-[11px] hidden sm:block">
              Engine v2.4 • Softmax Calibrated
            </div>
            <Link
              href="/v2"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 transition-all shadow-sm shadow-emerald-500/10"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Tactical Engine V2</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Hero Section */}
        <section className="mb-16 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-6 backdrop-blur-md">
            <span>⚽</span>
            <span>ADVANCED FOOTBALL INTELLIGENCE</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl max-w-4xl leading-[1.1]">
            Premier League Tactical Analytics & Simulation Engine
          </h1>

          <p className="mt-5 max-w-3xl text-base sm:text-lg text-neutral-400 leading-relaxed">
            Form-weighted multi-pillar clash models, 18-month recency-decay baselines, and calibrated multinomial Softmax probability forecasting.
          </p>
        </section>

        {/* Main Portal Feature Cards (3-Column Grid) */}
        <section className="mb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Card A: Tactical Engine V2 (Featured Flagship) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 via-neutral-900/60 to-neutral-900/80 p-6 sm:p-8 backdrop-blur-md transition-all duration-300 hover:border-emerald-400/70 hover:shadow-2xl hover:shadow-emerald-950/30 md:col-span-2 lg:col-span-1">
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-black text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  NEW • V2 Tactical Engine
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-neutral-950 transition-colors">
                  <span>⚡</span>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                Tactical Engine V2
              </h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                4-Pillar head-to-head tactical clash forecasting with exponential recency decay, side-by-side V1/V2 model comparison, and matchday tracking.
              </p>

              {/* Feature Highlights */}
              <ul className="mt-6 space-y-2.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>4-Pillar clash deltas: Central, Aerial, Transition & Perimeter</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Side-by-side Dual Model Comparison (V1 vs V2 divergence)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Matchday 1–38 history with live prediction accuracy tracking</span>
                </li>
              </ul>
            </div>

            {/* Action Link Button */}
            <div className="mt-8 pt-6 border-t border-emerald-500/20">
              <Link
                href="/v2"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-neutral-950 transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25"
              >
                <span>Launch Tactical Engine V2</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          {/* Card B: Team Trajectory & Metric Visualizer */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8 backdrop-blur-md transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/80 hover:shadow-xl hover:shadow-black/40">
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center rounded-md bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs font-bold text-neutral-300">
                  Interactive Charts
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300 group-hover:bg-neutral-700 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-white transition-colors">
                Team Trajectory
              </h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                Interactive historical and rolling trajectory plots tracking team form, goal baselines, and performance swings.
              </p>

              {/* Feature Highlights */}
              <ul className="mt-6 space-y-2.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span>38-match pace comparisons vs prior season equivalents</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span>Goal baselines, scoring efficiency & defensive swings</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span>Multi-club overlay supporting up to 4 concurrent teams</span>
                </li>
              </ul>
            </div>

            {/* Action Link Button */}
            <div className="mt-8 pt-6 border-t border-neutral-800/80">
              <Link
                href="/visualizer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-800 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-neutral-700 hover:text-white"
              >
                <span>Launch Trajectory Visualizer</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          {/* Card C: Matchday Predictions Engine (Legacy V1) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8 backdrop-blur-md transition-all duration-300 hover:border-sky-500/50 hover:bg-neutral-900/80 hover:shadow-xl hover:shadow-sky-950/20">
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-xs font-bold text-sky-400">
                  Legacy Archetypes
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300 group-hover:bg-sky-500/20 group-hover:text-sky-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-sky-300 transition-colors">
                Legacy Predictions
              </h2>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                Gameweek-by-gameweek forecasts using Control vs Direct vs Transition Rock-Paper-Scissors modifiers.
              </p>

              {/* Feature Highlights */}
              <ul className="mt-6 space-y-2.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span>Softmax multinomial probabilities (Home, Draw, Away)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span>Control vs Direct vs Transition clash modifiers</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span>V1 model history and accuracy tracking</span>
                </li>
              </ul>
            </div>

            {/* Action Link Button */}
            <div className="mt-8 pt-6 border-t border-neutral-800/80">
              <Link
                href="/predictions"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-800 px-5 py-3 text-sm font-bold text-white transition-all group-hover:bg-sky-500 group-hover:text-neutral-950 group-hover:shadow-lg group-hover:shadow-sky-500/25"
              >
                <span>Explore V1 Predictions</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Methodology & Architecture Teaser (Bottom Section) */}
        <section className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-8 sm:p-10 backdrop-blur-sm">
          <div className="mb-8 text-center sm:text-left">
            <h3 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
              Engine Architecture & Methodology
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              A systematic quantitative framework designed to avoid both recency bias and historical inertia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Pillar 1 */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold mb-3">
                01
              </div>
              <h4 className="text-base font-bold text-white mb-2">
                18-Month Rolling Decay
              </h4>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Half-life exponential weighting prioritizing current form without losing long-term baselines. Matches are weighted with a 120-day half-life to balance immediate momentum with tactical pedigree.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 font-mono text-xs font-bold mb-3">
                02
              </div>
              <h4 className="text-base font-bold text-white mb-2">
                Tactical Clash Archetypes
              </h4>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Control, Transition, and Direct systems mapped with Rock-Paper-Scissors multipliers. Team profiles account for stylistic mismatches where playstyle matchups shift expected outcomes by up to 10 points.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 font-mono text-xs font-bold mb-3">
                03
              </div>
              <h4 className="text-base font-bold text-white mb-2">
                Calibrated Softmax
              </h4>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Regressed draw bands and scaled margins preventing extreme overconfidence. Logit outputs incorporate home-field advantages, draw decay parameters, and non-linear sensitivity scaling.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-neutral-900 pt-8 text-center text-xs text-neutral-500">
          <p>Premier League Tactical Analytics & Simulation Engine • Built with Next.js & Supabase</p>
        </footer>
      </div>
    </div>
  );
}