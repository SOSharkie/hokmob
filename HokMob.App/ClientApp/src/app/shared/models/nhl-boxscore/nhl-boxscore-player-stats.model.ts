import {NhlBoxscorePlayerSkaterStatsModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player-skater-stats.model";
import {NhlBoxscorePlayerGoalieStatsModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player-goalie-stats.model";

export class NhlBoxscorePlayerStatsModel {

  public skaterStats: NhlBoxscorePlayerSkaterStatsModel;

  public goalieStats: NhlBoxscorePlayerGoalieStatsModel;
}
