import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {
  HistoryGame,
  HistoryPlayer,
  PositionGroup,
  RatedGame,
  RatedSeason,
  SeasonHistory,
  SeasonHistoryRows
} from "@shared/models/nhl-history/season-history.model";
import {GoalieGameStats, SkaterGameStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {StatsUtils} from "@shared/utils/stats-utils";

/**
 * A season the history page has data for.
 */
export interface HistorySeasonOption {
  season: number;
  gameType: number;
}

/**
 * The history page's data: a finished season's per game stat lines, preloaded into src/assets/history by
 * build-season-data.js, and rated in the browser with the same formulas as the game and player pages. The file is only
 * loaded by the history page, so it stays out of the main bundle.
 */
@Injectable()
export class SeasonHistoryService {

  /** The seasons with a file in src/assets/history, newest first. */
  public static readonly seasons: HistorySeasonOption[] = [
    {season: 20252026, gameType: NhlGameTypeEnum.REGULAR_SEASON}
  ];

  /** The top of the rating scale, where a rating is capped. */
  private static readonly maxRating = 10;

  private readonly historyUrl = "assets/history/";

  /** Each season's request and rating, shared by every caller for the rest of the session. */
  private readonly ratedSeasons = new Map<string, Promise<RatedSeason>>();

  constructor(private http: HttpClient) { }

  /**
   * Gets a season's every game rating. The file is loaded and rated once, and kept for the session; a failed load
   * isn't kept, so the next call tries again.
   *
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season (the default), 3 for the playoffs.
   */
  public getSeasonHistory(season: number, gameType: number = NhlGameTypeEnum.REGULAR_SEASON): Promise<RatedSeason> {
    const key = season + "-" + gameType;
    let ratedSeason = this.ratedSeasons.get(key);
    if (!ratedSeason) {
      ratedSeason = new Promise((resolve, reject) => {
        return this.http.get<SeasonHistory>(this.historyUrl + key + ".json").subscribe({
          next: (history) => {
            try {
              resolve(SeasonHistoryService.rateSeason(history));
            } catch (error) {
              console.error(error);
              reject(error);
            }
          },
          error: (error) => {
            console.error(error);
            reject(error);
          }
        });
      });
      this.ratedSeasons.set(key, ratedSeason);
      ratedSeason.catch(() => this.ratedSeasons.delete(key));
    }
    return ratedSeason;
  }

  /**
   * Rates every skater and goalie row of a season's history in one pass. Each row is turned into the stats API game
   * row it came from and rated by StatsUtils.calculateSkaterGameRating / calculateGoalieGameRating, like the player
   * page's recent games. Goalies who faced no shots are left out. A game rated 10 also gets its uncapped rating.
   *
   * @param history - The season's history file.
   */
  public static rateSeason(history: SeasonHistory): RatedSeason {
    const gameColumns = history.games;
    const games: HistoryGame[] = gameColumns.id.map((id, index) => ({
      id,
      date: gameColumns.date[index],
      homeTeamId: gameColumns.homeTeamId[index],
      awayTeamId: gameColumns.awayTeamId[index],
      homeScore: gameColumns.homeScore[index],
      awayScore: gameColumns.awayScore[index]
    }));
    const playerColumns = history.players;
    const players: HistoryPlayer[] = playerColumns.id.map((id, index) => ({
      id,
      name: playerColumns.name[index],
      position: playerColumns.position[index]
    }));

    const ratedGames: RatedGame[] = [];
    const toRatedGame = (row: number, rows: SeasonHistoryRows, rating: number, uncappedRating: () => number,
                         timeOnIce: number): RatedGame => {
      const player = players[rows.player[row]];
      const game = games[rows.game[row]];
      const isHome = rows.home[row] === 1;
      return {
        player,
        game,
        teamId: isHome ? game.homeTeamId : game.awayTeamId,
        opponentId: isHome ? game.awayTeamId : game.homeTeamId,
        position: SeasonHistoryService.getPositionGroup(player.position),
        rating,
        // Only worked out for the few 10s
        uncappedRating: rating >= SeasonHistoryService.maxRating ? uncappedRating() : undefined,
        timeOnIce
      };
    };

    const skaters = history.skaters;
    for (let row = 0; row < skaters.player.length; row++) {
      // Only the fields the rating reads
      const game = {
        playerId: players[skaters.player[row]].id,
        positionCode: players[skaters.player[row]].position,
        timeOnIcePerGame: skaters.timeOnIcePerGame[row],
        goals: skaters.goals[row],
        assists: skaters.assists[row],
        plusMinus: skaters.plusMinus[row],
        penaltyMinutes: skaters.penaltyMinutes[row],
        ppGoals: skaters.ppGoals[row],
        shots: skaters.shots[row],
        faceoffWinPct: skaters.faceoffWinPct[row],
        totalPrimaryAssists: skaters.totalPrimaryAssists[row],
        totalSecondaryAssists: skaters.totalSecondaryAssists[row],
        ppAssists: skaters.ppAssists[row],
        hits: skaters.hits[row],
        blockedShots: skaters.blockedShots[row],
        takeaways: skaters.takeaways[row],
        giveaways: skaters.giveaways[row],
        totalFaceoffs: skaters.totalFaceoffs[row],
        penaltiesDrawn: skaters.penaltiesDrawn[row]
      } as SkaterGameStats;
      ratedGames.push(toRatedGame(row, skaters, StatsUtils.calculateSkaterGameRating(game),
          () => StatsUtils.getSkaterGameRawRating(game), game.timeOnIcePerGame));
    }

    const goalies = history.goalies;
    for (let row = 0; row < goalies.player.length; row++) {
      const shotsAgainst = goalies.evShotsAgainst[row] + goalies.ppShotsAgainst[row] + goalies.shShotsAgainst[row];
      if (shotsAgainst === 0) {
        continue;
      }
      const saves = goalies.evSaves[row] + goalies.ppSaves[row] + goalies.shSaves[row];
      const game = {
        playerId: players[goalies.player[row]].id,
        timeOnIce: goalies.timeOnIce[row],
        evSaves: goalies.evSaves[row],
        evShotsAgainst: goalies.evShotsAgainst[row],
        ppSaves: goalies.ppSaves[row],
        ppShotsAgainst: goalies.ppShotsAgainst[row],
        shSaves: goalies.shSaves[row],
        shShotsAgainst: goalies.shShotsAgainst[row],
        saves,
        shotsAgainst,
        savePct: saves / shotsAgainst
      } as GoalieGameStats;
      ratedGames.push(toRatedGame(row, goalies, StatsUtils.calculateGoalieGameRating(game),
          () => StatsUtils.getGoalieGameRawRating(game), game.timeOnIce));
    }
    ratedGames.sort((gameA, gameB) => gameA.game.id - gameB.game.id);

    return {season: history.season, gameType: history.gameType, players, games, ratedGames};
  }

  /**
   * The position group of a position code: D and G are their own, and C, L and R are forwards.
   */
  public static getPositionGroup(position: string): PositionGroup {
    return position === "D" || position === "G" ? position : "F";
  }
}
