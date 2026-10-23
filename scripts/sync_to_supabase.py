import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Load Supabase credentials from your .env.local
load_dotenv('.env.local')

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env.local")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Read the generated CSV
df = pd.read_csv("scripts/tactical_profiles_2025_2026.csv")
records = df.to_dict(orient="records")

print(f"Upserting {len(records)} tactical profiles to Supabase...")
response = supabase.table("team_tactical_profiles").upsert(records).execute()

print("Sync complete!")