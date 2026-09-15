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
}

export interface PlayerDraftDetails {
  year: number;
  teamAbbrev: string;
  round: number;
  pickInRound: number;
  overallPick: number;
}
