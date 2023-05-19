import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";
import {NhlLiveFeedPlaysByPeriodModel} from "@shared/models/nhl-live-feed/nhl-live-feed-plays-by-period.model";

export class NhlLiveFeedPlaysModel {

  public allPlays: NhlLiveFeedPlayModel[];

  public scoringPlays: number[];

  public penaltyPlays: number[];

  public playsByPeriod: NhlLiveFeedPlaysByPeriodModel[];

  public currentPlay: NhlLiveFeedPlayModel;
}
