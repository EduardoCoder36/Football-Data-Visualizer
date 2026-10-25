-- Migration: Create team_tactical_profiles table
-- Drop legacy prototype table if exists to replace old schema
drop table if exists team_tactical_profiles cascade;

create table if not exists team_tactical_profiles (
  id text primary key, -- e.g. "2025-2026_Arsenal"
  season text not null,
  team text not null,
  
  -- Raw & Per-90 Metrics
  matches_played int,
  possession numeric,
  goals_scored int,
  tackles_won int,
  interceptions int,
  crosses int,
  fouls int,
  yellow_cards int,
  tkl_int_p90 numeric,
  crosses_p90 numeric,
  fouls_p90 numeric,
  
  -- Engine / Model Outputs
  score_control numeric,
  score_transition numeric,
  score_direct numeric,
  archetype text,
  chaos_index numeric,
  floor numeric,
  ceiling numeric,
  
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS and add a read policy for public/authenticated users
alter table team_tactical_profiles enable row level security;
drop policy if exists "Allow public read access" on team_tactical_profiles;
create policy "Allow public read access" on team_tactical_profiles for select using (true);
