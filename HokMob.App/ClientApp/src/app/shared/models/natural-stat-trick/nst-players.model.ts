/**
 * Response of /api/nst/players?season={season}: every skater's individual stats of a regular season that the NHL's
 * APIs don't have, from Natural Stat Trick's player season page, all situations, and his 5v5 on-ice xG from its on-ice
 * page, as columns of equally long arrays (one row per skater), sorted by player ID. A traded skater's season is one
 * row. A stat NST shows as "-" is null, and so are the on-ice columns when that page couldn't be had.
 */
export interface NstPlayersResponse {
  season: number;
  players: {[field in keyof NstPlayerStats]: NstPlayerStats[field][]};
}

/**
 * One skater's season on Natural Stat Trick, all situations.
 */
export interface NstPlayerStats {
  /** The NHL player ID. */
  playerId: number;
  gamesPlayed: number;
  /** Seconds over the season. */
  timeOnIce: number;
  /** His own expected goals (ixG): the xG of his unblocked shot attempts. */
  expectedGoals: number;
  /** His own high danger shot attempts (iHDCF). */
  highDangerAttempts: number;
  /** His shot attempts off the rush. */
  rushAttempts: number;
  /** His shots that gave a rebound. */
  reboundsCreated: number;
  hitsTaken: number;
  /** His 5v5 ice time over the season, in seconds, from the on-ice page. Null without it. */
  onIceTimeOnIce: number;
  /** His team's 5v5 expected goals while he was on the ice (on-ice xGF). */
  onIceExpectedGoalsFor: number;
  /** The opponents' 5v5 expected goals while he was on the ice (on-ice xGA). */
  onIceExpectedGoalsAgainst: number;
}
