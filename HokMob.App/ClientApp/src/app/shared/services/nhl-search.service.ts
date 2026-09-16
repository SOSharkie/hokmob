import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {SearchResultModel} from "@shared/models/search-result.model";
import {SearchResultTypeEnum} from "@shared/enums/search-result-type.enum";
import {PlayerSearchResult} from "@shared/models/nhl-web-api/player-search.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";

/**
 * The header search. Teams are matched locally against the active teams, and players are searched through the
 * backend's search proxy (NhlSearchController → search.d3.nhle.com).
 */
@Injectable()
export class NhlSearchService {

  private readonly playerSearchUrl = "/api/nhl-search/player";

  private readonly defaultPlayerLimit = 10;

  constructor(private http: HttpClient) { }

  /**
   * Finds the active teams whose full name, place name, team name or abbreviation contains the query, ignoring case.
   * No request is made.
   *
   * @param query - The search text, like "bos" or "maple".
   */
  public searchTeams(query: string): SearchResultModel[] {
    const search = query?.trim().toLowerCase();
    if (!search) {
      return [];
    }
    return NhlTeamUtils.getActiveTeamIds()
        .map(id => NhlTeamUtils.getTeam(id))
        .filter(team => [team.name, team.shortName, team.teamName, team.triCode]
            .some(value => value?.toLowerCase().includes(search)))
        .map(team => {
          const result = new SearchResultModel();
          result.resultType = SearchResultTypeEnum.TEAM;
          result.teamId = team.id.toString();
          result.teamName = team.name;
          result.displayValue = team.name;
          result.link = "team/" + team.id;
          return result;
        });
  }

  /**
   * Searches active players by name.
   *
   * @param query - The search text, like "mac".
   * @param limit - The maximum number of players.
   */
  public searchPlayers(query: string, limit: number = this.defaultPlayerLimit): Promise<SearchResultModel[]> {
    const url = this.playerSearchUrl + "?q=" + encodeURIComponent(query?.trim() ?? "") + "&limit=" + limit
        + "&active=true";
    return new Promise((resolve, reject) => {
      return this.http.get<PlayerSearchResult[]>(url).subscribe({
        next: (response) => {
          resolve((response ?? []).map(player => this.toPlayerResult(player)));
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Converts a player search result. The headshot is the one of the player's last team and season, or the blank
   * headshot for a player who hasn't played a game.
   */
  private toPlayerResult(player: PlayerSearchResult): SearchResultModel {
    const result = new SearchResultModel();
    result.resultType = SearchResultTypeEnum.PLAYER;
    result.playerId = player.playerId;
    result.teamId = player.teamId ?? player.lastTeamId;
    result.positionCode = player.positionCode;
    result.headshot = NhlPlayerHeadshotUtils.getHeadshotUrl(Number(player.lastSeasonId), player.lastTeamAbbrev,
        Number(player.playerId));
    result.displayValue = player.name;
    result.link = "player/" + player.playerId;
    return result;
  }
}
