import {NhlLinescoreModel} from "@shared/models/nhl-linescore/nhl-linescore.model";
import {NhlBoxscoreModel} from "@shared/models/nhl-boxscore/nhl-boxscore.model";
import {NhlLiveFeedPlaysModel} from "@shared/models/nhl-live-feed/nhl-live-feed-plays.model";

export class NhlLiveFeedLiveDataModel {

  public plays: NhlLiveFeedPlaysModel;

  public linescore: NhlLinescoreModel;

  public boxscore: NhlBoxscoreModel;

  public decisions: Object;
}
