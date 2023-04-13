import {NhlLiveFeedGameDataModel} from "@shared/models/nhl-live-feed/nhl-live-feed-game-data.model";
import {NhlLiveFeedLiveDataModel} from "@shared/models/nhl-live-feed/nhl-live-feed-live-data.model";

export class NhlLiveFeedModel {

  public copyright: string;

  public gamePk: number;

  public link: string;

  public metaData: {
    wait: number,
    timeStamp: string
  };

  public gameData: NhlLiveFeedGameDataModel;

  public liveData: NhlLiveFeedLiveDataModel;
}
