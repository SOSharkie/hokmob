import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {ClubScheduleGame} from "@shared/models/nhl-web-api/club-schedule.model";

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

  /**
   * Returns a team's last finished games before a game, most recent first, for the team form. Preseason games only
   * count for a preseason game.
   *
   * @param games - Games from the team's club schedule, in any order.
   * @param game - The game the form is shown for, like its landing.
   * @param count - The maximum number of games to return.
   */
  public static getTeamFormGames(games: ClubScheduleGame[],
                                 game: Pick<ClubScheduleGame, "id" | "gameType" | "startTimeUTC">,
                                 count: number = 5): ClubScheduleGame[] {
    if (!game) {
      return [];
    }
    const gameStart = Date.parse(game.startTimeUTC);
    const includePreseason = game.gameType === NhlGameTypeEnum.PRESEASON;
    return (games ?? [])
        .filter(item => item.id !== game.id && NhlGameInfoUtils.isCompletedGame(item.gameState) &&
            (includePreseason || item.gameType !== NhlGameTypeEnum.PRESEASON) &&
            Date.parse(item.startTimeUTC) < gameStart)
        .sort((a, b) => Date.parse(b.startTimeUTC) - Date.parse(a.startTimeUTC))
        .slice(0, count);
  }

  /**
   * Whether the game hasn't started yet (gameState FUT or PRE).
   */
  public static isFutureGame(gameState: NhlGameStateEnum): boolean {
    return gameState === NhlGameStateEnum.FUTURE || gameState === NhlGameStateEnum.PREGAME;
  }

  /**
   * Whether the game is in progress (gameState LIVE or CRIT).
   *
   * TODO: CRIT (the last minutes of a close game) hasn't been seen in a captured response yet. Confirm it during a live
   *  game (see docs/nhl-api-migration-plan.md, section 10).
   */
  public static isLiveGame(gameState: NhlGameStateEnum): boolean {
    return gameState === NhlGameStateEnum.LIVE || gameState === NhlGameStateEnum.CRITICAL;
  }

  /**
   * Whether the game is over (gameState FINAL or OFF).
   */
  public static isCompletedGame(gameState: NhlGameStateEnum): boolean {
    return gameState === NhlGameStateEnum.FINAL || gameState === NhlGameStateEnum.OFF;
  }
}
