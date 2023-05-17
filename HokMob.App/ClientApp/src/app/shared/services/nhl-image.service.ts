import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class NhlImageService {

  private nhlTeamLogoUrl = "https://www-league.nhlstatic.com/images/logos/teams-current-primary-dark/";

  private nhlPlayerHeadShotUrl = "https://cms.nhl.bamgrid.com/images/headshots/current/168x168/";

  constructor(private http: HttpClient) { }

  public getNhlTeamLogo(teamId: number): Promise<Blob> {
    let url = this.nhlTeamLogoUrl + teamId + ".svg";

    return new Promise((resolve, reject) => {
      return this.http.get(url, { responseType: 'blob' }).subscribe(response => {
        resolve(response);
      });
    });
  }

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
