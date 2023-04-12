import {NhlLinescorePeriodModel} from "@shared/models/nhl-linescore/nhl-linescore-period.model";
import {NhlHomeAwayLinescoreTeamModel} from "@shared/models/nhl-linescore/nhl-home-away-linescore-team.model";

export class NhlLinescoreModel {

  public currentPeriod: number;

  public currentPeriodOrdinal: string;

  public currentPeriodTimeRemaining: string;

  public periods: NhlLinescorePeriodModel[];

  public shootoutInfo: Object;

  public teams: NhlHomeAwayLinescoreTeamModel;

  public powerPlayStrength: string;

  public hasShootout: boolean;

  public intermissionInfo: Object;

  public powerPlayInfo: Object;
}
