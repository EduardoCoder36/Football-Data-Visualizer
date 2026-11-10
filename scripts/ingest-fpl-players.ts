import dotenv from 'dotenv';
// Load environment variables from .env.local and .env
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Configuration & Environment Setup
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ Missing Supabase credentials. Please set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
  );
  process.exit(1);
}

const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log(`🔗 Initializing Supabase client (${isServiceRole ? 'Service Role Key' : 'Anon Key'})...`);

const supabase = createClient(supabaseUrl, supabaseKey);

// FPL API Interfaces
interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
  code: number;
}

interface FPLElement {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  status: string;
  news: string | null;
  chance_of_playing_next_round: number | null;
  birth_date?: string | null;
  squad_number?: number | null;
  [key: string]: any;
}

interface FPLBootstrapData {
  teams: FPLTeam[];
  elements: FPLElement[];
}

interface DBTeam {
  id: number;
  name: string;
  short_name: string | null;
  tla: string | null;
}

// Position mapping per specification:
// 1 -> 'GKP', 2 -> 'DEF', 3 -> 'MID', 4 -> 'FWD'
const POSITION_MAP: Record<number, string> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

// Known alias mapping to match FPL team names and abbreviations to DB team names
const KNOWN_ALIASES: Record<string, string[]> = {
  'Brighton & Hove Albion FC': ['brighton', 'bha', 'brighton & hove albion', 'brighton and hove albion'],
  'Manchester City FC': ['man city', 'manchester city', 'mci'],
  'Manchester United FC': ['man utd', 'manchester united', 'man u', 'mun'],
  'Nottingham Forest FC': ["nott'm forest", 'nottingham forest', 'nottingham', 'nfo'],
  'Tottenham Hotspur FC': ['spurs', 'tottenham', 'tottenham hotspur', 'tot'],
  'AFC Bournemouth': ['bournemouth', 'bou', 'afc bournemouth'],
  'Leeds United FC': ['leeds', 'leeds united', 'lee'],
  'Newcastle United FC': ['newcastle', 'newcastle united', 'new'],
  'West Ham United FC': ['west ham', 'west ham united', 'whu'],
  'Wolverhampton Wanderers FC': ['wolves', 'wolverhampton', 'wolverhampton wanderers', 'wol'],
  'Arsenal FC': ['arsenal', 'ars'],
  'Aston Villa FC': ['aston villa', 'avl'],
  'Brentford FC': ['brentford', 'bre'],
  'Chelsea FC': ['chelsea', 'che'],
  'Coventry City FC': ['coventry city', 'coventry', 'cov'],
  'Crystal Palace FC': ['crystal palace', 'cry'],
  'Everton FC': ['everton', 'eve'],
  'Fulham FC': ['fulham', 'ful'],
  'Hull City AFC': ['hull city', 'hull', 'hul'],
  'Ipswich Town FC': ['ipswich town', 'ipswich', 'ips'],
  'Liverpool FC': ['liverpool', 'liv'],
  'Sunderland AFC': ['sunderland', 'sun'],
  'Burnley FC': ['burnley', 'bur'],
  'Leicester City FC': ['leicester city', 'leicester', 'lei'],
  'Southampton FC': ['southampton', 'sou'],
};

function normalizeTeamString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b(fc|afc)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Builds a lookup map from FPL team ID to DB team ID (public.teams.id)
 */
function resolveTeamMapping(
  fplTeams: FPLTeam[],
  dbTeams: DBTeam[]
): Map<number, number> {
  const fplToDbMap = new Map<number, number>();

  for (const fplTeam of fplTeams) {
    const fplCleanName = normalizeTeamString(fplTeam.name);
    const fplLowerName = fplTeam.name.toLowerCase().trim();
    const fplLowerShort = fplTeam.short_name.toLowerCase().trim();

    let matchedDbTeam: DBTeam | undefined = undefined;

    // 1. Direct check against aliases
    for (const [dbFullName, aliases] of Object.entries(KNOWN_ALIASES)) {
      if (
        aliases.includes(fplLowerName) ||
        aliases.includes(fplLowerShort) ||
        aliases.some((a) => normalizeTeamString(a) === fplCleanName)
      ) {
        matchedDbTeam = dbTeams.find(
          (d) => d.name.toLowerCase() === dbFullName.toLowerCase()
        );
        if (matchedDbTeam) break;
      }
    }

    // 2. Normalized name matching
    if (!matchedDbTeam) {
      matchedDbTeam = dbTeams.find((d) => {
        const dbClean = normalizeTeamString(d.name);
        return (
          dbClean === fplCleanName ||
          (d.short_name && normalizeTeamString(d.short_name) === fplCleanName)
        );
      });
    }

    // 3. Substring matching
    if (!matchedDbTeam) {
      matchedDbTeam = dbTeams.find((d) => {
        const dbClean = normalizeTeamString(d.name);
        return dbClean.includes(fplCleanName) || fplCleanName.includes(dbClean);
      });
    }

    if (matchedDbTeam) {
      fplToDbMap.set(fplTeam.id, matchedDbTeam.id);
      console.log(
        `  ✓ Mapped FPL [${fplTeam.id}] "${fplTeam.name}" (${fplTeam.short_name}) -> DB [${matchedDbTeam.id}] "${matchedDbTeam.name}"`
      );
    } else {
      console.warn(
        `  ⚠️ WARNING: Could not resolve DB team for FPL [${fplTeam.id}] "${fplTeam.name}" (${fplTeam.short_name})`
      );
    }
  }

  return fplToDbMap;
}

async function fetchFPLBootstrapData(): Promise<FPLBootstrapData> {
  console.log('🌐 Fetching data from official FPL bootstrap-static API...');
  const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`FPL API request failed with status: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as FPLBootstrapData;
}

async function fetchDBTeams(): Promise<DBTeam[]> {
  console.log('🔍 Fetching teams from public.teams...');
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, short_name, tla')
    .order('name');

  if (error || !data) {
    throw new Error(`Failed to fetch teams from public.teams: ${error?.message}`);
  }

  return data as DBTeam[];
}

export async function ingestFPLPlayers(): Promise<void> {
  console.log('🚀 Starting FPL Player Ingestion Worker...');

  // 1. Fetch DB Teams and FPL Bootstrap Data
  const [dbTeams, fplData] = await Promise.all([
    fetchDBTeams(),
    fetchFPLBootstrapData(),
  ]);

  console.log(`📊 Found ${dbTeams.length} DB teams and ${fplData.teams.length} FPL teams.`);
  console.log(`📊 Total FPL player elements to process: ${fplData.elements.length}`);

  // 2. Resolve Team IDs
  console.log('\n🔄 Resolving FPL Team IDs to Database Team IDs:');
  const teamMapping = resolveTeamMapping(fplData.teams, dbTeams);

  if (teamMapping.size !== fplData.teams.length) {
    console.warn(
      `⚠️ Warning: Only mapped ${teamMapping.size}/${fplData.teams.length} FPL teams.`
    );
  } else {
    console.log(`✅ All ${teamMapping.size} FPL teams mapped successfully.\n`);
  }

  // 3. Transform Player Records
  console.log('⚙️ Transforming player elements into dev.players records...');
  let skippedUnmappedTeam = 0;

  const playerRecords: Record<string, any>[] = [];
  for (const element of fplData.elements) {
    const resolvedTeamId = teamMapping.get(element.team);

    if (!resolvedTeamId) {
      skippedUnmappedTeam++;
      continue;
    }

    const cleanWebName = element.web_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const faceSeed = `fpl-${element.id}-${cleanWebName}`;
    const primaryPosition = POSITION_MAP[element.element_type] || 'MID';
    const isInjured = element.status !== 'a';
    const chanceOfPlaying =
      element.chance_of_playing_next_round ?? (element.status === 'a' ? 100 : null);
    const fplCost = Number((element.now_cost / 10.0).toFixed(1));

    playerRecords.push({
      fpl_id: element.id,
      web_name: element.web_name,
      first_name: element.first_name,
      second_name: element.second_name,
      full_name: `${element.first_name} ${element.second_name}`.trim(),
      team_id: resolvedTeamId,
      primary_position: primaryPosition,
      fpl_cost: fplCost,
      is_injured: isInjured,
      news: element.news && element.news.trim().length > 0 ? element.news.trim() : null,
      chance_of_playing_next_round: chanceOfPlaying,
      face_seed: faceSeed,
      is_active: true,
      date_of_birth: element.birth_date || null,
      shirt_number: element.squad_number || null,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(
    `✅ Transformed ${playerRecords.length} players. (Skipped ${skippedUnmappedTeam} unmapped).`
  );

  // 4. Batch Upsert into dev.players (Chunks of 100)
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(playerRecords.length / BATCH_SIZE);
  console.log(
    `\n📦 Upserting ${playerRecords.length} records into dev.players in ${totalBatches} batches (batch size: ${BATCH_SIZE})...`
  );

  let totalUpserted = 0;

  for (let i = 0; i < playerRecords.length; i += BATCH_SIZE) {
    const batch = playerRecords.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await supabase
      .schema('dev')
      .from('players')
      .upsert(batch, { onConflict: 'fpl_id' });

    if (error) {
      console.error(`❌ Error upserting batch ${batchNum}/${totalBatches}:`, error);
      throw error;
    }

    totalUpserted += batch.length;
    console.log(
      `  ✓ Batch ${batchNum}/${totalBatches} upserted (${totalUpserted}/${playerRecords.length} players)`
    );
  }

  // 5. Verify Row Count in dev.players
  console.log('\n🔎 Verifying final record count in dev.players...');
  const { count, error: countError } = await supabase
    .schema('dev')
    .from('players')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error fetching row count from dev.players:', countError);
  } else {
    console.log(`🎉 Ingestion complete! Current row count in dev.players: ${count}`);
  }
}

// Run if called directly
if (require.main === module || process.argv[1]?.includes('ingest-fpl-players')) {
  ingestFPLPlayers()
    .then(() => {
      console.log('✨ All done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Fatal error during player ingestion:', err);
      process.exit(1);
    });
}
