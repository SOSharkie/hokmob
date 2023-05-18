import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlConferenceModel} from "@shared/models/nhl-general/nhl-conference.model";
import {NhlDivisionModel} from "@shared/models/nhl-general/nhl-division.model";
import {NhlTeamRecordModel} from "@shared/models/nhl-general/nhl-team-record.model";

export class NhlStandingsModel {

  public standingsType: NhlStandingsTypeEnum;

  public league: NhlConferenceModel;

  public conference: NhlConferenceModel;

  public division: NhlDivisionModel;

  public season: string;

  public teamRecords: NhlTeamRecordModel[];

}
