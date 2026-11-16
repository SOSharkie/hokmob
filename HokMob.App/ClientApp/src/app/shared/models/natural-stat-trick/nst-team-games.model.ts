/**
 * Response of /api/nst/team-games?season={season}: every team's games of a regular season with their 5v5 expected
 * goals (xG), from Natural Stat Trick's team game logs, as columns of equally long arrays (one row per team and game),
 * sorted by game. Teams have NST's name and no ID: a row's team is an index into teams.
 */
export interface NstTeamGamesResponse {
  season: number;
  /** NST's full team names, without periods or accents: "St Louis Blues", "Montreal Canadiens". */
  teams: string[];
  games: {
    gameId: number[];
    /** The team's index in teams. */
    team: number[];
    expectedGoalsFor: number[];
    expectedGoalsAgainst: number[];
  };
}

/**
 * One team's 5v5 expected goals in one game, from Natural Stat Trick.
 */
export interface NstTeamGameStats {
  gameId: number;
  /** The NHL team ID (NhlTeamUtils.getTeamIdByName). */
  teamId: number;
  /** The team's 5v5 xG, to two decimals. */
  expectedGoalsFor: number;
  /** Its opponent's 5v5 xG. */
  expectedGoalsAgainst: number;
}
