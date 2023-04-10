import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import {catchError, map, Observable, tap} from "rxjs";

import * as dayjs from 'dayjs'
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";

@Injectable()
export class NhlLogoService {

  private nhlTeamLogoUrl = "https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/";

  /**
   *
   * @param http
   */
  constructor(private http: HttpClient) { }

  public getNhlTeamLogo(teamId: number): Promise<Blob> {
    let url = this.nhlTeamLogoUrl + teamId + ".svg";

    return new Promise((resolve, reject) => {
      return this.http.get(url, { responseType: 'blob' }).subscribe(response => {
        resolve(response);
      });
    });
  }


  private formatDateStringForNhl(date: Date): string {
    return dayjs(date).format("YYYY-MM-DD");
  }
}
