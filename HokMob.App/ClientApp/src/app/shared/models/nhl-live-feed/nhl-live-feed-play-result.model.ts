import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

export class NhlLiveFeedPlayResultModel {

  public event: string;

  public eventCode: string;

  public eventTypeId: string;

  public description: string;

  public secondaryType: string;

  public penaltySeverity: string;

  public penaltyMinutes: string;

  public gameWinningGoal: string;

  public emptyNet: boolean;

  public strength: {
    code: string,
    name: string
  }
}
