import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";

export class NhlLiveFeedPlaysModel {

  public allPlays: NhlLiveFeedPlayModel[];

  public scoringPlays: number[];

  public penaltyPlays: number[];

  public playsByPeriod: Object[];

  public currentPlay: NhlLiveFeedPlayModel;
}
