import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlPositionModel} from "@shared/models/nhl-general/nhl-position.model";
import {NhlStatsTypeModel} from "@shared/models/nhl-stats/nhl-stats-type.model";

export class NhlPersonModel {

  public id: number;

  public fullName: string;

  public link: string;

  public firstName: string;

  public lastName: string;

  public primaryNumber: string;

  public birthDate: string;

  public currentAge: number;

  public birthCity: string;

  public birthStateProvince: string;

  public birthCountry: string;

  public nationality: string;

  public height: string;

  public weight: number;

  public active: true;

  public alternateCaptain: true;

  public captain: true;

  public rookie: true;

  public shootsCatches: string;

  public rosterStatus: string;

  public currentTeam: NhlTeamModel;

  public primaryPosition: NhlPositionModel;

  public stats: NhlStatsTypeModel[];
}
