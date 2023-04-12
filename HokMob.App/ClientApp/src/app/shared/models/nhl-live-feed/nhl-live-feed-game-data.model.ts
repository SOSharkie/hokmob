import {NhlGameStatusModel} from "@shared/models/nhl-general/nhl-game-status.model";
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlVenueModel} from "@shared/models/nhl-general/nhl-venue.model";
import {NhlLiveFeedTeamsModel} from "@shared/models/nhl-live-feed/nhl-live-feed-teams.model";

export class NhlLiveFeedGameDataModel {

  public game: {
    pk: number,
    season: string,
    type: string
  };

  public datetime: {
    dateTime: string,
    endDateTime: string
  };

  public status: NhlGameStatusModel;

  public teams: NhlLiveFeedTeamsModel;

  public players: Map<string, NhlPersonModel>;

  public venue: NhlVenueModel;
}
