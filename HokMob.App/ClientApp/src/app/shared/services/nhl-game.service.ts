import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import * as dayjs from 'dayjs'
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlBoxscoreModel} from "@shared/models/nhl-boxscore/nhl-boxscore.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";

@Injectable()
export class NhlGameService {

  private readonly nhlScheduleUrl = "https://statsapi.web.nhl.com/api/v1/schedule";

  private readonly nhlGameUrl = "https://statsapi.web.nhl.com/api/v1/game/"

  private readonly nhlGameBoxscore = "/boxscore";

  private readonly nhlLiveFeed = "/feed/live";

  constructor(private http: HttpClient) { }

  /**
   *  Gets all nhl game models for a given date.
   *
   * @param date - The date to get NHL game models for.
   */
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

  /**
   * Gets the nhl game for a given game ID (gamePk for NHL API).
   *
   * @param gameId - The ID of the game to get the NHL game model for.
   */
  public getNhlGame(gameId: number): Promise<NhlGameModel> {
    const options = {
      params: new HttpParams().set("gamePk", gameId).set("expand", "schedule.linescore")
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe(response => {
        let game: NhlGameModel = response.dates[0].games.find(game => game.gamePk === gameId);
        resolve(game);
      });
    });
  }

  /**
   * Gets the NHL game boxscore for a given game ID.
   *
   * @param gameId - The ID of the game to get the boxscore.
   */
  public getNhlGameBoxscore(gameId: string): Promise<NhlBoxscoreModel> {
    let gameUrl = this.nhlGameUrl + gameId + this.nhlGameBoxscore;

    return new Promise((resolve, reject) => {
      return this.http.get<NhlBoxscoreModel>(gameUrl).subscribe(response => {
        resolve(response)
      });
    });
  }

  /**
   * Gets the NHL game live feed for a given game ID.
   *
   * @param gameId - The ID of the game to get the live feed.
   */
  public getNhlGameLiveFeed(gameId: string): Promise<NhlLiveFeedModel> {
    let gameUrl = this.nhlGameUrl + gameId + this.nhlLiveFeed;

    return new Promise((resolve, reject) => {
      return this.http.get<NhlLiveFeedModel>(gameUrl).subscribe(response => {
        resolve(response)
      });
    });
  }

  private formatDateStringForNhl(date: Date): string {
    return dayjs(date).format("YYYY-MM-DD");
  }
}
