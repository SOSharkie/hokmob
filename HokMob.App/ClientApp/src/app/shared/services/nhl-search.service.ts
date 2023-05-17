import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {SearchResultModel} from "@shared/models/search-result.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlStatTeamModel} from "@shared/models/nhl-stats/nhl-stat-team.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";


@Injectable()
export class NhlSearchService {

  private readonly nhlStatsUrl = "https://statsapi.web.nhl.com/api/v1/teams?" +
      "teamId=1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,28,29,30,52,53,54,55";

  private readonly teamStatsUrl = "https://statsapi.web.nhl.com/api/v1/teams";

  private readonly searchUrl = "https://suggest.svc.nhl.com/svc/suggest/v1/minplayers/";

  constructor(private http: HttpClient) { }

  /**
   *  Gets all NHL players on the current NHL rosters, as a search result model array.
   *
   * @param season - The season to get stats for.
   */
  public getNhlPlayers(season: string): Promise<SearchResultModel[]> {
    let seasonParam = "&season=" + season;
    let hydrateParam = "&hydrate=roster(person)";
    let url = this.nhlStatsUrl + hydrateParam + seasonParam;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(this.getPlayerSearchResultModelsFromTeams(response.teams));
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   *  Gets all active NHL teams, as a search result model array.
   */
  public getNhlTeams(): Promise<SearchResultModel[]> {
    let url = this.teamStatsUrl;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(this.getTeamsSearchResultModels(response.teams));
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  // This API only works on localhost, when deployed to Prod requests fail due to CORS errors for the URL
  // /**
  //  * Searches for NHL teams and players by a string.
  //  *
  //  * @param searchString - The string to search for.
  //  * @param limit - The limit for number of results
  //  */
  // public searchNhlTeamsAndPlayers(searchString: string, limit: number = 25): Promise<SearchResultModel[]> {
  //   let url = this.searchUrl + searchString + "/" + limit;
  //
  //   return new Promise((resolve, reject) => {
  //     return this.http.get<any>(url).subscribe({
  //       next: (response) => {
  //         resolve(response.suggestions.map((suggestion: string) => this.parseResultString(suggestion)).filter((searchResult: SearchResultModel) => {
  //           return (searchResult.team && searchResult.team.id !== 100) || searchResult.playerActive;
  //         }));
  //       },
  //       error: (error) => {
  //         console.error(error);
  //         reject(error);
  //       }
  //     });
  //   });
  // }

  private getPlayerSearchResultModelsFromTeams(teams: NhlStatTeamModel[]): SearchResultModel[] {
    let allPlayers: SearchResultModel[] = [];
    teams.forEach(team => {
      team.roster.roster.forEach(person => {
        let searchResult = new SearchResultModel();
        searchResult.isPlayer = true;
        searchResult.playerId = person.person.id.toString();
        searchResult.playerLastName = person.person.lastName;
        searchResult.playerFirstName = person.person.firstName;
        searchResult.displayValue = person.person.fullName;
        searchResult.link = "player/" + searchResult.playerId;
        allPlayers.push(searchResult);
      });
    });
    return allPlayers;
  }

  private getTeamsSearchResultModels(teams: NhlTeamModel[]): SearchResultModel[] {
    let allTeams: SearchResultModel[] = [];
    teams.forEach(team => {
      let searchResult = new SearchResultModel();
      searchResult.isPlayer = false;
      searchResult.teamId = team.id.toString();
      searchResult.team = team;
      searchResult.displayValue = team.name;
      searchResult.link = "team/" + searchResult.teamId;
      allTeams.push(searchResult);
    });
    return allTeams;
  }

  // private parseResultString(resultString: string): SearchResultModel {
  //   let searchResult = new SearchResultModel();
  //   if (resultString.startsWith('t')) {
  //     searchResult.isPlayer = false;
  //     searchResult.teamId = resultString.substring(2);
  //     searchResult.team = NhlTeamUtils.getTeam(Number(searchResult.teamId));
  //     searchResult.link = "team/" + searchResult.teamId;
  //     searchResult.displayValue = searchResult.team.name;
  //   } else if (resultString.startsWith('p')) {
  //     searchResult.isPlayer = true;
  //     let playerDetails = resultString.split("|");
  //     searchResult.playerId = playerDetails[1];
  //     searchResult.link = "player/" + searchResult.playerId;
  //     searchResult.playerLastName = playerDetails[2];
  //     searchResult.playerFirstName = playerDetails[3];
  //     searchResult.playerActive = playerDetails[4] === '1';
  //     searchResult.playerRookie = playerDetails[5] === '1';
  //     searchResult.playerPositionCode = playerDetails[6];
  //     searchResult.displayValue = searchResult.playerFirstName + " " + searchResult.playerLastName;
  //   }
  //   return searchResult;
  // }
}
