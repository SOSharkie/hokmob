import {NhlBoxscoreTeamStatsModel} from "@shared/models/nhl-boxscore/nhl-boxscore-team-stats.model";
import {NhlTeamModel} from "@shared/models/nhl-team.model";

export class NhlBoxscoreTeamModel {

  public team: NhlTeamModel;

  public teamStats: NhlBoxscoreTeamStatsModel;

  public players: Object;

  public goalies: number[];

  public skaters: number[];

  public onIce: any[];

  public onIcePlus: any[];

  public scratches: any[];

  public penaltyBox: any[];

  public coaches: any[];

}
