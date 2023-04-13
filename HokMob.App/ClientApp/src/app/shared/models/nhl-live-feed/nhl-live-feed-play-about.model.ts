
export class NhlLiveFeedPlayAboutModel {

  public eventIdx: number;

  public eventId: number;

  public period: number;

  public periodType: string;

  public ordinalNum: string;

  public periodTime: string;

  public periodTimeRemaining: string;

  public dateTime: string;

  public goals: {
    home: number,
    away: number
  };
}
