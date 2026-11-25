import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {NstGameStats} from "@shared/models/natural-stat-trick/nst-game-stats.model";
import {NstTeamGameStats, NstTeamGamesResponse} from "@shared/models/natural-stat-trick/nst-team-games.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NstPlayerStats, NstPlayersResponse} from "@shared/models/natural-stat-trick/nst-players.model";

/**
 * Corsi and expected goals (xG) from Natural Stat Trick, through the backend (/api/nst/*), which holds the access key
 * and caches the pages, since NST allows only so many a minute.
 */
@Injectable()
export class NaturalStatTrickService {

  private readonly nstGameUrl = "/api/nst/game/";

  private readonly nstTeamGamesUrl = "/api/nst/team-games";

  private readonly nstPlayersUrl = "/api/nst/players";

  /** How long a season's skaters are reused before they're asked for again: 5 minutes. The backend keeps them an hour. */
  public static readonly playersMaxAge = 5 * 60 * 1000;

  /** The skaters requests by season, until they're older than playersMaxAge. */
  private readonly players = new Map<string, {requestedAt: number, players: Promise<NstPlayerStats[]>}>();

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
   * Gets every skater's individual stats of a regular season that the NHL's APIs don't have (ixG, high danger and rush
   * attempts, rebounds created, hits taken), one row per skater with his NHL ID. A season is kept for
   * playersMaxAge, so moving between players doesn't load it again, and a failed request isn't reused. Resolves an
   * empty list when NST has no skaters for the season yet. Rejects when they can't be loaded, including when the
   * backend has no key or is pausing for NST's limits (503).
   *
   * @param season - The season ID, like 20262027.
   */
  public getPlayers(season: number | string): Promise<NstPlayerStats[]> {
    const key = String(season);
    const cached = this.players.get(key);
    if (cached && Date.now() - cached.requestedAt < NaturalStatTrickService.playersMaxAge) {
      return cached.players;
    }
    const request = new Promise<NstPlayerStats[]>((resolve, reject) => {
      return this.http.get<NstPlayersResponse>(this.nstPlayersUrl + "?season=" + season).subscribe({
        next: (response) => {
          resolve(NaturalStatTrickService.toPlayerRows(response));
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
    this.players.set(key, {requestedAt: Date.now(), players: request});
    request.catch(() => {
      if (this.players.get(key)?.players === request) {
        this.players.delete(key);
      }
    });
    return request;
  }

  /**
   * Turns the players response's columns into one object per skater.
   */
  private static toPlayerRows(response: NstPlayersResponse): NstPlayerStats[] {
    const columns = response?.players;
    const fields = Object.keys(columns ?? {}) as (keyof NstPlayerStats)[];
    return (columns?.playerId ?? []).map((_, i) => {
      const row = {} as Record<keyof NstPlayerStats, number>;
      fields.forEach(field => row[field] = columns[field]?.[i]);
      return row as NstPlayerStats;
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
