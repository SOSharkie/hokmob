import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {TeamMetricId, TeamRating, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {TeamStatRow} from "@app/team/team-stats/team-stats.component";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";

/**
 * The team's advanced stats with their league ranks: goal and special teams differentials, shot share (Corsi and
 * Fenwick), the 5v5 percentages and PDO, worked out from every team's games (TeamRatingUtils). Points % is in the team
 * stats card instead. 5v5 xGF% is Natural Stat Trick's, credited under the card, and left out when the games have no
 * expected goals. Not shown before the team's first game.
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

  /** The season, like 20262027, for the title. */
  @Input()
  public season: number;

  public rows: TeamStatRow[] = [];

  public title: string = "Advanced Stats";

  /** Whether the xGF% row is shown, so the card credits Natural Stat Trick. */
  public hasExpectedGoals: boolean = false;

  public readonly nstUrl: string = NstStatsUtils.teamTableUrl;

  /** The stats shown, in order. NST's 5v5 xGF% comes after the other shot shares. */
  public static readonly rowIds: TeamMetricId[] = [
    "goalDiff", "specialTeams", "corsi", "fenwick", "expectedGoals", "shotShare", "goalShare5v5", "shooting5v5",
    "save5v5", "pdo"
  ];

  public ngOnChanges(): void {
    this.title = (this.season ? DateTimeUtils.getNhlSeasonDisplayValue(String(this.season)) + " " : "") + "Advanced Stats";
    const team = (this.ratings ?? []).find(rating => rating.teamId === this.teamId);
    this.hasExpectedGoals = team?.values.expectedGoals != null;
    this.rows = team ? TeamAdvancedStatsComponent.rowIds
        .filter(id => id !== "expectedGoals" || this.hasExpectedGoals)
        .map(id => TeamAdvancedStatsComponent.getMetricRow(team, id)) : [];
  }

  private static getMetricRow(team: TeamRating, id: TeamMetricId): TeamStatRow {
    const metric = TeamRatingUtils.getMetric(id);
    const value = team.values[id];
    return {
      label: metric.label,
      value: value == null ? "-" : metric.format(value),
      rank: TeamRatingUtils.getOrdinal(team.ranks[id]),
      description: metric.description
    };
  }
}
