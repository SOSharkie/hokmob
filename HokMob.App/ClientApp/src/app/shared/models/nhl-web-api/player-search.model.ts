/**
 * A result of the player search (search.d3.nhle.com, through /api/nhl-search/player). The response is a plain array of
 * these. Note that the IDs are strings, and that an inactive or not yet debuted player has no last season or team.
 */
export interface PlayerSearchResult {
  playerId: string;
  /** The full name, like "Macklin Celebrini". */
  name: string;
  /** C, L, R, D or G. */
  positionCode: string;
  teamId?: string;
  teamAbbrev?: string;
  lastTeamId?: string;
  lastTeamAbbrev?: string;
  /** Like "20262027". Null for a player who hasn't played a game. */
  lastSeasonId?: string;
  sweaterNumber?: number;
  active: boolean;
  height?: string;
  heightInInches?: number;
  weightInPounds?: number;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
}
