import {NhlVenueModel} from "@shared/models/nhl-general/nhl-venue.model";
import {NhlHomeAwayGameTeamModel} from "@shared/models/nhl-schedule/nhl-home-away-game-team.model";
import {NhlGameStatusModel} from "@shared/models/nhl-general/nhl-game-status.model";
import {NhlLinescoreModel} from "@shared/models/nhl-linescore/nhl-linescore.model";
import {NhlSeriesSummaryModel} from "@shared/models/nhl-playoffs/nhl-series-summary.model";
import {NhlBroadcastModel} from "@shared/models/nhl-general/nhl-broadcast.model";

export class NhlGameModel {

  public gamePk: number;

  public link: string;

  public gameType: string;

  public season: string;

  public gameDate: string;

  public status: NhlGameStatusModel;

  public teams: NhlHomeAwayGameTeamModel;

  public linescore: NhlLinescoreModel;

  public venue: NhlVenueModel;

  public content: Object;

  public seriesSummary: NhlSeriesSummaryModel;

  public broadcasts: NhlBroadcastModel[];

}
