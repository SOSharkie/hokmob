import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {NstGameStats} from "@shared/models/natural-stat-trick/nst-game-stats.model";

/**
 * Corsi and expected goals (xG) from Natural Stat Trick, through the backend (/api/nst/*), which holds the access key
 * and caches the pages, since NST allows only so many a minute.
 */
@Injectable()
export class NaturalStatTrickService {

  private readonly nstGameUrl = "/api/nst/game/";

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
}
