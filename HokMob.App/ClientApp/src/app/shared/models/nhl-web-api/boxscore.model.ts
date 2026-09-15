import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {
  GameClock,
  GamecenterTeam,
  LocalizedString,
  PeriodDescriptor
} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of gamecenter/{id}/boxscore.
 */
export interface Boxscore {
  id: number;
  season: number;
  gameType: NhlGameTypeEnum;
  gameDate: string;
  startTimeUTC: string;
  gameState: NhlGameStateEnum;
  gameScheduleState: NhlGameScheduleStateEnum;
  homeTeam: GamecenterTeam;
  awayTeam: GamecenterTeam;
  regPeriods: number;
  periodDescriptor?: PeriodDescriptor;
  clock?: GameClock;
  /** Missing for future games. */
  playerByGameStats?: BoxscorePlayerByGameStats;
}

export interface BoxscorePlayerByGameStats {
  homeTeam: BoxscoreTeamPlayers;
  awayTeam: BoxscoreTeamPlayers;
}

/**
 * Only dressed players are listed, so scratches don't need filtering.
 */
export interface BoxscoreTeamPlayers {
  forwards: BoxscoreSkater[];
  defense: BoxscoreSkater[];
  goalies: BoxscoreGoalie[];
}

export interface BoxscoreSkater {
  playerId: number;
  sweaterNumber: number;
  /** Short name, like "A. Iafallo". */
  name: LocalizedString;
  /** C, L, R or D. */
  position: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  powerPlayGoals: number;
  sog: number;
  /** 0 to 1. */
  faceoffWinningPctg: number;
  toi: string;
  blockedShots: number;
  shifts: number;
  giveaways: number;
  takeaways: number;
}

export interface BoxscoreGoalie {
  playerId: number;
  sweaterNumber: number;
  name: LocalizedString;
  position: string;
  /** Saves/shots, like "28/30". */
  evenStrengthShotsAgainst: string;
  powerPlayShotsAgainst: string;
  shorthandedShotsAgainst: string;
  saveShotsAgainst: string;
  /** 0 to 1. Missing when the goalie faced no shots. */
  savePctg?: number;
  evenStrengthGoalsAgainst: number;
  powerPlayGoalsAgainst: number;
  shorthandedGoalsAgainst: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
  starter: boolean;
  decision?: string;
  shotsAgainst: number;
  saves: number;
}
