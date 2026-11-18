import {Component, Input, OnChanges, ChangeDetectionStrategy} from '@angular/core';
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {TeamRatingUtils, TeamScoreBar} from "@shared/utils/team-rating-utils";

/**
 * One row of a team stats card: a stat's value and the team's rank in the league for it.
 */
export interface TeamStatRow {
  label: string;
  value: string;
  /** Like "9th". */
  rank: string;
  /** What the stat is, for a tooltip. */
  description?: string;
}

/**
 * A row of the team stats card, with its bar from the league average, scored like the power rating's stats.
 */
export interface TeamStatBarRow extends TeamStatRow, TeamScoreBar {}

/** A stat of the team stats card. Per-game stats have two decimals unless `decimals` says otherwise. */
interface TeamStatDefinition {
  label: string;
  field: keyof TeamSeasonStats;
  percentage?: boolean;
  decimals?: number;
  /** For goals and shots against. */
  lowerIsBetter?: boolean;
}

/**
 * The team's season stats with their league ranks, from every team's stats API row (/api/nhl-stats/teams), laid out
 * like the power rating card's stats: each stat with its value, rank and a bar from the league average, in the HokMob
 * rating color of its score. The scores are the power rating's: 5 at the league average and 1.5 points per standard
 * deviation from it. The card
 * isn't shown when the team has no row for the season, like a season before its first game or a former team.
 */
@Component({
    selector: 'app-team-stats',
    templateUrl: './team-stats.component.html',
    styleUrls: ['./team-stats.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamStatsComponent implements OnChanges {

  @Input()
  public teamId: number;

  /**
   * Every team's stats for the season. The team's own row is picked out of it, and the ranks and scores are worked out
   * from all the rows.
   */
  @Input()
  public teamStats: TeamSeasonStats[];

  /** Whether the stats are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /**
   * The skeleton's rows: one per stat, like the rating bar card's, 48px tall or 44px on a phone (now and then 45px, as
   * the bold value lines up). The card's 10px bottom padding is 9px here, since the last real row has no border.
   */
  public readonly skeletonLayout: SkeletonCardLayout = {
    rows: TeamStatsComponent.stats.length, rowHeight: 48, paddingBottom: 9
  };

  public readonly skeletonMobileLayout: SkeletonCardLayout = {rowHeight: 44};

  /** The team's row, or undefined without one. */
  public team: TeamSeasonStats;

  public rows: TeamStatBarRow[] = [];

  public title: string = "Team Stats";

  /** The stats shown, in order. */
  private static readonly stats: TeamStatDefinition[] = [
    {label: "Points %", field: "pointPct", percentage: true},
    {label: "Power Play %", field: "powerPlayPct", percentage: true},
    {label: "Penalty Kill %", field: "penaltyKillPct", percentage: true},
    {label: "Goals For / Game", field: "goalsForPerGame"},
    {label: "Goals Against / Game", field: "goalsAgainstPerGame", lowerIsBetter: true},
    {label: "Shots For / Game", field: "shotsForPerGame", decimals: 1},
    {label: "Shots Against / Game", field: "shotsAgainstPerGame", decimals: 1, lowerIsBetter: true},
    {label: "Faceoff %", field: "faceoffWinPct", percentage: true}
  ];

  public ngOnChanges(): void {
    this.team = (this.teamStats ?? []).find(stats => stats.teamId === this.teamId);
    if (!this.team) {
      this.rows = [];
      return;
    }
    this.title = DateTimeUtils.getNhlSeasonDisplayValue(String(this.team.seasonId)) + " Team Stats";
    this.rows = TeamStatsComponent.stats.map(stat => this.getRow(stat));
  }

  /**
   * The team's row for a stat: its value, league rank and bar, scored against every team's value.
   */
  private getRow(stat: TeamStatDefinition): TeamStatBarRow {
    const teams = this.teamStats ?? [];
    const values = teams.map(stats => stats[stat.field] as number);
    const scores = TeamRatingUtils.getScores(values, stat.lowerIsBetter);
    const value = this.team[stat.field] as number;
    return {
      label: stat.label,
      value: TeamStatsComponent.formatValue(value, stat.percentage, stat.decimals),
      rank: this.getRank(value, stat.field, stat.lowerIsBetter),
      ...TeamRatingUtils.getScoreBar(scores[teams.indexOf(this.team)])
    };
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
    return TeamRatingUtils.getOrdinal(better.length + 1);
  }
}
