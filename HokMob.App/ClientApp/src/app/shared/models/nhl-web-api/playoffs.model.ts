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
  /** "Eastern" or "Western" for a conference final. Only set for series converted from the bracket. */
  conferenceName?: string;
  /** Undefined while the team isn't known yet (only for series converted from the bracket). */
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
  /** Seed rank, like 1 for D1 or WC1. Not in the carousel response; merged in from playoff-bracket/{year}. */
  rank?: number;
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
 * A season's playoff bracket as NhlStandingAndPlayoffService.getNhlPlayoffBracket returns it.
 */
export interface PlayoffBracketSeason {
  /** The year the season ends in, like 2026. */
  year: number;
  /** The season ID, like 20252026. */
  season: number;
  /** Rounds 1 to 4 (series A to O), in the order of the bracket. Empty before the playoffs start. */
  series: PlayoffCarouselSeries[];
  /** Whether the bracket had a qualifying round (2020's series S to Z), which isn't in the series. */
  hasQualifyingRound: boolean;
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
