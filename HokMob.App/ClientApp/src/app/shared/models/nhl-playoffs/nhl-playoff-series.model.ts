import {NhlSeriesSummaryModel} from "@shared/models/nhl-playoffs/nhl-series-summary.model";
import {NhlPlayoffMatchupTeamModel} from "@shared/models/nhl-playoffs/nhl-playoff-matchup-team.model";

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

  public conference: {
    id: number,
    name: string,
    link: string
  }

  public round: {
    number: number
  }

  public matchupTeams: NhlPlayoffMatchupTeamModel[];
}
