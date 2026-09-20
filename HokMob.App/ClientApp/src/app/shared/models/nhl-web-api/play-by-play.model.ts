import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {
  GameClock,
  GameOutcome,
  GameSituation,
  GamecenterTeam,
  LocalizedString,
  PeriodDescriptor
} from "@shared/models/nhl-web-api/common.model";

/**
 * Response of gamecenter/{id}/play-by-play.
 */
export interface PlayByPlay {
  id: number;
  season: number;
  gameType: NhlGameTypeEnum;
  gameDate: string;
  startTimeUTC: string;
  gameState: NhlGameStateEnum;
  gameScheduleState: NhlGameScheduleStateEnum;
  homeTeam: GamecenterTeam;
  awayTeam: GamecenterTeam;
  shootoutInUse: boolean;
  otInUse: boolean;
  maxPeriods: number;
  regPeriods: number;
  displayPeriod: number;
  periodDescriptor?: PeriodDescriptor;
  clock?: GameClock;
  gameOutcome?: GameOutcome;
  situation?: GameSituation;
  plays: Play[];
  rosterSpots: RosterSpot[];
}

export interface Play {
  eventId: number;
  periodDescriptor: PeriodDescriptor;
  timeInPeriod: string;
  timeRemaining: string;
  situationCode?: string;
  homeTeamDefendingSide?: string;
  typeCode: number;
  /** Like "goal", "shot-on-goal", "missed-shot", "blocked-shot", "penalty", "faceoff". */
  typeDescKey: string;
  sortOrder: number;
  details?: PlayDetails;
}

/**
 * Play details. Which fields are set depends on the play type.
 */
export interface PlayDetails {
  eventOwnerTeamId?: number;
  xCoord?: number;
  yCoord?: number;
  zoneCode?: string;
  shotType?: string;
  reason?: string;
  secondaryReason?: string;
  // Faceoff
  winningPlayerId?: number;
  losingPlayerId?: number;
  // Shots
  shootingPlayerId?: number;
  goalieInNetId?: number;
  blockingPlayerId?: number;
  awaySOG?: number;
  homeSOG?: number;
  // Hits, giveaways, takeaways
  hittingPlayerId?: number;
  hitteePlayerId?: number;
  playerId?: number;
  // Goals
  scoringPlayerId?: number;
  scoringPlayerTotal?: number;
  assist1PlayerId?: number;
  assist1PlayerTotal?: number;
  assist2PlayerId?: number;
  assist2PlayerTotal?: number;
  awayScore?: number;
  homeScore?: number;
  // Penalties
  /** Like "MIN" or "MAJ". */
  typeCode?: string;
  /** Like "interference-goalkeeper". */
  descKey?: string;
  duration?: number;
  committedByPlayerId?: number;
  drawnByPlayerId?: number;
  servedByPlayerId?: number;
}

/**
 * A period's goals and penalties, built by PlayByPlayUtils.getKeyEventPeriods (not part of the response).
 */
export interface KeyEventPeriod {
  periodDescriptor: PeriodDescriptor;
  plays: Play[];
}

export interface RosterSpot {
  teamId: number;
  playerId: number;
  firstName: LocalizedString;
  lastName: LocalizedString;
  sweaterNumber: number;
  positionCode: string;
  headshot: string;
}
