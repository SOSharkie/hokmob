import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";
import {NhlConferenceModel} from "@shared/models/nhl-general/nhl-conference.model";
import {NhlDivisionModel} from "@shared/models/nhl-general/nhl-division.model";

export class NhlStatTeamModel {

  public id: number;

  public franchiseId: number;

  public name: string;

  public abbreviation: string;

  public shortName: string;

  public teamName: string;

  public conference: NhlConferenceModel;

  public division: NhlDivisionModel;

  public firstYearOfPlay: string;

  public link: string;

  public locationName: string;

  public officialSiteUrl: string;

  public roster: {
    link: string,
    roster: NhlPlayerModel[]
  };
}
