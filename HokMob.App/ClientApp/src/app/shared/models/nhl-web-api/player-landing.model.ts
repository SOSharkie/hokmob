import {LocalizedString} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of player/{id}/landing. Only the bio fields are modeled.
 */
export interface PlayerLanding {
  playerId: number;
  isActive: boolean;
  currentTeamId?: number;
  currentTeamAbbrev?: string;
  fullTeamName?: LocalizedString;
  teamCommonName?: LocalizedString;
  firstName: LocalizedString;
  lastName: LocalizedString;
  teamLogo?: string;
  sweaterNumber?: number;
  /** C, L, R, D or G. */
  position: string;
  headshot: string;
  heroImage?: string;
  heightInInches: number;
  heightInCentimeters: number;
  weightInPounds: number;
  weightInKilograms: number;
  /** Like "1997-07-26". */
  birthDate: string;
  birthCity: LocalizedString;
  birthStateProvince?: LocalizedString;
  /** 3 letter country code, like "CAN". */
  birthCountry: string;
  shootsCatches: string;
  draftDetails?: PlayerDraftDetails;
  /** The latest season the player has stats for. Missing for a player who has never played an NHL game. */
  featuredStats?: PlayerFeaturedStats;
  /**
   * The player's totals in every league and season, a row per team for a traded season. Only used to count the NHL
   * regular seasons, so the career card's skeleton has a row for each before the stats load.
   */
  seasonTotals?: PlayerSeasonTotal[];
}

/**
 * One row of the landing's seasonTotals. Only the fields that tell an NHL regular season apart are modeled.
 */
export interface PlayerSeasonTotal {
  /** Like 20252026. */
  season: number;
  /** Like "NHL" or "AHL". */
  leagueAbbrev: string;
  /** 2 for the regular season, 3 for the playoffs. */
  gameTypeId: number;
}

/**
 * The player's latest season, with its totals and the career totals. Only the season is used: the stats themselves
 * come from the stats API (/api/nhl-stats/player/{id}), which also has hits and combines a traded season.
 */
export interface PlayerFeaturedStats {
  /** The season ID, like 20252026. */
  season: number;
  regularSeason?: PlayerFeaturedStatsSplit;
  playoffs?: PlayerFeaturedStatsSplit;
}

export interface PlayerFeaturedStatsSplit {
  /** The season's totals. */
  subSeason: PlayerFeaturedStatsTotals;
  career: PlayerFeaturedStatsTotals;
}

/**
 * Skater or goalie totals. Which fields are set depends on the player's position.
 */
export interface PlayerFeaturedStatsTotals {
  gamesPlayed: number;
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  pim?: number;
  shots?: number;
  wins?: number;
  losses?: number;
  otLosses?: number;
  shutouts?: number;
  goalsAgainstAvg?: number;
  /** 0 to 1. */
  savePctg?: number;
}

export interface PlayerDraftDetails {
  year: number;
  teamAbbrev: string;
  round: number;
  pickInRound: number;
  overallPick: number;
}
