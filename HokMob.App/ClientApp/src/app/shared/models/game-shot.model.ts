import {PeriodDescriptor} from "@shared/models/nhl-web-api/common.model";

/**
 * A shot on goal or a goal from the play-by-play, for the shot maps (ShotMapUtils.getShots). Missed and blocked shots
 * aren't shot map shots.
 */
export interface GameShot {
  eventId: number;
  sortOrder: number;
  teamId: number;
  isHomeTeam: boolean;
  /** The shooter, or the scorer of a goal. */
  shooterId: number;
  /** The goalie in net, or undefined for a shot into an empty net. */
  goalieId: number;
  /** The shooter's full name, from the play-by-play's roster, or empty without a roster spot. */
  shooterName: string;
  isGoal: boolean;
  /** Like "wrist", "snap" or "tip-in" (ShotMapUtils.getShotTypeLabel). */
  shotType: string;
  periodDescriptor: PeriodDescriptor;
  /** The time elapsed in the period, like "04:12". */
  timeInPeriod: string;
  /**
   * Where the shot was taken from, in feet from center ice, turned so the shooter attacks the net at x = 89 (its goal
   * line). Negative x is the shooter's own half. y is across the rink, -42.5 to 42.5, turned with x.
   */
  x: number;
  y: number;
  /**
   * Natural Stat Trick's xG for the shot, or undefined without NST's stats for the game, or for a shot NST doesn't list
   * (a goalie's, or one from behind the net).
   */
  expectedGoals?: number;
  /**
   * Whether the shot has no xG because Natural Stat Trick, which runs a few minutes behind a live game, hasn't got to it
   * yet (NstStatsUtils.isPending).
   */
  expectedGoalsPending?: boolean;
}
