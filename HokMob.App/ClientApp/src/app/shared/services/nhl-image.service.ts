import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class NhlImageService {

  private nhlTeamLogoUrl = "https://www-league.nhlstatic.com/images/logos/teams-current-primary-dark/";

  private nhlPlayerHeadShotUrl = "https://cms.nhl.bamgrid.com/images/headshots/current/168x168/";

  private test = "https://assets.nhle.com/mugs/nhl/20222023/DAL/8478449.png";

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

  public getNhlPlayerHeadshot(playerId: number): Promise<Blob> {
    let url = this.nhlPlayerHeadShotUrl + playerId + ".jpg";

    return new Promise((resolve, reject) => {
      return this.http.get(url, { responseType: 'blob' }).subscribe(response => {
        resolve(response);
      });
    });
  }

}
