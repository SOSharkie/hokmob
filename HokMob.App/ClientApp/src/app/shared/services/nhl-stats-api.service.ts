import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {TeamSeasonStats, TeamStatsResponse} from "@shared/models/nhl-stats-api/team-stats.model";

/**
 * The stats the NHL web API doesn't have, from the NHL stats API through the backend (/api/nhl-stats/*). The backend
 * builds every stats API query and merges its reports, so each method here is one request.
 */
@Injectable()
export class NhlStatsApiService {

  private readonly nhlTeamStatsUrl = "/api/nhl-stats/teams";

  constructor(private http: HttpClient) { }

  /**
   * Gets every team's stats for a season (power play, penalty kill, goals and shots per game, faceoffs). All teams
   * come back, so a team page works out league ranks itself and every team page shares one cached response. A season
   * with no games played yet resolves an empty list.
   *
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season (the default), 3 for the playoffs.
   */
  public getTeamStats(season: number | string, gameType: number = 2): Promise<TeamSeasonStats[]> {
    const url = this.nhlTeamStatsUrl + "?season=" + season + "&gameType=" + gameType;
    return new Promise((resolve, reject) => {
      return this.http.get<TeamStatsResponse>(url).subscribe({
        next: (response) => {
          resolve(response?.teams ?? []);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }
}
