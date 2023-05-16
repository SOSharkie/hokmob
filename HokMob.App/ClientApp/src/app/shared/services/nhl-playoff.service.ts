import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import * as dayjs from "dayjs";

@Injectable()
export class NhlPlayoffService {

  private readonly nhlPlayoffUrl = "https://statsapi.web.nhl.com/api/v1/tournaments/playoffs?expand=round.series,schedule.game.seriesSummary&season=";

  private readonly nhlScheduleUrl = "https://statsapi.web.nhl.com/api/v1/schedule";

  private readonly scheduleDetails = "linescore,broadcasts(all)"

  constructor(private http: HttpClient) { }

  /**
   *  Gets the NHL playoff details for the current season.
   */
  public getNhlPlayoffs(season: string): Promise<NhlPlayoffModel> {
    let url = this.nhlPlayoffUrl + season
    return new Promise((resolve, reject) => {
      return this.http.get<NhlPlayoffModel>(url).subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   *  Gets all nhl game models for a playoff series.
   *
   * @param teamId1 - The team ID to get NHL game models for.
   * @param teamId2 - The team ID to get NHL game models for.
   */
  public getNhlPlayoffSeriesGames(teamId1: number, teamId2: number): Promise<NhlScheduleModel> {
    const options = {
      params: new HttpParams().set("startDate", this.formatDateStringForNhl(dayjs().subtract(40, 'days').toDate()))
          .set("endDate", this.formatDateStringForNhl(dayjs().add(20, 'days').toDate()))
          .set("teamId", teamId1 + "," + teamId2)
          .set("gameType", "P")
          .set("hydrate", this.scheduleDetails)
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe({
        next: (response) => {
          resolve(response);
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
