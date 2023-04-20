import {NhlPlayoffRoundModel} from "@shared/models/nhl-playoffs/nhl-playoff-round.model";


export class NhlPlayoffModel {

  public copyright: string;

  public id: number;

  public name: string;

  public season: string;

  public defaultRound: number;

  public rounds: NhlPlayoffRoundModel[];
}
