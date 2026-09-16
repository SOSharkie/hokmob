import {SearchResultTypeEnum} from "@shared/enums/search-result-type.enum";

export class SearchResultModel {

  public resultType: SearchResultTypeEnum;

  public link: string = "/";

  /** The team's ID, or a player's current (or last) team ID. */
  public teamId: string;

  /** The full team name, for team results. */
  public teamName: string;

  public playerId: string;

  /** The headshot URL, for player results. */
  public headshot: string;

  /** C, L, R, D or G, for player results. */
  public positionCode: string;

  public displayValue: string;
}
