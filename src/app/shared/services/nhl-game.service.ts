import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import {catchError, map, Observable, tap} from "rxjs";

import * as dayjs from 'dayjs'
import {NhlScheduleModel} from "@shared/models/nhl-schedule.model";
import {NhlGameDayModel} from "@shared/models/nhl-game-day.model";

@Injectable()
export class NhlGameService {

  private readonly nhlScheduleUrl = "https://statsapi.web.nhl.com/api/v1/schedule";

  /**
   *
   * @param http
   */
  constructor(private http: HttpClient) { }

  public getNhlGames(date: Date): Promise<NhlGameDayModel> {
    const options = {
      params: new HttpParams().set("date", this.formatDateStringForNhl(date)).set("expand", "schedule.linescore")
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe(response => {
        resolve(response.dates[0])
      });
    });
  }


  private formatDateStringForNhl(date: Date): string {
    return dayjs(date).format("YYYY-MM-DD");
  }
}
