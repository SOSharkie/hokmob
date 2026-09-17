/**
 * Responses of /api/nhl-stats/*, which the backend builds from the NHL stats API (api.nhle.com/stats/rest/en). The
 * field names are the stats API's, so a row can be compared with a raw response: names are plain strings, percentages
 * are 0 to 1, and times are in seconds.
 */

/**
 * Response of /api/nhl-stats/player/{id}?position={skater|goalie}. A skater's rows hold SkaterSeasonStats and
 * SkaterGameStats, a goalie's GoalieSeasonStats and GoalieGameStats.
 */
export interface PlayerStats {
  /** One row per NHL season, newest first. A season with two teams is one row ("CGY,VAN"). */
  regularSeasons: SkaterSeasonStats[] | GoalieSeasonStats[];
  playoffSeasons: SkaterSeasonStats[] | GoalieSeasonStats[];
  /** The last 10 games, newest first, regular season and playoff games mixed. */
  recentGames: SkaterGameStats[] | GoalieGameStats[];
}

/**
 * The fields every stats API player row has, by season or by game.
 */
export interface PlayerStatsRow {
  playerId: number;
  lastName: string;
  gamesPlayed: number;
  /** L or R. */
  shootsCatches: string;
}

export interface SkaterSeasonStats extends PlayerStatsRow {
  seasonId: number;
  skaterFullName: string;
  /** C, L, R or D. */
  positionCode: string;
  /** Every team of the season, in order, like "CGY,VAN". */
  teamAbbrevs: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  ppGoals: number;
  ppPoints: number;
  shGoals: number;
  shPoints: number;
  shots: number;
  /** 0 to 1. */
  shootingPct: number;
  penaltyMinutes: number;
  /** 0 to 1. Null for a player who took no faceoffs. */
  faceoffWinPct?: number;
  /** Seconds per game, like 1181.6133. */
  timeOnIcePerGame: number;
  /** From the realtime report; missing when that call failed. */
  hits?: number;
  blockedShots?: number;
  takeaways?: number;
  giveaways?: number;
  missedShots?: number;
}

export interface GoalieSeasonStats extends PlayerStatsRow {
  seasonId: number;
  goalieFullName: string;
  teamAbbrevs: string;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  shutouts: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  goalsAgainstAverage: number;
  /** 0 to 1. */
  savePct: number;
  /** Seconds. */
  timeOnIce: number;
}

/**
 * The fields every per game row has, with the game type and score the backend adds.
 */
export interface PlayerGameStatsRow extends PlayerStatsRow {
  gameId: number;
  /** Like "2026-06-14". */
  gameDate: string;
  /** The player's team in that game. */
  teamAbbrev: string;
  opponentTeamAbbrev: string;
  /** H or R. */
  homeRoad: string;
  /** 2 for a regular season game, 3 for a playoff game. Read from the game ID by the backend. */
  gameType: number;
  /** From the game report; missing when that call failed. */
  homeTeamId?: number;
  visitingTeamId?: number;
  homeScore?: number;
  visitingScore?: number;
}

export interface SkaterGameStats extends PlayerGameStatsRow {
  skaterFullName: string;
  positionCode: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  ppGoals: number;
  ppPoints: number;
  shots: number;
  shootingPct: number;
  penaltyMinutes: number;
  /** 0 to 1. Null for a player who took no faceoffs. */
  faceoffWinPct?: number;
  /** Seconds, for the one game. */
  timeOnIcePerGame: number;
  /** From the realtime report; missing when that call failed. */
  hits?: number;
  blockedShots?: number;
  takeaways?: number;
  giveaways?: number;
  missedShots?: number;
  /** Faceoffs won and lost, from the faceoffwins report; missing when that call failed. */
  totalFaceoffs?: number;
}

export interface GoalieGameStats extends PlayerGameStatsRow {
  goalieFullName: string;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  shutouts: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  goalsAgainstAverage: number;
  /** 0 to 1. */
  savePct: number;
  /** Seconds. */
  timeOnIce: number;
  /** From the saves by strength report; missing when that call failed. */
  evSaves?: number;
  evShotsAgainst?: number;
  ppSaves?: number;
  ppShotsAgainst?: number;
  shSaves?: number;
  shShotsAgainst?: number;
}
