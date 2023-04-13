import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlLiveFeedPlayResultModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play-result.model";
import {NhlLiveFeedPlayAboutModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play-about.model";
import {NhlLiveFeedPlayPlayerModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play-player.model";

export class NhlLiveFeedPlayModel {

  public players: NhlLiveFeedPlayPlayerModel[];

  public result: NhlLiveFeedPlayResultModel;

  public about: NhlLiveFeedPlayAboutModel;

  public coordinates: {
    x: number,
    y: number
  };

  public team: NhlTeamModel
}
