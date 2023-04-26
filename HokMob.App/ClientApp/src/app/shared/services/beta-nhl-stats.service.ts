import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import * as dayjs from "dayjs";
import {NhlStatTypeEnum} from "@shared/enums/nhl-stat-type.enum";

@Injectable()
export class BetaNhlStatsService {

  private readonly nhlSkaterStatsUrl = "https://api.nhle.com/stats/rest/en/leaders/skaters/";

  private readonly nhlGoalieStatsUrl = "https://api.nhle.com/stats/rest/en/leaders/goalies/"

  private readonly timeOnIce = "%20and%20timeOnIce%20%3E=%201800";

  private readonly currentPlayoffs = "?cayenneExp=season=20222023%20and%20gameType=3"

  constructor(private http: HttpClient) { }

  /**
   *  Gets the NHL stat leaders for the current season.
   *
   * @param statType - The type of stat to retrieve.
   * @param playoffs - Flag for retrieving playoff stats.
   */
  public getNhlStatLeaders(statType: NhlStatTypeEnum, playoffs: boolean = false): Promise<any[]> {
    let statUrl = "";
    if (statType === NhlStatTypeEnum.GOALS_AGAINST_AVERAGE || statType === NhlStatTypeEnum.SAVE_PERCENTAGE ||
        statType === NhlStatTypeEnum.SHUTOUTS) {
      statUrl = this.nhlGoalieStatsUrl  + statType.toString() + this.currentPlayoffs + this.timeOnIce;
    } else {
      statUrl = this.nhlSkaterStatsUrl + statType.toString() + this.currentPlayoffs;
    }

    return new Promise((resolve, reject) => {
      return this.http.get<any>(statUrl).subscribe({
        next: (response) => {
          resolve(response.data);
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
