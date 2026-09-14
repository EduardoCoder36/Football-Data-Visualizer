# Premier League Trajectory Tracker

This notebook calculates and visualizes a team's Premier League points progression. By comparing current form against historical baselines, it isolates whether a team is genuinely improving or simply benefiting from an easier fixture list. 

### The Three Trajectories
* **Current Season (Actual):** Cumulative points after each completed Gameweek this season.
* **Corresponding Fixtures (Contextual Baseline):** Cumulative points earned against the *exact same opponents* (and venue) last season. 
* **Last Season (Pace Baseline):** Cumulative points at this exact stage (Gameweek $N$) last season.

### Setup Requirements
To run this notebook, you will need:
1. An active API key from [football-data.org](https://www.football-data.org/).
2. The `requests`, `pandas`, and `matplotlib` libraries installed in your environment.

*Note: Matches against newly promoted teams default to 0 points in the corresponding fixture baseline.*