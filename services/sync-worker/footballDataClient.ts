import { z } from "zod";
import { FixtureSyncSchema } from "../../types/contracts";

const MatchesResponseSchema = z.object({
  matches: z.array(FixtureSyncSchema),
});

export class FootballDataClient {
  private apiKey: string;
  private baseUrl = "https://api.football-data.org/v4";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getMatches(competitionCode: string = "PL", season?: number) {
    let url = `${this.baseUrl}/competitions/${competitionCode}/matches`;
    if (season) {
      url += `?season=${season}`;
    }

    const res = await fetch(url, {
      headers: {
        "X-Auth-Token": this.apiKey,
      },
    });

    const requestsAvailable = Number(res.headers.get("x-requestsavailable") ?? "10");
    const resetSeconds = Number(res.headers.get("x-requestcounter-reset") ?? "60");

    if (res.status === 429) {
      console.warn(`Hit 429 rate limit. Waiting ${resetSeconds}s...`);
      await new Promise((resolve) => setTimeout(resolve, (resetSeconds + 1) * 1000));
      return this.getMatches(competitionCode, season);
    }

    if (!res.ok) {
      throw new Error(`Football-data.org error: ${res.status} ${res.statusText}`);
    }

    // Safety pause if running out of requests in the active window
    if (requestsAvailable <= 1) {
      console.info(`Rate limit near exhaustion. Pausing for ${resetSeconds}s.`);
      await new Promise((resolve) => setTimeout(resolve, (resetSeconds + 1) * 1000));
    }

    const data = await res.json();
    return MatchesResponseSchema.parse(data);
  }
}