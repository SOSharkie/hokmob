/**
 * An NHL team, from the hard-coded list in NhlTeamUtils. The new NHL API has no team list endpoint with logos or
 * colors, and standings rows only have abbreviations, so teams are looked up by ID here.
 */
export class NhlTeamCustomModel {

  /** The NHL team ID, like 52. */
  public id: number;

  /** The full name, like "Winnipeg Jets". */
  public name: string;

  /** The place, like "Winnipeg". */
  public shortName: string;

  /** The common name, like "Jets". */
  public teamName: string;

  /** The abbreviation, like "WPG". */
  public triCode: string;

}
