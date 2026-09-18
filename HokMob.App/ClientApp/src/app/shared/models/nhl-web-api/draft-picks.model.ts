import {LocalizedString} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of draft/picks/{year}/{round} and draft/picks/now (the latest draft's round 1). A year without picks yet
 * (like 2027 before its draft) answers 404.
 */
export interface DraftPicksResponse {
  draftYear: number;
  /** Every draft year, oldest first (1979 on). */
  draftYears: number[];
  /** The rounds of this year's draft, like [1, 2, 3, 4, 5, 6, 7]. */
  selectableRounds: number[];
  /** "over" after the draft. The values before and during a draft aren't verified yet. */
  state: string;
  /** Only on draft/picks/now, like "2026-06-26T23:00:00Z". */
  broadcastStartTimeUTC?: string;
  /** In pick order. */
  picks: DraftPick[];
}

/**
 * One pick. Picks have no player ID or stats: match them to /api/nhl-stats/draft rows by overall pick.
 */
export interface DraftPick {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: number;
  teamAbbrev: string;
  /** The team's full name that year, like "Arizona Coyotes". */
  teamName: LocalizedString;
  teamCommonName: LocalizedString;
  teamPlaceNameWithPreposition: LocalizedString;
  displayAbbrev: LocalizedString;
  /** The team's logo that year, like ".../EDM_20112012-20162017_light.svg". */
  teamLogoLight: string;
  teamLogoDark: string;
  /** The teams that held the pick, like "CAR-NYR-CGY-WSH", or just the picking team. */
  teamPickHistory: string;
  /** Missing on a forfeited pick. */
  firstName?: LocalizedString;
  /** "Forfeited" on a forfeited pick. */
  lastName: LocalizedString;
  /** C, LW, RW, D, G, F (2006–2011) or a combination like "C/LW". Missing on a forfeited pick. */
  positionCode?: string;
  countryCode?: string;
  /** In inches. */
  height?: number;
  /** In pounds. */
  weight?: number;
  amateurLeague?: string;
  amateurClubName?: string;
}
