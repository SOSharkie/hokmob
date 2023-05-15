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

  private readonly scheduleDetails = "linescore,broadcasts(all),game(seriesSummary),seriesSummary(series)"

  constructor(private http: HttpClient) { }

  /**
   *  Gets all nhl game models for a given date.
   *
   * @param date - The date to get NHL game models for.
   */
  public getNhlGames(date: Date): Promise<NhlGameDayModel> {
    const options = {
      params: new HttpParams().set("date", this.formatDateStringForNhl(date)).set("hydrate", this.scheduleDetails)
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe({
        next: (response) => {
          resolve(response.dates[0]);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   *  Gets all nhl game models for a given team.
   *
   * @param startDate - The start date to look for.
   * @param endDate - The end date to look for.
   * @param teamId - The team ID to get NHL game models for.
   */
  public getTeamGames(startDate: Date, endDate: Date, teamId?: number): Promise<NhlScheduleModel> {
    const options = {
      params: new HttpParams().set("startDate", this.formatDateStringForNhl(startDate))
          .set("endDate", this.formatDateStringForNhl(endDate))
          .set("teamId", teamId)
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

  /**
   * Gets the nhl game for a given game ID (gamePk for NHL API).
   *
   * @param gameId - The ID of the game to get the NHL game model for.
   */
  public getNhlGame(gameId: string): Promise<NhlGameModel> {
    const options = {
      params: new HttpParams().set("gamePk", gameId).set("hydrate", this.scheduleDetails)
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe({
        next: (response) => {
          let game: NhlGameModel = response.dates[0].games.find(game => game.gamePk === Number(gameId));
          resolve(game);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
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
      return this.http.get<NhlLiveFeedModel>(gameUrl).subscribe({
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
