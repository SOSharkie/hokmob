/**
 * Response of /api/nst/teams?season={season}: every team's 5v5 expected goals (xG) over a regular season, from Natural
 * Stat Trick's team table, in NST's order. Teams have NST's name and no ID (NhlTeamUtils.getTeamIdByName).
 */
export interface NstTeamTable {
  season: number;
  teams: NstTeamSeasonStats[];
}

export interface NstTeamSeasonStats {
  /** NST's full team name, without periods or accents: "St Louis Blues", "Montreal Canadiens". */
  name: string;
  gamesPlayed: number;
  /** The team's 5v5 xG, to two decimals. */
  expectedGoalsFor: number;
  /** Its opponents' 5v5 xG, to two decimals. */
  expectedGoalsAgainst: number;
}
