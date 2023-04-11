import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import * as dayjs from 'dayjs'
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlBoxscoreModel} from "@shared/models/nhl-boxscore/nhl-boxscore.model";

@Injectable()
export class NhlGameService {

  private readonly nhlScheduleUrl = "https://statsapi.web.nhl.com/api/v1/schedule";

  private readonly nhlGameUrl = "https://statsapi.web.nhl.com/api/v1/game/"

  private readonly nhlGameBoxscore = "/boxscore";

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

  public getNhlGameBoxscore(gameId: string): Promise<NhlBoxscoreModel> {
    let gameUrl = this.nhlGameUrl + gameId + this.nhlGameBoxscore;

    return new Promise((resolve, reject) => {
      return this.http.get<NhlBoxscoreModel>(gameUrl).subscribe(response => {
        resolve(response)
      });
    });
  }

  private formatDateStringForNhl(date: Date): string {
    return dayjs(date).format("YYYY-MM-DD");
  }
}
