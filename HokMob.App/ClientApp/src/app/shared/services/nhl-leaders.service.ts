import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {GoalieStatsLeaders, SkaterStatsLeaders} from "@shared/models/nhl-web-api/stats-leaders.model";

/**
 * The NHL web API's stat leaderboards, which come with headshots, logos and the NHL's own qualification rules. The
 * web API has no hits or shots category, so those two leaderboards come from the stats API instead
 * (NhlStatsApiService.getHitsAndShotsLeaders).
 */
@Injectable()
export class NhlLeadersService {

  // Proxied through the HokMob backend (NhlController) to avoid CORS
  private readonly nhlSkaterLeadersUrl = "/api/nhl/skater-stats-leaders/";

  private readonly nhlGoalieLeadersUrl = "/api/nhl/goalie-stats-leaders/";

  private readonly defaultLeaderCount = 5;

  constructor(private http: HttpClient) { }

  /**
   * Gets the skater leaders of a season, one list per category, best first. A category the NHL has no qualified
   * players for (the playoffs before they start) comes back missing or empty.
   *
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season, 3 for the playoffs.
   * @param categories - The categories to ask for, like ["points", "goals"]. All of them when left out.
   * @param limit - The number of leaders per category.
   */
  public getSkaterLeaders(season: number | string, gameType: number, categories?: string[],
                          limit: number = this.defaultLeaderCount): Promise<SkaterStatsLeaders> {
    return this.getLeaders<SkaterStatsLeaders>(this.nhlSkaterLeadersUrl, season, gameType, categories, limit);
  }

  /**
   * Gets the goalie leaders of a season, one list per category, best first.
   *
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season, 3 for the playoffs.
   * @param categories - The categories to ask for, like ["wins"]. All of them when left out.
   * @param limit - The number of leaders per category.
   */
  public getGoalieLeaders(season: number | string, gameType: number, categories?: string[],
                          limit: number = this.defaultLeaderCount): Promise<GoalieStatsLeaders> {
    return this.getLeaders<GoalieStatsLeaders>(this.nhlGoalieLeadersUrl, season, gameType, categories, limit);
  }

  private getLeaders<T>(leadersUrl: string, season: number | string, gameType: number, categories: string[],
                        limit: number): Promise<T> {
    let url = leadersUrl + season + "/" + gameType + "?limit=" + limit;
    if (categories?.length) {
      url += "&categories=" + categories.join(",");
    }
    return new Promise((resolve, reject) => {
      return this.http.get<T>(url).subscribe({
        next: (response) => {
          resolve(response ?? {} as T);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }
}
