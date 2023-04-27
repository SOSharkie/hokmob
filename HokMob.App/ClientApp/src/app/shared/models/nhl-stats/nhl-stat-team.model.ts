import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";

export class NhlStatTeamModel {

  public id: number;

  public franchiseId: number;

  public name: string;

  public abbreviation: string;

  public shortName: string;

  public teamName: string;

  public conference: any;

  public division: any;

  public firstYearOfPlay: string;

  public link: string;

  public locationName: string;

  public officialSiteUrl: string;

  public roster: {
    link: string,
    roster: NhlPlayerModel[]
  };
}
