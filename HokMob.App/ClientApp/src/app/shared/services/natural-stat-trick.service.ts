import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {NstGameStats} from "@shared/models/natural-stat-trick/nst-game-stats.model";
import {NstTeamGameStats, NstTeamGamesResponse} from "@shared/models/natural-stat-trick/nst-team-games.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";

/**
 * Corsi and expected goals (xG) from Natural Stat Trick, through the backend (/api/nst/*), which holds the access key
 * and caches the pages, since NST allows only so many a minute.
 */
@Injectable()
export class NaturalStatTrickService {

  private readonly nstGameUrl = "/api/nst/game/";

  private readonly nstTeamGamesUrl = "/api/nst/team-games";

  constructor(private http: HttpClient) { }

  /**
   * Gets a game's Corsi and xG for both teams and each skater. Resolves undefined when NST has no stats for the game
   * (yet), which is normal for a game that just ended. Rejects when they can't be loaded, including when the backend
   * has no key or is pausing for NST's limits (503).
   *
   * @param gameId - The game ID, like "2026020010".
   */
  public getGameStats(gameId: number | string): Promise<NstGameStats> {
    return new Promise((resolve, reject) => {
      return this.http.get<NstGameStats>(this.nstGameUrl + gameId).subscribe({
        next: (response) => {
          resolve(response?.homeTeam && response?.awayTeam ? response : undefined);
        },
        error: (error: HttpErrorResponse) => {
          if (error?.status === 404) {
            resolve(undefined);
            return;
          }
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets every team's 5v5 expected goals for and against in each game of a regular season. A row per team and game,
   * with the NHL's team ID; a team NST names in a way NhlTeamUtils doesn't know is left out. Resolves an empty list
   * when NST has no games for the season yet. Rejects when they can't be loaded, including when the backend has no key
   * or is pausing for NST's limits (503).
   *
   * @param season - The season ID, like 20262027.
   */
  public getTeamGames(season: number | string): Promise<NstTeamGameStats[]> {
    return new Promise((resolve, reject) => {
      return this.http.get<NstTeamGamesResponse>(this.nstTeamGamesUrl + "?season=" + season).subscribe({
        next: (response) => {
          resolve(NaturalStatTrickService.toTeamGameRows(response));
        },
        error: (error: HttpErrorResponse) => {
          if (error?.status === 404) {
            resolve([]);
            return;
          }
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Turns the response's columns into one object per team and game.
   */
  private static toTeamGameRows(response: NstTeamGamesResponse): NstTeamGameStats[] {
    const games = response?.games;
    const teamIds = (response?.teams ?? []).map(name => NhlTeamUtils.getTeamIdByName(name));
    return (games?.gameId ?? []).map((gameId, i) => ({
      gameId,
      teamId: teamIds[games.team?.[i]],
      expectedGoalsFor: games.expectedGoalsFor?.[i],
      expectedGoalsAgainst: games.expectedGoalsAgainst?.[i]
    })).filter(game => game.teamId !== undefined);
  }
}
