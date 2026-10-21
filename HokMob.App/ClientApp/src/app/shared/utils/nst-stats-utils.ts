import {NstGameStats, NstPlayerGameStats} from "@shared/models/natural-stat-trick/nst-game-stats.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {PeriodUtils} from "@shared/utils/period-utils";

/**
 * Helpers for the Corsi and expected goals (xG) from Natural Stat Trick (NaturalStatTrickService).
 */
export class NstStatsUtils {

  /**
   * The public Natural Stat Trick game page, credited where its stats are shown: game.php?season=20262027&game=20010 for
   * game 2026020010. Empty without a game ID.
   */
  public static getGamePageUrl(gameId: number | string): string {
    const id = String(gameId ?? "");
    if (!/^\d{10}$/.test(id)) {
      return "";
    }
    const startYear = Number(id.substring(0, 4));
    return "https://www.naturalstattrick.com/game.php?season=" + startYear + (startYear + 1) + "&game=" +
        Number(id.substring(4));
  }

  /**
   * The share of the shot attempts that were for, like "55.9%", or "-" when there were none (or a count is missing).
   */
  public static getCorsiPercentage(corsiFor: number, corsiAgainst: number): string {
    const percentage = NstStatsUtils.getCorsiShare(corsiFor, corsiAgainst);
    return percentage === undefined ? "-" : (percentage * 100).toFixed(1) + "%";
  }

  /**
   * The share of the shot attempts that were for, from 0 to 1, or undefined when there were none.
   */
  public static getCorsiShare(corsiFor: number, corsiAgainst: number): number {
    if (corsiFor == null || corsiAgainst == null || corsiFor + corsiAgainst <= 0) {
      return undefined;
    }
    return corsiFor / (corsiFor + corsiAgainst);
  }

  /**
   * Expected goals to two decimals, like "3.84", or "-" when missing.
   */
  public static formatExpectedGoals(expectedGoals: number): string {
    return expectedGoals == null ? "-" : expectedGoals.toFixed(2);
  }

  /**
   * How far the stats of a game NST hasn't marked final go, like "2nd 12:34", or "the 1st" (or "OT") once that period
   * is over. NST runs a few minutes behind a live game, so its numbers are credited with this. Empty once the game is
   * final on NST, or when its page doesn't say.
   *
   * @param stats - The game's NST stats.
   * @param gameType - The game type: a regular season or preseason overtime is 5 minutes, a playoff one 20.
   */
  public static getProgressLabel(stats: NstGameStats, gameType: NhlGameTypeEnum): string {
    if (!stats || stats.isFinal || !(stats.period > 0) || !stats.timeInPeriod) {
      return "";
    }
    const isOvertime = stats.period > 3;
    const periodLabel = PeriodUtils.getLabel({
      number: stats.period,
      periodType: isOvertime ? NhlPeriodTypeEnum.OVERTIME : NhlPeriodTypeEnum.REGULATION,
      maxRegulationPeriods: 3
    });
    const periodLength = isOvertime && gameType !== NhlGameTypeEnum.PLAYOFFS ? "5:00" : "20:00";
    if (stats.timeInPeriod === periodLength) {
      return isOvertime ? periodLabel : "the " + periodLabel;
    }
    return periodLabel + " " + stats.timeInPeriod;
  }

  /**
   * Whether a moment of the game is past how far the stats of a game NST hasn't marked final go, so NST hasn't got
   * to a shot taken then yet. False once the game is final on NST, or when its page doesn't say how far it goes.
   *
   * @param stats - The game's NST stats.
   * @param period - The period number, 4 for the first overtime.
   * @param timeInPeriod - The time elapsed in the period, like "04:12" (play-by-play) or "4:12".
   */
  public static isPending(stats: NstGameStats, period: number, timeInPeriod: string): boolean {
    if (!stats || stats.isFinal || !(stats.period > 0) || period == null) {
      return false;
    }
    if (period !== stats.period) {
      return period > stats.period;
    }
    return NstStatsUtils.toSeconds(timeInPeriod) > NstStatsUtils.toSeconds(stats.timeInPeriod);
  }

  /**
   * A skater's stats in the game, found by NHL player ID in either team. Undefined without stats or for a goalie.
   */
  public static findPlayer(stats: NstGameStats, playerId: number): NstPlayerGameStats {
    if (!stats || playerId == null) {
      return undefined;
    }
    return [...(stats.homeTeam?.players ?? []), ...(stats.awayTeam?.players ?? [])]
        .find(player => player.playerId === playerId);
  }

  /**
   * "12:34" in seconds, or NaN when it isn't a time.
   */
  private static toSeconds(time: string): number {
    const match = /^(\d+):(\d\d)$/.exec(time ?? "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  }
}
