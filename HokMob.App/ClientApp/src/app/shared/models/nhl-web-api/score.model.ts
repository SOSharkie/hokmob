import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {
  GameClock,
  GameOutcome,
  LocalizedString,
  PeriodDescriptor,
  SeriesStatus,
  TvBroadcast
} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of score/{YYYY-MM-DD}.
 */
export interface ScoreResponse {
  prevDate: string;
  currentDate: string;
  nextDate: string;
  gameWeek: ScoreGameWeekDay[];
  games: ScoreGame[];
}

export interface ScoreGameWeekDay {
  date: string;
  dayAbbrev: string;
  numberOfGames: number;
}

export interface ScoreGame {
  id: number;
  season: number;
  gameType: NhlGameTypeEnum;
  /** Local date only, like "2026-03-15". Use startTimeUTC for the time. */
  gameDate: string;
  venue: LocalizedString;
  startTimeUTC: string;
  easternUTCOffset: string;
  venueUTCOffset: string;
  venueTimezone: string;
  neutralSite: boolean;
  tvBroadcasts: TvBroadcast[];
  gameState: NhlGameStateEnum;
  gameScheduleState: NhlGameScheduleStateEnum;
  homeTeam: ScoreTeam;
  awayTeam: ScoreTeam;
  gameCenterLink: string;
  /** NHL.com path of the recap video, like "/video/stl-at-wpg-recap-6390989103112". Only for finished games, once posted. */
  threeMinRecap?: string;
  threeMinRecapFr?: string;
  /** NHL.com path of the condensed game video. Only for finished games, once posted. */
  condensedGame?: string;
  condensedGameFr?: string;
  clock?: GameClock;
  period?: number;
  periodDescriptor?: PeriodDescriptor;
  gameOutcome?: GameOutcome;
  seriesStatus?: SeriesStatus;
}

export interface ScoreTeam {
  id: number;
  /** Common name only, like "Jets". */
  name: LocalizedString;
  abbrev: string;
  score?: number;
  sog?: number;
  /** Season record for future games, like "40-38-4". */
  record?: string;
  logo: string;
}
