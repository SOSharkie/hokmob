import {GameClock, GameOutcome, PeriodDescriptor} from "@shared/models/nhl-web-api/common.model";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";

export class PeriodUtils {

  /**
   * Gets the short label for a period, like "1st", "OT", "2OT" or "SO".
   *
   * @param periodDescriptor - The period descriptor from the new NHL API.
   */
  public static getLabel(periodDescriptor: PeriodDescriptor): string {
    if (!periodDescriptor) {
      return "";
    }
    switch (periodDescriptor.periodType) {
      case NhlPeriodTypeEnum.SHOOTOUT:
        return "SO";
      case NhlPeriodTypeEnum.OVERTIME:
        let overtimeNumber = periodDescriptor.number - (periodDescriptor.maxRegulationPeriods || 3);
        return overtimeNumber > 1 ? overtimeNumber + "OT" : "OT";
      default:
        return PeriodUtils.getOrdinal(periodDescriptor.number);
    }
  }

  /**
   * Gets the status label for a completed game: "Final", "OT", "2OT" or "SO".
   *
   * @param gameOutcome - The game outcome from the new NHL API.
   * @param periodDescriptor - The last period of the game, used for the multi-overtime number.
   */
  public static getFinalLabel(gameOutcome: GameOutcome, periodDescriptor: PeriodDescriptor): string {
    let lastPeriodType = gameOutcome?.lastPeriodType ?? periodDescriptor?.periodType;
    switch (lastPeriodType) {
      case NhlPeriodTypeEnum.SHOOTOUT:
        return "SO";
      case NhlPeriodTypeEnum.OVERTIME:
        return periodDescriptor?.periodType === NhlPeriodTypeEnum.OVERTIME ? PeriodUtils.getLabel(periodDescriptor) : "OT";
      default:
        return "Final";
    }
  }

  /**
   * Gets the status label for a live game, like "2nd - 5:32", "End 1st" or "SO".
   *
   * @param periodDescriptor - The current period from the new NHL API.
   * @param clock - The game clock from the new NHL API.
   */
  public static getLiveLabel(periodDescriptor: PeriodDescriptor, clock: GameClock): string {
    if (!periodDescriptor) {
      return "Live";
    }
    let periodLabel = PeriodUtils.getLabel(periodDescriptor);
    if (periodDescriptor.periodType === NhlPeriodTypeEnum.SHOOTOUT || !clock) {
      return periodLabel;
    } else if (clock.inIntermission || clock.timeRemaining === "00:00") {
      return "End " + periodLabel;
    } else {
      return periodLabel + " - " + PeriodUtils.formatTimeRemaining(clock.timeRemaining);
    }
  }

  /**
   * Gets the label of the period after the given one, like "2nd", "OT" or "2OT". Regular season and preseason games
   * have one overtime, then a shootout ("SO").
   *
   * @param periodDescriptor - The current period, like the one that just ended before an intermission.
   * @param gameType - The game type. Only playoff games have more than one overtime.
   */
  public static getNextPeriodLabel(periodDescriptor: PeriodDescriptor, gameType: NhlGameTypeEnum): string {
    if (!periodDescriptor) {
      return "";
    }
    let regulationPeriods = periodDescriptor.maxRegulationPeriods || 3;
    let nextNumber = periodDescriptor.number + 1;
    if (nextNumber <= regulationPeriods) {
      return PeriodUtils.getOrdinal(nextNumber);
    } else if (gameType !== NhlGameTypeEnum.PLAYOFFS && nextNumber > regulationPeriods + 1) {
      return "SO";
    }
    return PeriodUtils.getLabel({
      number: nextNumber,
      periodType: NhlPeriodTypeEnum.OVERTIME,
      maxRegulationPeriods: regulationPeriods
    });
  }

  /**
   * Removes the leading zero from a clock time, like "05:32" to "5:32".
   */
  public static formatTimeRemaining(timeRemaining: string): string {
    if (timeRemaining && timeRemaining.startsWith("0")) {
      return timeRemaining.substring(1);
    }
    return timeRemaining;
  }

  private static getOrdinal(periodNumber: number): string {
    switch (periodNumber) {
      case 1:
        return "1st";
      case 2:
        return "2nd";
      case 3:
        return "3rd";
      default:
        return periodNumber + "th";
    }
  }
}
