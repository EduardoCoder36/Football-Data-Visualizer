# Component: Fixture Sync & Aggregation Worker
**Location:** Backend Services (`/services/sync-worker`, Supabase Edge Functions / Scheduled Cron)

## User Story
**As a** system administrator,
**I want** the backend service to periodically poll football-data.org for completed fixtures and update cumulative historical/comparison points,
**So that** the client application serves low-latency pre-calculated metrics without exceeding external API rate limits.

---

## Technical Flow & Rules
1. **Fixture Polling (Call 1)**: Sync fixtures endpoint daily to build the master schedule and determine `FINISHED` status.
2. **Result Polling (Call 2)**: Polled 15 minutes post-match for fixtures scheduled on that day. Updates result in database upon match completion.
3. **Promoted/Relegated Team Substitution Mapping**:
   - 20th place (previous season) $\rightarrow$ Playoff Winner (promoted)
   - 19th place (previous season) $\rightarrow$ 2nd place Championship (promoted)
   - 18th place (previous season) $\rightarrow$ 1st place Championship (promoted)
4. **Comparison Points Calculation**:
   - Points evaluated by chronological `games_played` (1 to 38).
   - For match $N$ against opponent $X$ at venue $V$ (HOME/AWAY): find previous season's fixture against $X$ (or replacement mapped team if $X$ was relegated) at venue $V$, and determine previous points earned (3 for win, 1 for draw, 0 for loss).
5. **Postponed Matches**:
   - `games_played` is monotonically incremented only when a game status transitions to `FINISHED`.
   - Postponed matches do not create placeholder entries; they are processed chronologically as completed.

---

## Gherkin Scenarios

```gherkin
Feature: Premier League Fixture Ingestion and Point Mapping

  Background:
    Given the Supabase database is online
    And valid credentials exist for football-data.org API

  Scenario: Scheduled match ingestion marks fixture finished and recalculates lines
    Given a fixture "Arsenal vs Chelsea" at venue "HOME" was scheduled
    When the cron worker queries the football-data.org matches endpoint
    And the match status is returned as "FINISHED" with score "2 - 1"
    Then the database status for this fixture is set to "FINISHED"
    And the team match counter increments by 1
    And the current season cumulative points for "Arsenal" increments by 3
    And the system queries the previous season result for "Arsenal vs Chelsea" at "HOME"
    And increments the opponent comparison line by the historic points earned

  Scenario: Opponent comparison against a promoted club utilizes relegated substitute
    Given a fixture "Arsenal vs Leeds United" at venue "HOME"
    And "Leeds United" was promoted as "1st place Championship"
    When the sync engine computes the corresponding opponent comparison points
    Then the system looks up the previous season fixture "Arsenal vs Southampton" at venue "HOME" where Southampton finished 18th
    And uses the points earned from that historic fixture

  Scenario: Match is postponed
    Given a scheduled fixture between "Arsenal" and "Wolves"
    When the upstream API reports match status "POSTPONED"
    Then the database stores status as "POSTPONED"
    And "games_played" count remains unchanged for both clubs
    And no new data point is generated on the chart series

  Scenario: External API rate limit encountered (HTTP 429)
    Given the worker executes an ingestion run
    When football-data.org returns an HTTP 429 Too Many Requests response
    Then the worker logs an error event
    And triggers an exponential backoff retry policy
    And halts further API calls for the duration of the backoff window