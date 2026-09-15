import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class NhlImageService {

  private nhlPlayerHeadShotUrl = "https://cms.nhl.bamgrid.com/images/headshots/current/168x168/";

  constructor(private http: HttpClient) { }

  // TODO: cms.nhl.bamgrid.com is gone (see docs/nhl-api-migration-plan.md). The game page uses headshot URLs directly
  //  (NhlPlayerHeadshotUtils); switch the player page, search results and stat leaderboards when they migrate, then
  //  remove this method.
  public getNhlPlayerHeadshot(playerId: number): Promise<Blob> {
    let url = this.nhlPlayerHeadShotUrl + playerId + ".jpg";

    return new Promise((resolve, reject) => {
      return this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          if (error.status === 403) {
            console.log("Image for playerId " + playerId + " could not be found");
          } else {
            console.error(error);
          }
        }
      });
    });
  }

}
