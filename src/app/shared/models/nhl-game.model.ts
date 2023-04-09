import {NhlVenueModel} from "@shared/models/nhl-venue.model";
import {NhlGameTeamsModel} from "@shared/models/nhl-game-teams.model";
import {NhlGameStatusModel} from "@shared/models/nhl-game-status.model";

export class NhlGameModel {

  public gamePk: number;

  public link: string;

  public gameType: string;

  public season: string;

  public gameDate: string;

  public status: NhlGameStatusModel;

  public teams: NhlGameTeamsModel;

  public venue: NhlVenueModel;

  public content: Object;

}
