import {NstGameStats, NstPlayerGameStats} from "@shared/models/natural-stat-trick/nst-game-stats.model";

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
   * A skater's stats in the game, found by NHL player ID in either team. Undefined without stats or for a goalie.
   */
  public static findPlayer(stats: NstGameStats, playerId: number): NstPlayerGameStats {
    if (!stats || playerId == null) {
      return undefined;
    }
    return [...(stats.homeTeam?.players ?? []), ...(stats.awayTeam?.players ?? [])]
        .find(player => player.playerId === playerId);
  }
}
