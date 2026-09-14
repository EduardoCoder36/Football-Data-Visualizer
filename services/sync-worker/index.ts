import { createClient } from "@supabase/supabase-js";
import { FootballDataClient } from "./footballDataClient";
import { SyncEngine } from "./syncEngine";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const footballData = new FootballDataClient(process.env.FOOTBALL_DATA_API_KEY!);
const engine = new SyncEngine(supabase, footballData);

// Example run for 2026/2027 season
engine
  .runSync({
    currentSeason: "2026/2027",
    previousSeason: "2025/2026",
    currentSeasonYear: 2026,
    previousSeasonYear: 2025,
  })
  .then(() => console.log("Sync finished successfully."))
  .catch((err) => console.error("Sync failed:", err));