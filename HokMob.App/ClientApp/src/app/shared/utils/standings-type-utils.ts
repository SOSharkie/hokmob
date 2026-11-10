import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";

/**
 * A standings type a page's filter buttons can pick, with its button label.
 */
export interface StandingsTypeFilter {
  type: NhlStandingsTypeEnum;
  label: string;
}

/**
 * The standings filters shared by the standings page and the team page's standings tab, which both keep the picked
 * type in the standingsType query parameter.
 */
export class StandingsTypeUtils {

  /** The filter buttons, in order. */
  public static readonly filters: StandingsTypeFilter[] = [
    {type: NhlStandingsTypeEnum.BY_LEAGUE, label: "League"},
    {type: NhlStandingsTypeEnum.BY_CONFERENCE, label: "Conference"},
    {type: NhlStandingsTypeEnum.BY_DIVISION, label: "Division"},
    {type: NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS, label: "Playoffs"}
  ];

  /**
   * The filter's standings type of a standingsType query parameter, or undefined without one or for a type no
   * filter has.
   *
   * @param value - The query parameter, like "byDivision".
   */
  public static fromQueryParam(value: string): NhlStandingsTypeEnum {
    return StandingsTypeUtils.filters.find(filter => filter.type.toString() === value)?.type;
  }
}
