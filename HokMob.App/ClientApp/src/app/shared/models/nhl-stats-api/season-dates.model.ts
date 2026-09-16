/**
 * Response of /api/nhl-stats/seasons: the two latest seasons, newest first. The newest one can be listed before any of
 * its games are scheduled.
 */
export interface SeasonDatesResponse {
  seasons: SeasonDates[];
}

/**
 * The first game days of a season, which the current season and playoff mode are worked out from (see DateTimeUtils).
 */
export interface SeasonDates {
  /** The season ID, like 20262027. */
  id: number;
  /** The local day of the first preseason game (the first regular season game without a preseason), like
   *  "2026-09-19". Null while no game is scheduled. */
  firstGameDate: string;
  /** The local day of the first playoff game, like "2026-04-18". Null while no playoff game is scheduled. */
  firstPlayoffGameDate: string;
}

/**
 * The current season and whether the site is in playoff mode.
 */
export interface CurrentSeason {
  /** The season ID, like 20262027. */
  season: number;
  isPlayoffMode: boolean;
}
