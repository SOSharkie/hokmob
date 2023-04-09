import {NhlLeagueRecordModel} from "@shared/models/nhl-league-record.model";
import {NhlTeamModel} from "@shared/models/nhl-team.model";

export class NhlGameTeamModel {

  public leagueRecord: NhlLeagueRecordModel;

  public score: number;

  public team: NhlTeamModel;

}
