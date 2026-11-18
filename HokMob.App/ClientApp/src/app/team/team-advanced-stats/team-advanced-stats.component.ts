import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {TeamMetricId, TeamRating, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {TeamStatBarRow, TeamStatGroup} from "@app/team/team-stats/team-stats.component";

/**
 * The team's advanced stats with their league ranks: goal and special teams differentials, Corsi and the 5v5
 * percentages, worked out from every team's games (TeamRatingUtils). Laid out in groups like the team stats card, each
 * stat with its rank in a pill and a bar from the league average (TeamRating.scores), colored at the ends of the league.
 * Points % is in the team stats card instead, and Fenwick and PDO are only on the teams page. 5v5 xGF% is Natural Stat
 * Trick's, credited under the power rating card, and left out when the games have no expected goals. Not shown before
 * the team's first game.
 */
@Component({
    selector: 'app-team-advanced-stats',
    templateUrl: './team-advanced-stats.component.html',
    styleUrls: ['./team-advanced-stats.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamAdvancedStatsComponent implements OnChanges {

  @Input()
  public teamId: number;

  /** Every team's rating of the season, from TeamRatingUtils.getLeagueRatings. */
  @Input()
  public ratings: TeamRating[];

  /** Whether the ratings are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /**
   * The skeleton: a bar row per stat (8 with expected goals, which most seasons have), spread over the height the rows
   * and their group titles take, like the team stats card's.
   */
  public readonly skeletonLayout: SkeletonCardLayout = {
    rows: TeamAdvancedStatsComponent.rowIds.length, headerHeight: 48, rowHeight: 57, paddingBottom: 18
  };

  public groups: TeamStatGroup[] = [];

  public readonly title: string = "Advanced Stats";

  /** Whether the team has Natural Stat Trick's expected goals, so the xGF% row is shown. */
  public hasExpectedGoals: boolean = false;

  /** The stats shown, in their groups and order. NST's 5v5 xGF% comes after Corsi. */
  public static readonly rowGroups: {title: string, ids: TeamMetricId[]}[] = [
    {title: "Goal margins", ids: ["goalDiff", "specialTeams", "goalShare5v5"]},
    {title: "Shot share", ids: ["corsi", "expectedGoals", "shotShare"]},
    {title: "Finishing & goaltending", ids: ["shooting5v5", "save5v5"]}
  ];

  public static readonly rowIds: TeamMetricId[] = TeamAdvancedStatsComponent.rowGroups.flatMap(group => group.ids);

  /** Every group's rows, in order. */
  public get rows(): TeamStatBarRow[] {
    return this.groups.flatMap(group => group.rows);
  }

  public ngOnChanges(): void {
    const ratings = this.ratings ?? [];
    const team = ratings.find(rating => rating.teamId === this.teamId);
    this.hasExpectedGoals = team?.values.expectedGoals != null;
    this.groups = team ? TeamAdvancedStatsComponent.rowGroups.map(group => ({
      title: group.title,
      rows: group.ids
          .filter(id => id !== "expectedGoals" || this.hasExpectedGoals)
          .map(id => TeamAdvancedStatsComponent.getMetricRow(team, id, ratings.length))
    })) : [];
  }

  private static getMetricRow(team: TeamRating, id: TeamMetricId, teamCount: number): TeamStatBarRow {
    const metric = TeamRatingUtils.getMetric(id);
    const value = team.values[id];
    return {
      label: metric.label,
      value: value == null ? "-" : metric.format(value),
      rank: TeamRatingUtils.getOrdinal(team.ranks[id]),
      rankTier: TeamRatingUtils.getRankTier(team.ranks[id], teamCount),
      description: metric.description,
      ...TeamRatingUtils.getScoreBar(value == null ? null : team.scores[id])
    };
  }
}
