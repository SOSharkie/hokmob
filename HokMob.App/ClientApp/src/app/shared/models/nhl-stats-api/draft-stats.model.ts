/**
 * Response of /api/nhl-stats/draft?year={year}&round={round}: the regular season career stats of the players drafted
 * in one round, from the stats API bios (skaters and goalies) and goalie summary. Players who never played an NHL game
 * aren't listed, so a round without NHL players yet is an empty list.
 */
export interface DraftStatsResponse {
  /** Sorted by overall pick. */
  players: DraftPlayerStats[];
}

export interface DraftPlayerStats {
  /** The overall pick, which matches a draft pick's overallPick. */
  draftOverall: number;
  playerId: number;
  /** The full name, like "Connor McDavid". */
  name: string;
  lastName: string;
  /** C, L, R, D or G. */
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
}
