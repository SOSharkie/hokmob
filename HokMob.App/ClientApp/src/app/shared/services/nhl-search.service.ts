import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {SearchResultModel} from "@shared/models/search-result.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";


@Injectable()
export class NhlSearchService {

  private readonly searchUrl = "https://suggest.svc.nhl.com/svc/suggest/v1/min_all/";

  constructor(private http: HttpClient) { }

  /**
   * Searches for NHL teams and players by a string.
   *
   * @param searchString - The string to search for.
   * @param limit - The limit for number of results
   */
  public searchNhlTeamsAndPlayers(searchString: string, limit: number = 25): Promise<SearchResultModel[]> {
    let url = this.searchUrl + searchString + "/" + limit;

    return new Promise((resolve, reject) => {
      return this.http.get<any>(url).subscribe({
        next: (response) => {
          resolve(response.suggestions.map((suggestion: string) => this.parseResultString(suggestion)).filter((searchResult: SearchResultModel) => {
            return (searchResult.team && searchResult.team.id !== 100) || searchResult.playerActive;
          }));
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  private parseResultString(resultString: string): SearchResultModel {
    let searchResult = new SearchResultModel();
    if (resultString.startsWith('t')) {
      searchResult.isPlayer = false;
      searchResult.teamId = resultString.substring(2);
      searchResult.team = NhlTeamUtils.getTeam(Number(searchResult.teamId));
      searchResult.link = "team/" + searchResult.teamId;
      searchResult.displayValue = searchResult.team.name;
    } else if (resultString.startsWith('p')) {
      searchResult.isPlayer = true;
      let playerDetails = resultString.split("|");
      searchResult.playerId = playerDetails[1];
      searchResult.link = "player/" + searchResult.playerId;
      searchResult.playerLastName = playerDetails[2];
      searchResult.playerFirstName = playerDetails[3];
      searchResult.playerActive = playerDetails[4] === '1';
      searchResult.playerRookie = playerDetails[5] === '1';
      searchResult.playerPositionCode = playerDetails[6];
      searchResult.displayValue = searchResult.playerFirstName + " " + searchResult.playerLastName;
    }
    return searchResult;
  }
}
