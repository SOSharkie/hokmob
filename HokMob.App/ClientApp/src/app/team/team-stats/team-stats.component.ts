import {Component, Input, OnChanges} from '@angular/core';
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

/**
 * One row of the team stats card: a stat's value and the team's rank in the league for it.
 */
export interface TeamStatRow {
  label: string;
  value: string;
  /** Like "9th". */
  rank: string;
}

/**
 * The team's season stats with their league ranks, from every team's stats API row (/api/nhl-stats/teams). The card
 * isn't shown when the team has no row for the season, like a season before its first game or a former team.
 */
@Component({
  selector: 'app-team-stats',
  templateUrl: './team-stats.component.html',
  styleUrls: ['./team-stats.component.scss']
})
export class TeamStatsComponent implements OnChanges {

  @Input()
  public teamId: number;

  /**
   * Every team's stats for the season. The team's own row is picked out of it, and the ranks are worked out from all
   * the rows.
   */
  @Input()
  public teamStats: TeamSeasonStats[];

  public rows: TeamStatRow[] = [];

  public title: string = "Team Stats";

  /**
   * The stats shown, in order. Per-game stats have two decimals unless `decimals` says otherwise. A lower value is
   * better for goals and shots against.
   */
  private static readonly stats: {label: string, field: keyof TeamSeasonStats, percentage?: boolean, decimals?: number, lowerIsBetter?: boolean}[] = [
    {label: "Power Play %", field: "powerPlayPct", percentage: true},
    {label: "Penalty Kill %", field: "penaltyKillPct", percentage: true},
    {label: "Goals For / Game", field: "goalsForPerGame"},
    {label: "Goals Against / Game", field: "goalsAgainstPerGame", lowerIsBetter: true},
    {label: "Shots For / Game", field: "shotsForPerGame", decimals: 1},
    {label: "Shots Against / Game", field: "shotsAgainstPerGame", decimals: 1, lowerIsBetter: true},
    {label: "Faceoff %", field: "faceoffWinPct", percentage: true}
  ];

  public ngOnChanges(): void {
    const team = (this.teamStats ?? []).find(stats => stats.teamId === this.teamId);
    if (!team) {
      this.rows = [];
      return;
    }
    this.title = DateTimeUtils.getNhlSeasonDisplayValue(String(team.seasonId)) + " Team Stats";
    this.rows = TeamStatsComponent.stats.map(stat => ({
      label: stat.label,
      value: TeamStatsComponent.formatValue(team[stat.field] as number, stat.percentage, stat.decimals),
      rank: this.getRank(team[stat.field] as number, stat.field, stat.lowerIsBetter)
    }));
  }

  /**
   * A percentage as "23.4%", any other stat with the given decimals (two by default). Missing values show a dash.
   */
  private static formatValue(value: number, percentage: boolean, decimals: number = 2): string {
    if (value == null) {
      return "-";
    }
    return percentage ? (value * 100).toFixed(1) + "%" : value.toFixed(decimals);
  }

  /**
   * The team's rank for a stat, like "9th": one more than the number of teams that are strictly better, so teams with
   * the same value share a rank.
   */
  private getRank(value: number, field: keyof TeamSeasonStats, lowerIsBetter: boolean): string {
    if (value == null) {
      return "";
    }
    const better = (this.teamStats ?? []).filter(stats => {
      const otherValue = stats[field] as number;
      return otherValue != null && (lowerIsBetter ? otherValue < value : otherValue > value);
    });
    return TeamStatsComponent.getOrdinal(better.length + 1);
  }

  /**
   * A rank with its suffix, like 1 to "1st", 2 to "2nd" and 11 to "11th".
   */
  private static getOrdinal(rank: number): string {
    const lastTwoDigits = rank % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return rank + "th";
    }
    switch (rank % 10) {
      case 1:
        return rank + "st";
      case 2:
        return rank + "nd";
      case 3:
        return rank + "rd";
      default:
        return rank + "th";
    }
  }
}
