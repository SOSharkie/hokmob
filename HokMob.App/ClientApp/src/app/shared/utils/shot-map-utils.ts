import {Play, PlayByPlay} from "@shared/models/nhl-web-api/play-by-play.model";
import {GameShot} from "@shared/models/game-shot.model";
import {NstGameStats, NstShot} from "@shared/models/natural-stat-trick/nst-game-stats.model";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {NhlPlayTypeEnum} from "@shared/enums/nhl-play-type.enum";
import {PeriodUtils} from "@shared/utils/period-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";

/**
 * Helpers for the game page's shot maps: the shots on goal and goals of the play-by-play, turned so each shooter
 * attacks the same end.
 */
export class ShotMapUtils {

  /**
   * Shot types whose descKey doesn't read well capitalized with its hyphens replaced by spaces.
   */
  private static readonly shotTypeLabels: Record<string, string> = {
    "tip-in": "Tip-in",
    "wrap-around": "Wrap-around",
    "deflected": "Deflection",
    "bat": "Batted",
    "between-legs": "Between the legs"
  };

  /**
   * Returns the game's shots on goal and goals, in play order, turned so every shooter attacks the net at x = 89. The
   * teams switch ends each period (homeTeamDefendingSide), and a shot taken towards the left end (negative x) is
   * turned half a turn, so it keeps its side of the net. The shootout, and plays without a shooter or coordinates, are
   * left out. Each shot gets its xG from Natural Stat Trick's shots, when they're given (addExpectedGoals).
   *
   * @param playByPlay - The game's play-by-play.
   * @param nstStats - The game's NST stats, for each shot's xG.
   */
  public static getShots(playByPlay: PlayByPlay, nstStats?: NstGameStats): GameShot[] {
    const homeTeamId = playByPlay?.homeTeam?.id;
    const rosterSpots = PlayByPlayUtils.getRosterSpotMap(playByPlay);
    const fullName = (playerId: number) => PlayByPlayUtils.getFullName(rosterSpots.get(playerId));
    const shots: GameShot[] = (playByPlay?.plays ?? [])
        .filter(play => ShotMapUtils.isShot(play))
        .sort((playA, playB) => playA.sortOrder - playB.sortOrder)
        .map(play => {
          const details = play.details;
          const isHomeTeam = details.eventOwnerTeamId === homeTeamId;
          const isGoal = play.typeDescKey === NhlPlayTypeEnum.GOAL;
          const turn = ShotMapUtils.attacksLeftEnd(play, isHomeTeam) ? -1 : 1;
          const shooterId = isGoal ? details.scoringPlayerId : details.shootingPlayerId;
          return {
            eventId: play.eventId,
            sortOrder: play.sortOrder,
            teamId: details.eventOwnerTeamId,
            isHomeTeam,
            shooterId,
            goalieId: details.goalieInNetId,
            shooterName: fullName(shooterId),
            isGoal,
            shotType: details.shotType,
            periodDescriptor: play.periodDescriptor,
            timeInPeriod: play.timeInPeriod,
            x: details.xCoord * turn || 0,
            y: details.yCoord * turn || 0
          };
        });
    ShotMapUtils.addExpectedGoals(shots, nstStats);
    return shots;
  }

  /**
   * Gives each shot the xG of its Natural Stat Trick shot: the one by the same shooter, of the same type (goal or shot
   * on goal), at the same period and time. A shooter's shots in the same second are paired up nearest to the net
   * first, by NST's distance and the shot's own. A shot NST doesn't list keeps no xG: in 13 games checked that was only
   * goalies' shots and one from behind the net. While NST is behind a live game, a shot after how far its stats go is
   * marked pending instead.
   */
  private static addExpectedGoals(shots: GameShot[], nstStats: NstGameStats): void {
    const nstShotsByKey = new Map<string, NstShot[]>();
    (nstStats?.shots ?? []).filter(nstShot => nstShot?.type !== "miss").forEach(nstShot => {
      const key = [nstShot.playerId, nstShot.period, nstShot.time, nstShot.type === "goal"].join("|");
      nstShotsByKey.set(key, [...(nstShotsByKey.get(key) ?? []), nstShot]);
    });
    if (nstShotsByKey.size === 0) {
      return;
    }
    const shotsByKey = new Map<string, GameShot[]>();
    shots.forEach(shot => {
      const time = PeriodUtils.formatTimeRemaining(shot.timeInPeriod);
      const key = [shot.shooterId, shot.periodDescriptor?.number, time, shot.isGoal].join("|");
      shotsByKey.set(key, [...(shotsByKey.get(key) ?? []), shot]);
    });
    const distance = (shot: GameShot) => Math.hypot(89 - shot.x, shot.y);
    shotsByKey.forEach((keyShots, key) => {
      const keyNstShots = [...(nstShotsByKey.get(key) ?? [])].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
      [...keyShots].sort((a, b) => distance(a) - distance(b)).forEach((shot, index) => {
        shot.expectedGoals = keyNstShots[index]?.expectedGoals ?? undefined;
        shot.expectedGoalsPending = shot.expectedGoals === undefined &&
            NstStatsUtils.isPending(nstStats, shot.periodDescriptor?.number, shot.timeInPeriod);
      });
    });
  }

  /**
   * Returns a player's shots for the player game dialog: the shots a goalie faced, or a skater's own shots.
   *
   * @param shots - The game's shots (getShots).
   * @param playerId - The player.
   * @param isGoalie - Whether the player played in goal.
   */
  public static getPlayerShots(shots: GameShot[], playerId: number, isGoalie: boolean): GameShot[] {
    return (shots ?? []).filter(shot => playerId != null && (isGoalie ? shot.goalieId : shot.shooterId) === playerId);
  }

  /**
   * Returns the shot type's label, like "Wrist", "Tip-in" or "Deflection", or "Unknown" without one.
   */
  public static getShotTypeLabel(shotType: string): string {
    if (!shotType) {
      return "Unknown";
    }
    return ShotMapUtils.shotTypeLabels[shotType] ??
        shotType.charAt(0).toUpperCase() + shotType.substring(1).replace(/-/g, " ");
  }

  /**
   * Returns when the shot was taken, like "2nd 4:12" or "OT 0:45", with the time elapsed in the period.
   */
  public static getTimeLabel(shot: GameShot): string {
    return [PeriodUtils.getLabel(shot?.periodDescriptor), PeriodUtils.formatTimeRemaining(shot?.timeInPeriod)]
        .filter(label => !!label).join(" ");
  }

  private static isShot(play: Play): boolean {
    const isShotType = play?.typeDescKey === NhlPlayTypeEnum.GOAL || play?.typeDescKey === NhlPlayTypeEnum.SHOT_ON_GOAL;
    const details = play?.details;
    return isShotType && play.periodDescriptor?.periodType !== NhlPeriodTypeEnum.SHOOTOUT &&
        details?.eventOwnerTeamId != null && details.xCoord != null && details.yCoord != null &&
        (details.scoringPlayerId ?? details.shootingPlayerId) != null;
  }

  /**
   * Whether the shot was taken towards the left end (negative x): the end the shooting team doesn't defend. Without
   * homeTeamDefendingSide it goes by the half the shot was taken from, since most shots come from the attacking half.
   */
  private static attacksLeftEnd(play: Play, isHomeTeam: boolean): boolean {
    const homeSide = play.homeTeamDefendingSide;
    if (homeSide !== "left" && homeSide !== "right") {
      return play.details.xCoord < 0;
    }
    // The team defending the right end attacks the left one
    return (homeSide === "right") === isHomeTeam;
  }
}
