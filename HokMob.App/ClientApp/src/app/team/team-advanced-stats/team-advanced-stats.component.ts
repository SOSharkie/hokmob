import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {TeamMetricId, TeamRating, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {TeamStatBarRow} from "@app/team/team-stats/team-stats.component";

/**
 * The team's advanced stats with their league ranks: goal and special teams differentials, Corsi and the 5v5
 * percentages, worked out from every team's games (TeamRatingUtils). Laid out like the power rating card's stats, each
 * with a bar from the league average in the HokMob rating color of its score (TeamRating.scores). Points % is in the
 * team stats card instead, and Fenwick and PDO are only on the teams page. 5v5 xGF% is Natural Stat Trick's, credited
 * under the power rating card, and left out when the games have no expected goals. Not shown before the team's first
 * game.
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

  public rows: TeamStatBarRow[] = [];

  public title: string = "Advanced Stats";

  /** Whether the team has Natural Stat Trick's expected goals, so the xGF% row is shown. */
  public hasExpectedGoals: boolean = false;

  /** The stats shown, in order. NST's 5v5 xGF% comes after Corsi. */
  public static readonly rowIds: TeamMetricId[] = [
    "goalDiff", "specialTeams", "corsi", "expectedGoals", "shotShare", "goalShare5v5", "shooting5v5", "save5v5"
  ];

  public ngOnChanges(): void {
    this.title = (this.season ? DateTimeUtils.getNhlSeasonDisplayValue(String(this.season)) + " " : "") + "Advanced Stats";
    const team = (this.ratings ?? []).find(rating => rating.teamId === this.teamId);
    this.hasExpectedGoals = team?.values.expectedGoals != null;
    this.rows = team ? TeamAdvancedStatsComponent.rowIds
        .filter(id => id !== "expectedGoals" || this.hasExpectedGoals)
        .map(id => TeamAdvancedStatsComponent.getMetricRow(team, id)) : [];
  }

  private static getMetricRow(team: TeamRating, id: TeamMetricId): TeamStatBarRow {
    const metric = TeamRatingUtils.getMetric(id);
    const value = team.values[id];
    return {
      label: metric.label,
      value: value == null ? "-" : metric.format(value),
      rank: TeamRatingUtils.getOrdinal(team.ranks[id]),
      description: metric.description,
      ...TeamRatingUtils.getScoreBar(value == null ? null : team.scores[id])
    };
  }
}
