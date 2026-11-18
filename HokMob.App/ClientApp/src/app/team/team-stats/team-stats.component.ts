import {Component, Input, OnChanges, ChangeDetectionStrategy} from '@angular/core';
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {TeamRankTier, TeamRatingUtils, TeamScoreBar} from "@shared/utils/team-rating-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

/**
 * One row of a team stats card: a stat's value and the team's rank in the league for it.
 */
export interface TeamStatRow {
  label: string;
  /** Like "Goals for", for a compact card. */
  shortLabel?: string;
  value: string;
  /** Like "9th". */
  rank: string;
  /** Where the rank stands in the league, for the color of its pill and bar. */
  rankTier: TeamRankTier;
  /** What the stat is, for a tooltip. */
  description?: string;
}

/**
 * A row of the team stats card, with its bar from the league average, scored like the power rating's stats.
 */
export interface TeamStatBarRow extends TeamStatRow, TeamScoreBar {}

/** A titled group of a team stats card's rows, like "Special teams". */
export interface TeamStatGroup {
  title: string;
  rows: TeamStatBarRow[];
}

/** A stat of the team stats card. Per-game stats have two decimals unless `decimals` says otherwise. */
interface TeamStatDefinition {
  label: string;
  shortLabel: string;
  field: keyof TeamSeasonStats;
  percentage?: boolean;
  decimals?: number;
  /** For goals and shots against. */
  lowerIsBetter?: boolean;
}

/**
 * The team's season stats with their league ranks, from every team's stats API row (/api/nhl-stats/teams), in groups
 * laid out like the power rating card's stats: each stat with its value, its rank in a pill and a bar from the league
 * average, the pill and bar colored at the ends of the league (TeamRatingUtils.getRankTier). The bars are scored like
 * the power rating's stats: 5 at the league average and 1.5 points per standard deviation from it. The card isn't
 * shown when the team has no row for the season, like a season before its first game or a former team.
 *
 * Like the power rating card, it goes compact under 340px wide in a `power-rating` size container, with the stats'
 * short names, and shows an element with a `cardAction` attribute in its header's top right corner.
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

  /**
   * Whether the header names the team, with its logo, like "Sharks", for a page that shows more than one team's card,
   * like a future game's.
   */
  @Input()
  public showTeam: boolean = false;

  /** Whether the stats are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /**
   * The skeleton: a bar row per stat, spread over the height the rows and their group titles take, so it's the card's
   * size.
   */
  public readonly skeletonLayout: SkeletonCardLayout = {
    rows: TeamStatsComponent.stats.length, headerHeight: 48, rowHeight: 57, paddingBottom: 18
  };

  /** The team's row, or undefined without one. */
  public team: TeamSeasonStats;

  public groups: TeamStatGroup[] = [];

  /** "Team Stats", or the team's name, like "Sharks", with showTeam. */
  public get title(): string {
    const teamName = this.showTeam ? NhlTeamUtils.getTeam(this.teamId)?.teamName : null;
    return teamName || "Team Stats";
  }

  /** The compact card's title: like "SJS" with showTeam, the logo beside it, or else the title. */
  public get shortTitle(): string {
    const triCode = this.showTeam ? NhlTeamUtils.getTeam(this.teamId)?.triCode : null;
    return triCode || this.title;
  }

  public get teamLogo(): string {
    return NhlTeamLogoUtils.getTeamPrimaryLogo(this.teamId);
  }

  /** The stats shown, in their groups and order. */
  private static readonly statGroups: {title: string, stats: TeamStatDefinition[]}[] = [
    {
      title: "Results",
      stats: [
        {label: "Points %", shortLabel: "Points %", field: "pointPct", percentage: true},
        {label: "Goals For / Game", shortLabel: "Goals for", field: "goalsForPerGame"},
        {label: "Goals Against / Game", shortLabel: "Goals against", field: "goalsAgainstPerGame", lowerIsBetter: true}
      ]
    },
    {
      title: "Special teams",
      stats: [
        {label: "Power Play %", shortLabel: "Power play", field: "powerPlayPct", percentage: true},
        {label: "Penalty Kill %", shortLabel: "Penalty kill", field: "penaltyKillPct", percentage: true}
      ]
    },
    {
      title: "Shots & draws",
      stats: [
        {label: "Shots For / Game", shortLabel: "Shots for", field: "shotsForPerGame", decimals: 1},
        {label: "Shots Against / Game", shortLabel: "Shots against", field: "shotsAgainstPerGame", decimals: 1, lowerIsBetter: true},
        {label: "Faceoff %", shortLabel: "Faceoffs", field: "faceoffWinPct", percentage: true}
      ]
    }
  ];

  private static readonly stats: TeamStatDefinition[] = TeamStatsComponent.statGroups.flatMap(group => group.stats);

  /** Every group's rows, in order. */
  public get rows(): TeamStatBarRow[] {
    return this.groups.flatMap(group => group.rows);
  }

  public ngOnChanges(): void {
    this.team = (this.teamStats ?? []).find(stats => stats.teamId === this.teamId);
    this.groups = this.team ? TeamStatsComponent.statGroups.map(group => ({
      title: group.title,
      rows: group.stats.map(stat => this.getRow(stat))
    })) : [];
  }

  /**
   * The team's row for a stat: its value, league rank and bar, scored against every team's value.
   */
  private getRow(stat: TeamStatDefinition): TeamStatBarRow {
    const teams = this.teamStats ?? [];
    const values = teams.map(stats => stats[stat.field] as number);
    const scores = TeamRatingUtils.getScores(values, stat.lowerIsBetter);
    const value = this.team[stat.field] as number;
    const rank = this.getRank(value, stat.field, stat.lowerIsBetter);
    return {
      label: stat.label,
      shortLabel: stat.shortLabel,
      value: TeamStatsComponent.formatValue(value, stat.percentage, stat.decimals),
      rank: TeamRatingUtils.getOrdinal(rank),
      rankTier: TeamRatingUtils.getRankTier(rank, teams.length),
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
   * The team's rank for a stat: one more than the number of teams that are strictly better, so teams with the same
   * value share a rank. Null for a missing value.
   */
  private getRank(value: number, field: keyof TeamSeasonStats, lowerIsBetter: boolean): number {
    if (value == null) {
      return null;
    }
    const better = (this.teamStats ?? []).filter(stats => {
      const otherValue = stats[field] as number;
      return otherValue != null && (lowerIsBetter ? otherValue < value : otherValue > value);
    });
    return better.length + 1;
  }
}
