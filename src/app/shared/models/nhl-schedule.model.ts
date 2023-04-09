import {NhlGameDayModel} from "@shared/models/nhl-game-day.model";

export class NhlScheduleModel {

  public copyright: String;

  public totalItems: number;

  public totalEvents: number;

  public totalGames: number;

  public totalMatches: number;

  public metaDate: Object;

  public wait: number;

  public dates: NhlGameDayModel[];

}
