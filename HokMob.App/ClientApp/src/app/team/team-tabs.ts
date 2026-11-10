/**
 * The team page's tabs. The ID is the tab query parameter (/team/6?tab=player-stats); the overview is the page without
 * one.
 */
export type TeamTabId = "overview" | "standings" | "player-stats" | "team-stats" | "games";

export interface TeamTab {
  id: TeamTabId;
  label: string;
}

export class TeamTabs {

  /** The tabs, in the order of the tab bar. The first one is the default. */
  public static readonly tabs: TeamTab[] = [
    {id: "overview", label: "Overview"},
    {id: "standings", label: "Standings"},
    {id: "player-stats", label: "Player Stats"},
    {id: "team-stats", label: "Team Stats"},
    {id: "games", label: "Games"}
  ];

  public static readonly defaultTab: TeamTabId = "overview";

  /**
   * The tab of a tab query parameter, or the overview without one or for an unknown one.
   *
   * @param value - The tab query parameter, like "player-stats".
   */
  public static fromQueryParam(value: string): TeamTabId {
    return TeamTabs.tabs.find(tab => tab.id === value)?.id ?? TeamTabs.defaultTab;
  }
}
