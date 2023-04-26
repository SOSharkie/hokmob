import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import * as dayjs from "dayjs";
import {NhlStatTeamModel} from "@shared/models/nhl-stats/nhl-stat-team.model";

@Injectable()
export class NhlStatsService {

  private readonly nhlPlayoffSkaterStatsUrl = "https://statsapi.web.nhl.com/api/v1/teams?" +
      "teamId=6,13,10,14,12,2,1,3,21,55,25,30,54,52,22,26" +
      "&hydrate=roster(person(stats(splits=statsSingleSeasonPlayoffs)))&gameType=P&season=20222023";


  constructor(private http: HttpClient) { }

  /**
   *  Gets the NHL stat leaders for the current season.
   *
   * @param playoffs - Flag for retrieving playoff stats.
   */
  public netNhlStats(playoffs: boolean = false): Promise<NhlStatTeamModel[]> {

    return new Promise((resolve, reject) => {
      return this.http.get<any>(this.nhlPlayoffSkaterStatsUrl).subscribe({
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

  private formatDateStringForNhl(date: Date): string {
    return dayjs(date).format("YYYY-MM-DD");
  }

}
