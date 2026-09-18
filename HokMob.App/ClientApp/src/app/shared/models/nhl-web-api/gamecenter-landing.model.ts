import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {
  GameClock,
  GameOutcome,
  GamecenterTeam,
  LocalizedString,
  PeriodDescriptor,
  TvBroadcast
} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of gamecenter/{id}/landing.
 */
export interface GameLanding {
  id: number;
  season: number;
  gameType: NhlGameTypeEnum;
  gameDate: string;
  venue: LocalizedString;
  venueLocation: LocalizedString;
  startTimeUTC: string;
  easternUTCOffset: string;
  venueUTCOffset: string;
  venueTimezone: string;
  tvBroadcasts: TvBroadcast[];
  gameState: NhlGameStateEnum;
  gameScheduleState: NhlGameScheduleStateEnum;
  homeTeam: GamecenterTeam;
  awayTeam: GamecenterTeam;
  shootoutInUse: boolean;
  otInUse: boolean;
  maxPeriods: number;
  regPeriods: number;
  periodDescriptor?: PeriodDescriptor;
  clock?: GameClock;
  gameOutcome?: GameOutcome;
  summary?: GameLandingSummary;
}

export interface GameLandingSummary {
  scoring: GameLandingScoringPeriod[];
  threeStars: GameLandingStar[];
  penalties: GameLandingPenaltyPeriod[];
}

export interface GameLandingScoringPeriod {
  periodDescriptor: PeriodDescriptor;
  goals: GameLandingGoal[];
}

export interface GameLandingGoal {
  eventId: number;
  situationCode: string;
  strength: string;
  playerId: number;
  firstName: LocalizedString;
  lastName: LocalizedString;
  name: LocalizedString;
  teamAbbrev: LocalizedString;
  headshot: string;
  goalsToDate: number;
  awayScore: number;
  homeScore: number;
  timeInPeriod: string;
  shotType: string;
  goalModifier: string;
  isHome: boolean;
  assists: GameLandingAssist[];
  /**
   * The goal's highlight video, as a Brightcove video ID (NhlVideoUtils.getGoalHighlightVideo builds the embeddable
   * player URL from it). Missing until NHL.com posts the clip, which can take a while after the goal, so live games
   * and recent goals may not have one yet.
   */
  highlightClip?: number;
  highlightClipFr?: number;
  /** The clip's NHL.com page, like "https://nhl.com/video/vgk-car-ehlers-scores-goal-against-carter-hart-6397360131112". */
  highlightClipSharingUrl?: string;
  highlightClipSharingUrlFr?: string;
  /** A shorter alternate clip, when NHL.com has posted one. */
  discreteClip?: number;
  discreteClipFr?: number;
  pptReplayUrl?: string;
}

export interface GameLandingAssist {
  playerId: number;
  firstName: LocalizedString;
  lastName: LocalizedString;
  name: LocalizedString;
  assistsToDate: number;
  sweaterNumber: number;
}

export interface GameLandingStar {
  star: number;
  playerId: number;
  teamAbbrev: string;
  headshot: string;
  name: LocalizedString;
  sweaterNo: number;
  position: string;
  goals?: number;
  assists?: number;
  points?: number;
  goalsAgainstAverage?: number;
  savePctg?: number;
}

export interface GameLandingPenaltyPeriod {
  periodDescriptor: PeriodDescriptor;
  penalties: GameLandingPenalty[];
}

/**
 * Penalty summary. Has no player IDs; use play-by-play penalty plays when IDs are needed.
 */
export interface GameLandingPenalty {
  timeInPeriod: string;
  type: string;
  duration: number;
  descKey: string;
  teamAbbrev: LocalizedString;
  committedByPlayer?: GameLandingPenaltyPlayer;
  drawnBy?: GameLandingPenaltyPlayer;
}

export interface GameLandingPenaltyPlayer {
  firstName: LocalizedString;
  lastName: LocalizedString;
  sweaterNumber: number;
}
