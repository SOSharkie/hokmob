/**
 * Response of /api/nhl-stats/team-games?season={season}&gameType={2|3}: every team's game by game stats for a season,
 * as columns of equally long arrays (one per field of TeamGameStats), sorted by date. A season with no games yet has
 * empty columns.
 */
export interface TeamGamesResponse {
  games: {[field in keyof TeamGameStats]: TeamGameStats[field][]};
}

/**
 * One team's stats in one game, merged by the backend from the stats API's team reports. The 5v5 shot attempts are
 * Corsi (sat) and the unblocked ones Fenwick (usat). The expected goals fields aren't in the response.
 */
export interface TeamGameStats {
  gameId: number;
  /** The local game day, like "2026-11-14". */
  gameDate: string;
  teamId: number;
  opponentTeamId: number;
  /** "H" or "R". */
  homeRoad: string;
  wins: number;
  losses: number;
  otLosses: number;
  /** 2 for a win, 1 for an overtime or shootout loss. */
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  satFor: number;
  satAgainst: number;
  usatFor: number;
  usatAgainst: number;
  shots5v5For: number;
  shots5v5Against: number;
  ppGoalsFor: number;
  ppOpportunities: number;
  shGoalsAgainst: number;
  ppGoalsAgainst: number;
  timesShorthanded: number;
  shGoalsFor: number;
  goalsFor5v5: number;
  goalsAgainst5v5: number;
  /**
   * The team's 5v5 expected goals for and against in the game, from Natural Stat Trick, which the stats API doesn't
   * have: merged in by TeamRatingUtils.withExpectedGoals, and undefined for a game NST doesn't have (yet) or when NST
   * can't be asked.
   */
  expectedGoalsFor5v5?: number;
  expectedGoalsAgainst5v5?: number;
}
