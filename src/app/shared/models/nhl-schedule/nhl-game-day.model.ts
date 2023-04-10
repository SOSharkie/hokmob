import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";

export class NhlGameDayModel {

  public date: String;

  public totalItems: number;

  public totalEvents: number;

  public totalGames: number;

  public totalMatches: number;

  public games: NhlGameModel[];

  public events: any[];

  public matches: any[];

}
