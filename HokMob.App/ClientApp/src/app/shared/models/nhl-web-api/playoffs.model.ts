import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {
  GameOutcome,
  LocalizedString,
  PeriodDescriptor,
  TvBroadcast
} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of playoff-series/carousel/{season}/.
 */
export interface PlayoffCarousel {
  seasonId: number;
  currentRound: number;
  rounds: PlayoffCarouselRound[];
}

export interface PlayoffCarouselRound {
  roundNumber: number;
  /** Slug, like "conference-finals". */
  roundLabel: string;
  roundAbbrev: string;
  series: PlayoffCarouselSeries[];
}

export interface PlayoffCarouselSeries {
  seriesLetter: string;
  roundNumber: number;
  seriesLabel: string;
  seriesLink: string;
  topSeed: PlayoffCarouselSeed;
  bottomSeed: PlayoffCarouselSeed;
  neededToWin: number;
  winningTeamId?: number;
  losingTeamId?: number;
}

export interface PlayoffCarouselSeed {
  id: number;
  abbrev: string;
  wins: number;
  logo: string;
  darkLogo: string;
}

/**
 * Response of playoff-bracket/{year}.
 */
export interface PlayoffBracket {
  bracketLogo: string;
  bracketTitle: LocalizedString;
  bracketSubTitle: LocalizedString;
  series: PlayoffBracketSeries[];
}

export interface PlayoffBracketSeries {
  seriesUrl: string;
  seriesTitle: string;
  seriesAbbrev: string;
  seriesLetter: string;
  playoffRound: number;
  topSeedRank: number;
  topSeedRankAbbrev: string;
  topSeedWins: number;
  bottomSeedRank: number;
  bottomSeedRankAbbrev: string;
  bottomSeedWins: number;
  winningTeamId?: number;
  losingTeamId?: number;
  topSeedTeam?: PlayoffBracketTeam;
  bottomSeedTeam?: PlayoffBracketTeam;
  seriesLogo: string;
  conferenceAbbrev?: string;
  conferenceName?: string;
}

export interface PlayoffBracketTeam {
  id: number;
  abbrev: string;
  name: LocalizedString;
  commonName: LocalizedString;
  placeNameWithPreposition: LocalizedString;
  logo: string;
  darkLogo: string;
}

/**
 * Response of schedule/playoff-series/{season}/{seriesLetter}/.
 */
export interface PlayoffSeriesSchedule {
  round: number;
  roundAbbrev: string;
  roundLabel: string;
  seriesLetter: string;
  seriesLogo: string;
  neededToWin: number;
  length: number;
  topSeedTeam: PlayoffSeriesTeam;
  bottomSeedTeam: PlayoffSeriesTeam;
  games: PlayoffSeriesGame[];
}

export interface PlayoffSeriesTeam {
  id: number;
  name: LocalizedString;
  abbrev: string;
  placeName: LocalizedString;
  conference: { name: string, abbrev: string };
  record: string;
  seriesWins: number;
  divisionAbbrev: string;
  seed: number;
  logo: string;
  darkLogo: string;
}

export interface PlayoffSeriesGame {
  id: number;
  season: number;
  gameType: NhlGameTypeEnum;
  gameNumber: number;
  ifNecessary: boolean;
  venue: LocalizedString;
  neutralSite: boolean;
  startTimeUTC: string;
  easternUTCOffset: string;
  venueUTCOffset: string;
  venueTimezone: string;
  gameState: NhlGameStateEnum;
  gameScheduleState: NhlGameScheduleStateEnum;
  tvBroadcasts: TvBroadcast[];
  homeTeam: PlayoffSeriesGameTeam;
  awayTeam: PlayoffSeriesGameTeam;
  gameCenterLink: string;
  periodDescriptor?: PeriodDescriptor;
  seriesStatus?: { topSeedWins: number, bottomSeedWins: number };
  gameOutcome?: GameOutcome;
}

export interface PlayoffSeriesGameTeam {
  id: number;
  commonName: LocalizedString;
  placeName: LocalizedString;
  placeNameWithPreposition: LocalizedString;
  abbrev: string;
  score?: number;
}
