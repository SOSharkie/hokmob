import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {NhlStatTeamModel} from "@shared/models/nhl-stats/nhl-stat-team.model";
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlTeamExtendedModel} from "@shared/models/nhl-general/nhl-team-extended.model";

@Injectable()
export class NhlStatsService {

  private readonly nhlStatsUrl = "https://statsapi.web.nhl.com/api/v1/teams?" +
      "teamId=1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,28,29,30,52,53,54,55";

  private readonly playersStatsUrl = "https://statsapi.web.nhl.com/api/v1/people/";

  private readonly playerStatsParams = "?expand=person.stats&stats=yearByYear,yearByYearPlayoffs,careerRegularSeason,gameLog,playoffGameLog&expand=stats.team";

  private readonly teamStatsUrl = "https://statsapi.web.nhl.com/api/v1/teams?teamId=";

  private readonly teamStatsParams = "&hydrate=previousSchedule(limit=10,linescore,team),record,coaches,roster(person(stats(splits=[statsSingleSeason,statsSingleSeasonPlayoffs])))&gameType=R,P&season=";

  constructor(private http: HttpClient) { }

  /**
   *  Gets the NHL stat leaders for the current season.
   *
   * @param season - The season to get stats for.
   * @param playoffs - Flag for retrieving playoff stats.
   */
  public getNhlStats(season: string, playoffs: boolean = false): Promise<NhlStatTeamModel[]> {
    let seasonParam = "&season=" + season;
    let gameTypeParam = "&gameType=R";
    let hydrateParam = "&hydrate=roster(person(stats(splits=statsSingleSeason)))";
    if (playoffs) {
      gameTypeParam = "&gameType=P";
      hydrateParam = "&hydrate=roster(person(stats(splits=statsSingleSeasonPlayoffs)))";
    }
    let url = this.nhlStatsUrl + hydrateParam + gameTypeParam + seasonParam;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(response.teams);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   *  Gets stats for a given NHL player.
   *
   * @param playerId - The ID of the player to get stats for.
   */
  public getNhlPlayerStats(playerId: string): Promise<NhlPersonModel> {
    let url = this.playersStatsUrl + playerId + this.playerStatsParams;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(response.people[0]);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   *  Gets a given NHL team.
   *
   * @param teamId - The ID of the team to get stats for.
   */
  public getNhlTeam(teamId: string): Promise<NhlTeamModel> {
    let url = this.teamStatsUrl + teamId;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(response.teams[0]);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }


  /**
   *  Gets stats for a given NHL team.
   *
   * @param teamId - The ID of the team to get stats for.
   * @param season - The season to get stats for.
   */
  public getNhlTeamStats(teamId: string, season: string): Promise<NhlTeamExtendedModel> {
    let url = this.teamStatsUrl + teamId + this.teamStatsParams + season;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(response.teams[0]);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }
}
