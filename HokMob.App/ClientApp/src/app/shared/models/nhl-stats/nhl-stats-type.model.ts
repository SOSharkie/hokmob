import {NhlStatsSplitModel} from "@shared/models/nhl-stats/nhl-stats-split.model";

export class NhlStatsTypeModel {

  public splits: NhlStatsSplitModel[];

  public type: {
    displayName: string,
    gameType: any
  };

}
