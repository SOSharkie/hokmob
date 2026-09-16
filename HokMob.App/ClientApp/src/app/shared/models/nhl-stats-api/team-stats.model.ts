/**
 * Response of /api/nhl-stats/teams?season={season}&gameType={2|3}: every team's season stats in one response, so a
 * team page can work out league ranks itself. A season with no games played yet has no rows.
 */
export interface TeamStatsResponse {
  teams: TeamSeasonStats[];
}

/**
 * A team/summary row of the NHL stats API. Percentages are 0 to 1.
 */
export interface TeamSeasonStats {
  teamId: number;
  teamFullName: string;
  seasonId: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  pointPct: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  shotsForPerGame: number;
  shotsAgainstPerGame: number;
  powerPlayPct: number;
  penaltyKillPct: number;
  faceoffWinPct: number;
}
