import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

export class NhlStatsSplitModel {

  public season: string;

  public league: any;

  public team: NhlTeamModel;

  public sequenceNumber: number;

  public stat: NhlPlayerStatsModel;

}
