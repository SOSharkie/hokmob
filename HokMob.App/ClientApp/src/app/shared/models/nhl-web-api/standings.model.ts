import {LocalizedString} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of standings/now or standings/{YYYY-MM-DD}.
 */
export interface StandingsResponse {
  wildCardIndicator: boolean;
  standingsDateTimeUtc: string;
  /** Flat list of all teams. Group and rank on the client using the *Sequence fields. */
  standings: StandingsTeam[];
}

/**
 * A standings row. Has no team ID, so look it up from teamAbbrev.default.
 */
export interface StandingsTeam {
  seasonId: number;
  date: string;
  teamAbbrev: LocalizedString;
  /** Full name, like "Winnipeg Jets". */
  teamName: LocalizedString;
  teamCommonName: LocalizedString;
  placeName: LocalizedString;
  teamLogo: string;
  conferenceAbbrev: string;
  conferenceName: string;
  divisionAbbrev: string;
  divisionName: string;
  leagueSequence: number;
  conferenceSequence: number;
  divisionSequence: number;
  wildcardSequence: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  pointPctg: number;
  regulationWins: number;
  regulationPlusOtWins: number;
  goalFor: number;
  goalAgainst: number;
  goalDifferential: number;
  streakCode?: string;
  streakCount?: number;
  /** x, y, z, p, or e (eliminated). Missing when nothing is clinched. */
  clinchIndicator?: string;
  l10Wins: number;
  l10Losses: number;
  l10OtLosses: number;
}
