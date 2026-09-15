import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";

/**
 * Models shared by several new NHL API (api-web.nhle.com) responses.
 */

/**
 * A localized string, like { "default": "Jets", "fr": "Jets" }. Read `default`.
 */
export interface LocalizedString {
  default: string;
  [language: string]: string;
}

export interface PeriodDescriptor {
  number: number;
  periodType: NhlPeriodTypeEnum;
  maxRegulationPeriods: number;
  otPeriods?: number;
}

export interface GameClock {
  timeRemaining: string;
  secondsRemaining: number;
  running: boolean;
  inIntermission: boolean;
}

export interface GameOutcome {
  lastPeriodType: NhlPeriodTypeEnum;
  otPeriods?: number;
}

export interface TvBroadcast {
  id: number;
  market: string;
  countryCode: string;
  network: string;
  sequenceNumber: number;
}

/**
 * A team in the gamecenter landing, play-by-play and boxscore responses.
 */
export interface GamecenterTeam {
  id: number;
  commonName: LocalizedString;
  placeName: LocalizedString;
  placeNameWithPreposition: LocalizedString;
  abbrev: string;
  score?: number;
  sog?: number;
  logo: string;
  darkLogo: string;
}

/**
 * Playoff series status for a game. Only in the score response.
 */
export interface SeriesStatus {
  round: number;
  seriesAbbrev: string;
  seriesTitle: string;
  seriesLetter: string;
  neededToWin: number;
  topSeedTeamAbbrev: string;
  topSeedWins: number;
  bottomSeedTeamAbbrev: string;
  bottomSeedWins: number;
  gameNumberOfSeries: number;
}
