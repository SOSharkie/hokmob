/**
 * A season's NHL EDGE file, src/assets/edge/{season}-2.json, written by build-edge-data.js from every skater's
 * edge/skater-detail: one row per skater, as columns of equally long arrays sorted by player ID, like the history
 * files. Only from 2021-22 on, which is when EDGE starts. See "EDGE season data" in docs/nhl-api.md.
 */
export interface EdgeSeasonFile {
  version: number;
  season: number;
  gameType: number;
  /**
   * The day of the season's last final game when the file was built, like "2026-11-23", in a file of a season in
   * progress. A finished season's file has none.
   */
  throughDate?: string;
  skaters: {[field in keyof EdgeSeasonSkater]: EdgeSeasonSkater[field][]};
}

/** One skater's EDGE season. A value EDGE didn't have is null. */
export interface EdgeSeasonSkater {
  playerId: number;
  /** His games, as EDGE counts them. */
  gamesPlayed: number;
  /** His top skating speed, in mph. */
  speedMax: number;
  /** How often he went over 20 mph. */
  burstsOver20: number;
  /** The distance he skated over the season, in miles. */
  distance: number;
  /** His hardest shot, in mph. */
  topShotSpeed: number;
  /** The share of his ice time in the offensive zone, 0 to 1. */
  offensiveZonePctg: number;
  /** The share of his ice time in the defensive zone, 0 to 1. */
  defensiveZonePctg: number;
}

/** A season's EDGE file as one object per skater, the way EdgeSeasonService resolves it. */
export interface EdgeSeason {
  season: number;
  /** As in the file: the day it runs through, for a season in progress. */
  throughDate?: string;
  skaters: EdgeSeasonSkater[];
}
