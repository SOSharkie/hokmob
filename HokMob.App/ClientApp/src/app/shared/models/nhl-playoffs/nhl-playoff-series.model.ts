import {NhlSeriesSummaryModel} from "@shared/models/nhl-playoffs/nhl-series-summary.model";
import {NhlPlayoffMatchupTeamModel} from "@shared/models/nhl-playoffs/nhl-playoff-matchup-team.model";
import {NhlConferenceModel} from "@shared/models/nhl-general/nhl-conference.model";

export class NhlPlayoffSeriesModel {

  public seriesNumber: number;

  public seriesCode: string;

  public names: {
    matchupName: string,
    matchupShortName: string,
    teamAbbreviationA: string,
    teamAbbreviationB: string,
    seriesSlug: string
  };

  public currentGame: {
    seriesSummary: NhlSeriesSummaryModel;
  }

  public conference: NhlConferenceModel;

  public round: {
    number: number
  }

  public matchupTeams: NhlPlayoffMatchupTeamModel[];
}
