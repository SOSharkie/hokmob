import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {LocalizedString} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of club-stats/{abbrev}/now or club-stats/{abbrev}/{season}/{gameType}: every skater's and goalie's totals
 * for one team, in one season and game type. A player traded during the season only has his games for this team.
 * A season or game type without games (the playoffs before they start) returns empty lists.
 */
export interface ClubStats {
  /** Like "20252026". A string here, unlike the number in most other responses. */
  season: string;
  gameType: NhlGameTypeEnum;
  skaters: ClubStatsSkater[];
  goalies: ClubStatsGoalie[];
}

export interface ClubStatsSkater {
  playerId: number;
  headshot: string;
  firstName: LocalizedString;
  lastName: LocalizedString;
  /** "C", "L", "R" or "D". */
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerPlayGoals: number;
  shorthandedGoals: number;
  gameWinningGoals: number;
  overtimeGoals: number;
  shots: number;
  /** 0-1. */
  shootingPctg: number;
  /** In seconds. */
  avgTimeOnIcePerGame: number;
  avgShiftsPerGame: number;
  /** 0-1, and 0 without faceoffs. */
  faceoffWinPctg: number;
}

export interface ClubStatsGoalie {
  playerId: number;
  headshot: string;
  firstName: LocalizedString;
  lastName: LocalizedString;
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  goalsAgainstAverage: number;
  /** 0-1. */
  savePercentage: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  shutouts: number;
  goals: number;
  assists: number;
  points: number;
  penaltyMinutes: number;
  /** In seconds. */
  timeOnIce: number;
}

/**
 * Both teams' season totals for a future game's season leaders (NhlGameService.getSeasonLeaderStats), from the same
 * season and game type.
 */
export interface SeasonLeaderStats {
  home: ClubStats;
  away: ClubStats;
}
