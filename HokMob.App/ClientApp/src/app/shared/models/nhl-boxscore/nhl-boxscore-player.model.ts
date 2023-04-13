import {NhlBoxscorePlayerStatsModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player-stats.model";
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlPositionModel} from "@shared/models/nhl-general/nhl-position.model";

export class NhlBoxscorePlayerModel {

  public person: NhlPersonModel;

  public jerseyNumber: string;

  public position: NhlPositionModel;

  public stats: NhlBoxscorePlayerStatsModel;

}
