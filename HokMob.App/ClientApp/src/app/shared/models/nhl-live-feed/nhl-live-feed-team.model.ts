import {NhlVenueModel} from "@shared/models/nhl-general/nhl-venue.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlConferenceModel} from "@shared/models/nhl-general/nhl-conference.model";
import {NhlDivisionModel} from "@shared/models/nhl-general/nhl-division.model";

export class NhlLiveFeedTeamModel extends NhlTeamModel{

  public venue: NhlVenueModel;

  public abbreviation: string;

  public teamName: string;

  public locationName: string;

  public firstYearOfPlay: string;

  public division: NhlDivisionModel;

  public conference: NhlConferenceModel;

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
