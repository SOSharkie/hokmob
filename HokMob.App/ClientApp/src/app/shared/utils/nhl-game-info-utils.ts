import {NhlSeriesSummaryModel} from "@shared/models/nhl-playoffs/nhl-series-summary.model";
import {NhlGameStatusModel} from "@shared/models/nhl-general/nhl-game-status.model";

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

  public static isFutureGame(status: NhlGameStatusModel): boolean {
    return status.abstractGameState === "Preview";
  }

  public static isLiveGame(status: NhlGameStatusModel): boolean {
    return status.abstractGameState === "Live";
  }

  public static isCompletedGame(status: NhlGameStatusModel): boolean {
    return status.abstractGameState === "Final";
  }
}
