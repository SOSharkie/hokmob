import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

export class SearchResultModel {

  public isPlayer: boolean = false;

  public link: string = "/";

  public teamId: string;

  public team: NhlTeamModel;

  public playerId: string;

  public playerFirstName: string;

  public playerLastName: string;

  public playerActive: boolean;

  public playerRookie: boolean;

  public playerPositionCode: string;

  public displayValue: string;
}
