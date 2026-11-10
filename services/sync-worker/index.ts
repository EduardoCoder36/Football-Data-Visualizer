import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FootballDataClient } from "./footballDataClient";
import { SyncEngine } from "./syncEngine";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or service role key in environment.");
  process.exit(1);
}

const syncOptions = {
  currentSeason: "2026/2027",
  previousSeason: "2025/2026",
  currentSeasonYear: 2026,
  previousSeasonYear: 2025,
};

async function runAllSchemas() {
  const footballData = new FootballDataClient(process.env.FOOTBALL_DATA_API_KEY!);

  const publicClient = createClient(supabaseUrl!, supabaseKey!);
  const publicEngine = new SyncEngine(publicClient, footballData);
  await publicEngine.runSync(syncOptions);

  try {
    const devClient = createClient(supabaseUrl!, supabaseKey!, {
      db: { schema: "dev" as "public" },
    }) as unknown as SupabaseClient;
    const devEngine = new SyncEngine(devClient, footballData);
    await devEngine.runSync(syncOptions);
  } catch (err) {
    console.warn("Non-fatal warning syncing dev schema:", err);
  }
}

runAllSchemas()
  .then(() => console.log("Sync finished successfully across schemas."))
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
