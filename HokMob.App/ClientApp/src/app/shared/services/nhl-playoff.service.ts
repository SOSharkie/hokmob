import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";

@Injectable()
export class NhlPlayoffService {

  private readonly nhlPlayoffUrl = "https://statsapi.web.nhl.com/api/v1/tournaments/playoffs?expand=round.series,schedule.game.seriesSummary&season=20222023";

  constructor(private http: HttpClient) { }

  /**
   *  Gets the NHL playoff details for the current season.
   */
  public getNhlPlayoffs(): Promise<NhlPlayoffModel> {

    return new Promise((resolve, reject) => {
      return this.http.get<NhlPlayoffModel>(this.nhlPlayoffUrl).subscribe({
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

}
