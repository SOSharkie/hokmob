
export class NhlBoxscorePlayerSkaterStatsModel {

  public timeOnIce: string;

  public goals: number;

  public assists: number;

  public shots: number;

  public hits: number;

  public powerPlayGoals: number;

  public powerPlayAssists: number;

  public penaltyMinutes: number;

  public faceOffPct: number;

  public faceOffWins: number;

  /**
   * Typo is in nhl api
   */
  public faceoffTaken: number;

  public takeaways: number;

  public giveaways: number;

  public shortHandedGoals: number;

  public shortHandedAssists: number;

  public blocked: number;

  public plusMinus: number;

  public evenTimeOnIce: string;

  public powerPlayTimeOnIce: string;

  public shortHandedTimeOnIce: string;

  /**
   * Not provided by NHL API, calculated in frontend.
   */
  public hokmobRating: number;

  /**
   * Not provided by NHL API, calculated in frontend.
   */
  public isGameMvp: boolean;
}
