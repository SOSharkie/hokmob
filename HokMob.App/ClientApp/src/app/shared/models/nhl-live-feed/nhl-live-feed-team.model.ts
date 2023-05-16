import {NhlVenueModel} from "@shared/models/nhl-general/nhl-venue.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

export class NhlLiveFeedTeamModel extends NhlTeamModel{

  public venue: NhlVenueModel;

  public abbreviation: string;

  public teamName: string;

  public locationName: string;

  public firstYearOfPlay: string;

  public division: {
    id: number,
    name: string,
    nameShort: string,
    link: string,
    abbreviation: string
  };

  public conference: {
    id: number,
    name: string,
    link: string
  };

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
