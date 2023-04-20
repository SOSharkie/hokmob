import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

export class NhlPlayoffMatchupTeamModel {

  public team: NhlTeamModel;

  public seed: {
    type: string,
    rank: number,
    isTop: boolean
  };

  public seriesRecord: {
    wins: number,
    losses: number
  };
}
