import {NhlVenueModel} from "@shared/models/nhl-general/nhl-venue.model";

export class NhlLiveFeedTeamModel {

  public id: number;

  public name: string;

  public link: string;

  public venue: NhlVenueModel;

  public abbreviation: string;

  public triCode: string;

  public teamName: string;

  public locationName: string;

  public firstYearOfPlay: string;

  public division: Object;

  public conference: Object;

  public franchise: {
    franchiseId: number,
    teamName: string,
    link: string
  };

  public shortName: string;

  public officialSiteUrl: string;

  public franchiseId: number;

  public active: boolean;



}
