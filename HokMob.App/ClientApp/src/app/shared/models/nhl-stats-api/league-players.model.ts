/**
 * Response of /api/nhl-stats/league-players?season={season}&gameType={2|3}&position={skater|goalie}: every player's
 * season row, as columns of equally long arrays (one per field of LeagueSkaterStats or LeagueGoalieStats), sorted by
 * player ID. A season with no games yet has empty columns.
 */
export interface LeaguePlayersResponse<T = LeagueSkaterStats | LeagueGoalieStats> {
  players: {[field in keyof T]: T[field][]};
  /** The most games any team has played in the season, which a minimum of games is scaled to. */
  mostTeamGames: number;
}

/**
 * Every player of one position (skaters or goalies) in a season, as NhlStatsApiService.getLeaguePlayers resolves them.
 */
export interface LeaguePlayers<T = LeagueSkaterStats | LeagueGoalieStats> {
  players: T[];
  /** The most games any team has played in the season. */
  mostTeamGames: number;
}

/**
 * A skater's season row, merged by the backend from the stats API's skater summary, realtime, scoringpergame,
 * summaryshooting, timeonice, penalties and faceoffwins reports. A traded player's season is one row ("CAR,COL"). A
 * field a report doesn't have for the player is null.
 */
export interface LeagueSkaterStats {
  playerId: number;
  skaterFullName: string;
  lastName: string;
  /** C, L, R or D. */
  positionCode: string;
  teamAbbrevs: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  ppGoals: number;
  ppPoints: number;
  shGoals: number;
  gameWinningGoals: number;
  /** Shots on goal. */
  shots: number;
  penaltyMinutes: number;
  /** 0 to 1. Null for a player who took no faceoffs. */
  faceoffWinPct: number;
  /** Seconds per game, like 1422.2692. */
  timeOnIcePerGame: number;
  hits: number;
  blockedShots: number;
  takeaways: number;
  giveaways: number;
  missedShots: number;
  /** His shot attempts that were blocked. */
  shotAttemptsBlocked: number;
  /** His shot attempts: shots on goal, missed and blocked. */
  totalShotAttempts: number;
  totalPrimaryAssists: number;
  totalSecondaryAssists: number;
  /** 5v5 shot attempts (Corsi) for and against his team while he was on the ice. */
  satFor: number;
  satAgainst: number;
  /** 5v5 unblocked shot attempts (Fenwick) for and against while he was on the ice. */
  usatFor: number;
  usatAgainst: number;
  /** Seconds per game at 5v5. */
  timeOnIcePerGame5v5: number;
  /** Seconds over the season, all situations (skater/timeonice). */
  timeOnIce: number;
  /** Seconds per game at even strength, on the power play and short-handed. */
  evTimeOnIcePerGame: number;
  ppTimeOnIcePerGame: number;
  shTimeOnIcePerGame: number;
  /** The penalties he took (skater/penalties). */
  penalties: number;
  /** The penalties he drew. */
  penaltiesDrawn: number;
  /** His faceoffs won and lost (skater/faceoffwins), 0 for a player who took none. */
  totalFaceoffWins: number;
  totalFaceoffLosses: number;
}

/**
 * A goalie's season row, merged by the backend from the stats API's goalie summary and savesByStrength reports. The
 * pp split is the shots he faced on the penalty kill (the other team's power play), and the sh split the ones on his
 * own team's power play.
 */
export interface LeagueGoalieStats {
  playerId: number;
  goalieFullName: string;
  lastName: string;
  teamAbbrevs: string;
  gamesPlayed: number;
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
  evSaves: number;
  evShotsAgainst: number;
  ppSaves: number;
  ppShotsAgainst: number;
  shSaves: number;
  shShotsAgainst: number;
}
