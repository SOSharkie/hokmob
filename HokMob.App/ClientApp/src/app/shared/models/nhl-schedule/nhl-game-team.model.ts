import {NhlLeagueRecordModel} from "@shared/models/nhl-general/nhl-league-record.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

export class NhlGameTeamModel {

  public leagueRecord: NhlLeagueRecordModel;

  public score: number;

  public team: NhlTeamModel;

}
