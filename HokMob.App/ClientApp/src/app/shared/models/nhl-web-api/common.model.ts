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

/**
 * The special teams situation, on the landing and play-by-play responses while a team is short-handed. Absent at even
 * strength and once the game is over, so always read it with `?.`. Seen during an intermission too, when a penalty
 * carries into the next period.
 */
export interface GameSituation {
  homeTeam: GameSituationTeam;
  awayTeam: GameSituationTeam;
  /** The situation code of the play, like "1451" (away goalie, 4 away skaters, 5 home skaters, home goalie). */
  situationCode: string;
  /** Time left in the power play, like "01:01". */
  timeRemaining: string;
  secondsRemaining: number;
}

export interface GameSituationTeam {
  abbrev: string;
  /** Like ["PP"] for the team on the power play. Absent for the short-handed team. */
  situationDescriptions?: string[];
  /** Skaters on the ice, not counting the goalie: 5 and 4 on a standard power play. */
  strength: number;
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
