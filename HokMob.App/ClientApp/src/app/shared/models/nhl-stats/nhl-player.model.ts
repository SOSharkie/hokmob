import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlPositionModel} from "@shared/models/nhl-general/nhl-position.model";

export class NhlPlayerModel {

  public person: NhlPersonModel;

  public jerseyNumber: string;

  public position: NhlPositionModel;

}
