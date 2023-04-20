import {NhlPlayoffSeriesModel} from "@shared/models/nhl-playoffs/nhl-playoff-series.model";

export class NhlPlayoffRoundModel {

  public number: number;

  public code: number;

  public names: {
    name: string,
    shortName: string
  };

  public format: {
    name: string,
    description: string,
    numberOfGames: number,
    numberOfWins: number
  };

  public series: NhlPlayoffSeriesModel[];
}
