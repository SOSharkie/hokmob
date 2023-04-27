import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import * as dayjs from "dayjs";
import {NhlStatTeamModel} from "@shared/models/nhl-stats/nhl-stat-team.model";

@Injectable()
export class NhlStatsService {

  private readonly nhlStatsUrl = "https://statsapi.web.nhl.com/api/v1/teams?" +
      "teamId=6,13,10,14,12,2,1,3,21,55,25,30,54,52,22,26";

  constructor(private http: HttpClient) { }

  /**
   *  Gets the NHL stat leaders for the current season.
   *
   * @param season - The season to get stats for.
   * @param playoffs - Flag for retrieving playoff stats.
   */
  public netNhlStats(season: string, playoffs: boolean = false): Promise<NhlStatTeamModel[]> {
    let seasonParam = "&season=" + season;
    let gameTypeParam = "&gameType=R";
    let hydrateParam = "&hydrate=roster(person(stats(splits=statsSingleSeason)))";
    if (playoffs) {
      gameTypeParam = "&gameType=P";
      hydrateParam = "&hydrate=roster(person(stats(splits=statsSingleSeasonPlayoffs)))";
    }
    let url = this.nhlStatsUrl + hydrateParam + gameTypeParam + seasonParam;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(response.teams);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

}
