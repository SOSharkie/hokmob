import {NhlGameStatusModel} from "@shared/models/nhl-general/nhl-game-status.model";
import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";

export class NhlGameInfoUtils {

  /**
   * Returns the league label for a game, like "NHL Regular Season" or "Stanley Cup Final: Tied 2-2". Before a playoff
   * series starts, the matchup ("CAR vs VGK") is shown instead of the status.
   *
   * @param gameType - The game type from the new NHL API.
   * @param seriesStatus - The playoff series status from the score response, if loaded.
   */
  public static getGameDescription(gameType: NhlGameTypeEnum, seriesStatus: SeriesStatus): string {
    switch (gameType) {
      case NhlGameTypeEnum.PLAYOFFS: {
        if (!seriesStatus) {
          return "NHL Playoffs";
        }
        let status = NhlGameInfoUtils.getSeriesStatusShort(seriesStatus);
        if (status === "(0-0)") {
          status = seriesStatus.topSeedTeamAbbrev + " vs " + seriesStatus.bottomSeedTeamAbbrev;
        }
        return (seriesStatus.seriesTitle || "NHL Playoffs") + ": " + status;
      }
      case NhlGameTypeEnum.PRESEASON:
        return "NHL Preseason";
      case NhlGameTypeEnum.REGULAR_SEASON:
        return "NHL Regular Season";
      default:
        return "NHL";
    }
  }

  /**
   * Returns a short playoff series status, like "CAR leads 3-1", "Tied 2-2" or "CAR wins 4-2", or "(0-0)" before the
   * series starts.
   *
   * @param seriesStatus - The series status from the new NHL API score response.
   */
  public static getSeriesStatusShort(seriesStatus: SeriesStatus): string {
    if (!seriesStatus) {
      return "";
    }
    let topSeedWins = seriesStatus.topSeedWins ?? 0;
    let bottomSeedWins = seriesStatus.bottomSeedWins ?? 0;
    if (topSeedWins === bottomSeedWins) {
      return topSeedWins === 0 ? "(0-0)" : "Tied " + topSeedWins + "-" + bottomSeedWins;
    }
    let leaderAbbrev = topSeedWins > bottomSeedWins ? seriesStatus.topSeedTeamAbbrev : seriesStatus.bottomSeedTeamAbbrev;
    let leaderWins = Math.max(topSeedWins, bottomSeedWins);
    let trailerWins = Math.min(topSeedWins, bottomSeedWins);
    let verb = leaderWins >= seriesStatus.neededToWin ? " wins " : " leads ";
    return leaderAbbrev + verb + leaderWins + "-" + trailerWins;
  }

  // The NhlGameStatusModel argument is deprecated. It's only kept for pages not yet migrated to the new NHL API
  // (see docs/nhl-api-migration-plan.md); remove it once they are.

  /**
   * Whether the game hasn't started yet (gameState FUT or PRE).
   */
  public static isFutureGame(gameState: NhlGameStateEnum | NhlGameStatusModel): boolean {
    if (typeof gameState === "object") {
      return gameState?.abstractGameState === "Preview";
    }
    return gameState === NhlGameStateEnum.FUTURE || gameState === NhlGameStateEnum.PREGAME;
  }

  /**
   * Whether the game is in progress (gameState LIVE or CRIT).
   */
  public static isLiveGame(gameState: NhlGameStateEnum | NhlGameStatusModel): boolean {
    if (typeof gameState === "object") {
      return gameState?.abstractGameState === "Live";
    }
    return gameState === NhlGameStateEnum.LIVE || gameState === NhlGameStateEnum.CRITICAL;
  }

  /**
   * Whether the game is over (gameState FINAL or OFF).
   */
  public static isCompletedGame(gameState: NhlGameStateEnum | NhlGameStatusModel): boolean {
    if (typeof gameState === "object") {
      return gameState?.abstractGameState === "Final";
    }
    return gameState === NhlGameStateEnum.FINAL || gameState === NhlGameStateEnum.OFF;
  }
}
