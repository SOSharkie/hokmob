
export class NhlBoxscorePlayerGoalieStatsModel {

  public timeOnIce: string;

  public goals: number;

  public assists: number;

  public evenSaves: number;

  public evenShotsAgainst: number;

  public evenStrengthSavePercentage: number;

  public pim: number;

  public powerPlaySaves: number;

  public powerPlayShotsAgainst: number;

  public savePercentage: number;

  public saves: number;

  public shortHandedSaves: number;

  public shortHandedShotsAgainst: number;

  public shots: number;

  /**
   * Not provided by NHL API, calculated in frontend.
   */
  public hokmobRating: number;
}
