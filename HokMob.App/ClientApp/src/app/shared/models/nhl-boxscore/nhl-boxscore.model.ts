import {NhlBoxscoreTeamsModel} from "@shared/models/nhl-boxscore/nhl-boxscore-teams.model";

export class NhlBoxscoreModel {

  public copyright: string;

  public teams: NhlBoxscoreTeamsModel;

  public officials: any[];

}
