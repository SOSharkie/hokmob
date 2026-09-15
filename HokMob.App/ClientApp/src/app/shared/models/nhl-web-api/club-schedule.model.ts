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
 * Response of club-schedule-season/{abbrev}/now or club-schedule-season/{abbrev}/{season}.
 */
export interface ClubScheduleSeason {
  previousSeason: number;
  currentSeason: number;
  /** Only in the response for a past season. */
  nextSeason?: number;
  clubTimezone: string;
  clubUTCOffset: string;
  games: ClubScheduleGame[];
}

export interface ClubScheduleGame {
  id: number;
  season: number;
  gameType: NhlGameTypeEnum;
  gameDate: string;
  venue: LocalizedString;
  neutralSite: boolean;
  startTimeUTC: string;
  easternUTCOffset: string;
  venueUTCOffset: string;
  venueTimezone: string;
  gameState: NhlGameStateEnum;
  gameScheduleState: NhlGameScheduleStateEnum;
  tvBroadcasts: TvBroadcast[];
  homeTeam: ClubScheduleTeam;
  awayTeam: ClubScheduleTeam;
  gameCenterLink: string;
  periodDescriptor?: PeriodDescriptor;
  gameOutcome?: GameOutcome;
}

export interface ClubScheduleTeam {
  id: number;
  commonName: LocalizedString;
  placeName: LocalizedString;
  placeNameWithPreposition: LocalizedString;
  abbrev: string;
  logo: string;
  darkLogo: string;
  score?: number;
}
