import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {SearchResultTypeEnum} from "@shared/enums/search-result-type.enum";

export class SearchResultModel {

  public resultType: SearchResultTypeEnum;

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
