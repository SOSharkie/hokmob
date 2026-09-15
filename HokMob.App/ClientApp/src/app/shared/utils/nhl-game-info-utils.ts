import {NhlSeriesSummaryModel} from "@shared/models/nhl-playoffs/nhl-series-summary.model";
import {NhlGameStatusModel} from "@shared/models/nhl-general/nhl-game-status.model";
import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";

export class NhlGameInfoUtils {

  /**
   * Returns a formatted game description.
   *
   * @param gameType - The type of game (R: regular season, P: playoffs, PR, preseason).
   * @param playoffRoundNum - The round number for the playoffs.
   * @param conferenceName - The name of the conference the game takes place in.
   * @param seriesSummary - The playoff series summary.
   * @param matchupName - The matchup name (ex: SJS vs LAK).
   */
  public static getNhlGameDescription(gameType: string, playoffRoundNum: number, conferenceName: string,
                                      seriesSummary: NhlSeriesSummaryModel, matchupName: string): string {
    switch (gameType) {
      case "P":
        if (seriesSummary) {
          let conference = conferenceName === "Eastern" ? "East" : "West";
          let status = seriesSummary.seriesStatus ? seriesSummary.seriesStatus : matchupName ? matchupName : "TBD";
          switch (playoffRoundNum) {
            case 1:
              return conference + " Round 1: " + status;
            case 2:
              return conference + " Semifinals: " + status;
            case 3:
              return conference + " Finals: " + status;
            case 4:
              return "Stanley Cup Finals: " + status;
            default:
              return "NHL Playoffs: " + status;
          }
        } else {
          return "NHL Playoffs Round " + playoffRoundNum;
        }
      case "PR":
        return "NHL Preseason"
      case "A":
        return "NHL All-Star Game"
      default:
        return "NHL Regular Season"
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
