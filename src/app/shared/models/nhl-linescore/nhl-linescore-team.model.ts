import {NhlTeamModel} from "@shared/models/nhl-team.model";

export class NhlLinescoreTeamModel {

  public team: NhlTeamModel;

  public goals: number;

  public shotsOnGoal: number;

  public goaliePulled: boolean;

  public numSkaters: number;

  public powerPlay: boolean;

}
