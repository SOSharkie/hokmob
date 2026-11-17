import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {TeamRating, TeamRatingPoint, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";

/**
 * One part of the power rating: a rated stat, its share of the rating, and how it compares to the league.
 */
export interface PowerRatingPart {
  label: string;
  description: string;
  /** Like "30%". */
  weight: string;
  value: string;
  rank: string;
  /**
   * Where the stat's bar starts and how wide it is, in % of the 0 to 10 track: from the league average (5, the middle)
   * to the score.
   */
  barStart: number;
  barWidth: number;
  barColor: string;
  /** Whether the team is above the league average for it, for the bar's side. */
  isAboveAverage: boolean;
}

/**
 * The team's HokMob power rating card: the rating in its color, its league rank and its change over the last 5 games,
 * and each rated stat with its weight, value, league rank and a bar from the league average. The stats and weights are
 * the ones the rating was worked out with: with Natural Stat Trick's expected goals, credited under the card, or from
 * the NHL's stats alone when there are none. See TeamRatingUtils for how it's worked out.
 */
@Component({
    selector: 'app-team-power-rating',
    templateUrl: './team-power-rating.component.html',
    styleUrls: ['./team-power-rating.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamPowerRatingComponent implements OnChanges {

  @Input()
  public teamId: number;

  /** Every team's rating of the season, from TeamRatingUtils.getLeagueRatings. */
  @Input()
  public ratings: TeamRating[];

  /** The team's rating after each game (TeamRatingUtils.getTimeline), for its recent change. */
  @Input()
  public timeline: TeamRatingPoint[];

  /** The games the recent change is over. */
  public static readonly trendGames = 5;

  public readonly nstUrl: string = NstStatsUtils.teamTableUrl;

  public team: TeamRating;

  public parts: PowerRatingPart[] = [];

  /** The change in rating over the last 5 games, or null before the team has played 6. */
  public change: number = null;

  public get rating(): string {
    return TeamRatingUtils.formatRating(this.team?.rating);
  }

  public get ratingColor(): string {
    return TeamRatingUtils.getRatingColor(this.team?.rating);
  }

  /** Like "8th of 32". */
  public get rankLabel(): string {
    return TeamRatingUtils.getOrdinal(this.team?.rank) + " of " + (this.ratings ?? []).length;
  }

  public get gamesLabel(): string {
    const games = this.team?.gamesPlayed ?? 0;
    return "Through " + games + (games === 1 ? " game" : " games");
  }

  /** Like "+4.2" or "-1.0". */
  public get changeLabel(): string {
    if (this.change == null) {
      return "";
    }
    const rounded = Math.abs(this.change).toFixed(1);
    return rounded === "0.0" ? "0.0" : (this.change > 0 ? "+" : "-") + rounded;
  }

  public get changeDirection(): "up" | "down" | "flat" {
    const rounded = Math.round((this.change ?? 0) * 10);
    return rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  }

  public get trendGames(): number {
    return TeamPowerRatingComponent.trendGames;
  }

  /**
   * Whether the rating counts Natural Stat Trick's expected goals, so the card credits it. Without them the rating is
   * worked out from the NHL's stats alone, and the card says so.
   */
  public get hasExpectedGoals(): boolean {
    return !!this.team?.hasExpectedGoals;
  }

  public ngOnChanges(): void {
    this.team = (this.ratings ?? []).find(rating => rating.teamId === this.teamId);
    this.parts = this.team ? TeamRatingUtils.getRatedMetrics(this.team.weights).map(metric => {
      const score = this.team.scores[metric.id];
      const value = this.team.values[metric.id];
      const average = TeamRatingUtils.averageRating;
      const toTrack = (rating: number) => rating / TeamRatingUtils.maxRating * 100;
      return {
        label: metric.label,
        description: metric.description,
        weight: Math.round(this.team.weights[metric.id] * 100) + "%",
        value: value == null ? "-" : metric.format(value),
        rank: TeamRatingUtils.getOrdinal(this.team.ranks[metric.id]),
        barStart: toTrack(Math.min(score, average)),
        barWidth: toTrack(Math.abs(score - average)),
        barColor: TeamRatingUtils.getRatingColor(score),
        isAboveAverage: score >= average
      };
    }) : [];
    const points = this.timeline ?? [];
    const trendGames = TeamPowerRatingComponent.trendGames;
    this.change = points.length > trendGames
        ? points[points.length - 1].rating - points[points.length - 1 - trendGames].rating
        : null;
  }
}
