import { SupabaseClient } from "@supabase/supabase-js";
import { FootballDataClient } from "./footballDataClient";

interface SyncOptions {
  currentSeason: string;
  previousSeason: string;
  currentSeasonYear: number;
  previousSeasonYear: number;
}

export class SyncEngine {
  constructor(
    private supabase: SupabaseClient,
    private apiClient: FootballDataClient
  ) {}

  async runSync(options: SyncOptions) {
    console.log("Fetching match schedules and finished fixtures...");
    const [currentData, prevData] = await Promise.all([
      this.apiClient.getMatches("PL", options.currentSeasonYear),
      this.apiClient.getMatches("PL", options.previousSeasonYear),
    ]);

    // 1. Sync fixtures to Supabase (and auto-insert missing teams)
    await this.syncFixtures(currentData.matches, options.currentSeason);
    await this.syncFixtures(prevData.matches, options.previousSeason);

    // 2. Fetch required context
    const { data: teams } = await this.supabase.from("teams").select("*");
    const { data: replacements } = await this.supabase
      .from("relegated_replacements")
      .select("*")
      .eq("season", options.currentSeason);

    if (!teams) throw new Error("No teams found in database.");

    const promotedToRelegatedMap = new Map<number, number>();
    (replacements ?? []).forEach((r) => {
      promotedToRelegatedMap.set(r.promoted_team_id, r.relegated_team_id);
    });

    // 3. Process trajectories for each team
    for (const team of teams) {
      await this.calculateTeamTrajectory(
        team,
        options.currentSeason,
        options.previousSeason,
        promotedToRelegatedMap
      );
    }

    console.log("Trajectory synchronization complete.");
  }

  private async syncFixtures(matches: any[], season: string) {
    const teamsMap = new Map<number, any>();
    matches.forEach((m) => {
      if (m.homeTeam?.id && !teamsMap.has(m.homeTeam.id)) {
        teamsMap.set(m.homeTeam.id, {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          short_name: m.homeTeam.shortName || m.homeTeam.name,
          tla: m.homeTeam.tla || m.homeTeam.name.substring(0, 3).toUpperCase(),
          crest_url: m.homeTeam.crest || `https://crests.football-data.org/${m.homeTeam.id}.png`,
          is_promoted: false,
        });
      }
      if (m.awayTeam?.id && !teamsMap.has(m.awayTeam.id)) {
        teamsMap.set(m.awayTeam.id, {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          short_name: m.awayTeam.shortName || m.awayTeam.name,
          tla: m.awayTeam.tla || m.awayTeam.name.substring(0, 3).toUpperCase(),
          crest_url: m.awayTeam.crest || `https://crests.football-data.org/${m.awayTeam.id}.png`,
          is_promoted: false,
        });
      }
    });

    // Upsert teams first to satisfy foreign key constraints
    const { error: teamError } = await this.supabase
      .from("teams")
      .upsert(Array.from(teamsMap.values()), { onConflict: "id", ignoreDuplicates: true });
    if (teamError) throw teamError;

    const fixtureRows = matches.map((m) => ({
      id: m.id,
      season,
      matchday: m.matchday ?? 1,
      home_team_id: m.homeTeam.id,
      away_team_id: m.awayTeam.id,
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      venue_status: "FINISHED",
      status: m.status,
      kickoff: m.utcDate,
    }));

    const { error } = await this.supabase.from("fixtures").upsert(fixtureRows);
    if (error) throw error;
  }

  private async calculateTeamTrajectory(
    team: { id: number; is_promoted: boolean },
    currentSeason: string,
    previousSeason: string,
    promotedToRelegatedMap: Map<number, number>
  ) {
    const { data: currentFixtures } = await this.supabase
      .from("fixtures")
      .select("*")
      .eq("season", currentSeason)
      .eq("status", "FINISHED")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .order("kickoff", { ascending: true });

    if (!currentFixtures || currentFixtures.length === 0) return;

    const { data: prevFixtures } = await this.supabase
      .from("fixtures")
      .select("*")
      .eq("season", previousSeason)
      .eq("status", "FINISHED")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .order("kickoff", { ascending: true });

    let cumulativeCurrentPoints = 0;
    const trajectoryRecords = [];

    for (let i = 0; i < currentFixtures.length; i++) {
      const match = currentFixtures[i];
      const gamesPlayed = i + 1;

      const earned = this.getPointsFromFixture(match, team.id);
      cumulativeCurrentPoints += earned;

      let lastYearPoints: number | null = null;
      let sameOpponentPoints: number | null = null;

      if (!team.is_promoted && prevFixtures) {
        const pastFixturesUpToStage = prevFixtures.slice(0, gamesPlayed);
        lastYearPoints = pastFixturesUpToStage.reduce(
          (acc, f) => acc + this.getPointsFromFixture(f, team.id),
          0
        );

        sameOpponentPoints = this.calculateSameOpponentsPoints(
          currentFixtures.slice(0, gamesPlayed),
          prevFixtures,
          team.id,
          promotedToRelegatedMap
        );
      }

      trajectoryRecords.push({
        team_id: team.id,
        season: currentSeason,
        games_played: gamesPlayed,
        current_points: cumulativeCurrentPoints,
        last_year_points: lastYearPoints,
        same_opponent_points: sameOpponentPoints,
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await this.supabase
      .from("team_trajectories")
      .upsert(trajectoryRecords, { onConflict: "team_id,season,games_played" });

    if (error) console.error(`Error saving trajectory for team ${team.id}:`, error);
  }

  private calculateSameOpponentsPoints(
    currentMatchesPlayed: any[],
    prevSeasonFixtures: any[],
    teamId: number,
    promotedToRelegatedMap: Map<number, number>
  ): number {
    let opponentPoints = 0;

    for (const match of currentMatchesPlayed) {
      const isHome = match.home_team_id === teamId;
      const currentOpponentId = isHome ? match.away_team_id : match.home_team_id;

      const targetOpponentId =
        promotedToRelegatedMap.get(currentOpponentId) ?? currentOpponentId;

      const historicMatch = prevSeasonFixtures.find((prev) => {
        if (isHome) {
          return prev.home_team_id === teamId && prev.away_team_id === targetOpponentId;
        } else {
          return prev.away_team_id === teamId && prev.home_team_id === targetOpponentId;
        }
      });

      if (historicMatch) {
        opponentPoints += this.getPointsFromFixture(historicMatch, teamId);
      }
    }

    return opponentPoints;
  }

  private getPointsFromFixture(fixture: any, teamId: number): number {
    const isHome = fixture.home_team_id === teamId;
    const teamScore = isHome ? fixture.home_score : fixture.away_score;
    const opponentScore = isHome ? fixture.away_score : fixture.home_score;

    if (teamScore === null || opponentScore === null) return 0;
    if (teamScore > opponentScore) return 3;
    if (teamScore === opponentScore) return 1;
    return 0;
  }
}