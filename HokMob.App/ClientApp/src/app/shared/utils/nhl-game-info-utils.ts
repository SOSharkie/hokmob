import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {
  ClubScheduleGame,
  ClubScheduleTeam,
  TeamFormReference
} from "@shared/models/nhl-web-api/club-schedule.model";
import {ScoreGame, ScoreTeam} from "@shared/models/nhl-web-api/score.model";

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
   * Returns a short label for a game that is not part of the regular season, like "PRE" or "PLAYOFFS", so a
   * scorecard or a form row can be told apart at a glance. A regular season game needs no label and returns an
   * empty string.
   *
   * @param gameType - The game type from the new NHL API.
   */
  public static getGameTypeLabel(gameType: NhlGameTypeEnum): string {
    switch (gameType) {
      case NhlGameTypeEnum.PRESEASON:
        return "PRE";
      case NhlGameTypeEnum.PLAYOFFS:
        return "PLAYOFFS";
      default:
        return "";
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
   * Returns a team's last finished games before a point in time, most recent first, for the team form. On the game
   * page that point is the game the form leads up to, on the team page it's now. Preseason games only count when the
   * reference is a preseason game.
   *
   * @param games - Games from the team's club schedule, in any order.
   * @param reference - The game the form is shown for (like its landing), or the season and time of a team page.
   * @param count - The maximum number of games to return.
   */
  public static getTeamFormGames(games: ClubScheduleGame[], reference: TeamFormReference,
                                 count: number = 5): ClubScheduleGame[] {
    if (!reference) {
      return [];
    }
    const referenceStart = Date.parse(reference.startTimeUTC);
    const includePreseason = reference.gameType === NhlGameTypeEnum.PRESEASON;
    return (games ?? [])
        .filter(item => item.id !== reference.id && NhlGameInfoUtils.isCompletedGame(item.gameState) &&
            (includePreseason || item.gameType !== NhlGameTypeEnum.PRESEASON) &&
            Date.parse(item.startTimeUTC) < referenceStart)
        .sort((a, b) => Date.parse(b.startTimeUTC) - Date.parse(a.startTimeUTC))
        .slice(0, count);
  }

  /**
   * Returns a team's next games, the ones that aren't over, soonest first.
   *
   * @param games - Games from the team's club schedule, in any order.
   * @param count - The maximum number of games to return.
   */
  public static getUpcomingGames(games: ClubScheduleGame[], count: number = 5): ClubScheduleGame[] {
    return (games ?? [])
        .filter(game => !NhlGameInfoUtils.isCompletedGame(game.gameState))
        .sort((gameA, gameB) => Date.parse(gameA.startTimeUTC) - Date.parse(gameB.startTimeUTC))
        .slice(0, count);
  }

  /**
   * Converts a club schedule game to the score response shape that app-scorecard and the team page's next game
   * expect. The club schedule names teams with a common name and a place name instead of the score response's single
   * name, and has no clock, period or series status: those come from score/{gameDate} for a live game.
   *
   * @param game - A game from a club schedule.
   */
  public static toScoreGame(game: ClubScheduleGame): ScoreGame {
    if (!game) {
      return undefined;
    }
    return {
      ...game,
      homeTeam: NhlGameInfoUtils.toScoreTeam(game.homeTeam),
      awayTeam: NhlGameInfoUtils.toScoreTeam(game.awayTeam)
    };
  }

  private static toScoreTeam(team: ClubScheduleTeam): ScoreTeam {
    return {
      id: team?.id,
      name: team?.commonName,
      abbrev: team?.abbrev,
      score: team?.score,
      logo: team?.logo
    };
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
   *  game (see docs/nhl-api.md, "Live game checks").
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
