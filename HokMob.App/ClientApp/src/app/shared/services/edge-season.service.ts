import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {EdgeSeason, EdgeSeasonFile, EdgeSeasonSkater} from "@shared/models/nhl-edge/edge-season.model";

/**
 * Every skater's NHL EDGE season (top speed, bursts over 20 mph, distance, top shot speed and zone time), preloaded
 * into src/assets/edge by build-edge-data.js, so the player page ranks a skater's EDGE stats against its own pool
 * without asking EDGE for the whole league. The file is a static asset, kept for the session.
 */
@Injectable()
export class EdgeSeasonService {

  /**
   * The regular seasons with a file in src/assets/edge, newest first, from the season in progress. EDGE starts in
   * 2021-22, so the list can go back that far.
   */
  public static readonly seasons: number[] = [20262027, 20252026, 20242025];

  private readonly edgeUrl = "assets/edge/";

  /** Each season's request, shared by every caller for the rest of the session. */
  private readonly edgeSeasons = new Map<number, Promise<EdgeSeason>>();

  constructor(private http: HttpClient) { }

  /** Whether a regular season has an EDGE file. */
  public static hasSeason(season: number): boolean {
    return EdgeSeasonService.seasons.includes(season);
  }

  /**
   * Gets every skater's EDGE stats of a regular season. Resolves undefined for a season without a file (before
   * 2021-22, or one not built yet), without asking for it. The file is loaded once and kept for the session; a failed
   * load isn't kept, so the next call tries again.
   *
   * @param season - The season ID, like 20262027.
   */
  public getEdgeSeason(season: number): Promise<EdgeSeason> {
    if (!EdgeSeasonService.hasSeason(season)) {
      return Promise.resolve(undefined);
    }
    let edgeSeason = this.edgeSeasons.get(season);
    if (!edgeSeason) {
      edgeSeason = new Promise((resolve, reject) => {
        return this.http.get<EdgeSeasonFile>(this.edgeUrl + season + "-2.json").subscribe({
          next: (file) => {
            resolve(EdgeSeasonService.toEdgeSeason(file));
          },
          error: (error) => {
            console.error(error);
            reject(error);
          }
        });
      });
      this.edgeSeasons.set(season, edgeSeason);
      edgeSeason.catch(() => this.edgeSeasons.delete(season));
    }
    return edgeSeason;
  }

  /** Turns the file's columns into one object per skater. */
  private static toEdgeSeason(file: EdgeSeasonFile): EdgeSeason {
    const columns = file?.skaters;
    const fields = Object.keys(columns ?? {}) as (keyof EdgeSeasonSkater)[];
    const skaters = (columns?.playerId ?? []).map((_, i) => {
      const row = {} as Record<keyof EdgeSeasonSkater, number>;
      fields.forEach(field => row[field] = columns[field]?.[i]);
      return row as EdgeSeasonSkater;
    });
    return {season: file?.season, throughDate: file?.throughDate, skaters};
  }
}
