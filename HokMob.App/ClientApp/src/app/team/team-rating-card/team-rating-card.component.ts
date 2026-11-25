import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TeamRating, TeamRatingPoint} from "@shared/utils/team-rating-utils";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";

/** Which card a TeamRatingCardComponent shows: the power rating or the team's season stats. */
export type TeamRatingCardView = "power" | "stats";

/**
 * A team's power rating card (TeamPowerRatingComponent) or its season stats card (TeamStatsComponent), one at a time,
 * with a toggle in the header's top right corner (TeamRatingViewToggleComponent) to switch between them: the team
 * page's overview. The power rating shows first. The toggle only shows when the team has both, so a team without a rating yet
 * (before its first game, or when the season's games can't be loaded) shows its stats alone, and the other way round.
 * While the shown card's data loads, it shows its skeleton.
 *
 * The card is a `power-rating` size container, so under 340px wide both cards go compact, and the toggle's labels
 * only show when it's wide enough for them.
 */
@Component({
    selector: 'app-team-rating-card',
    templateUrl: './team-rating-card.component.html',
    styleUrls: ['./team-rating-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamRatingCardComponent {

  @Input()
  public teamId: number;

  /** Every team's rating of the season, from TeamRatingUtils.getLeagueRatings. */
  @Input()
  public ratings: TeamRating[] = [];

  /** The team's rating after each game, for the power rating's recent change. */
  @Input()
  public timeline: TeamRatingPoint[] = [];

  /** Whether the ratings are still loading. */
  @Input()
  public ratingLoading: boolean = false;

  /** Every team's season stats, for the stats card's values and ranks. */
  @Input()
  public teamStats: TeamSeasonStats[] = [];

  /** Whether the season stats are still loading. */
  @Input()
  public statsLoading: boolean = false;

  /** The card picked with the toggle. */
  @Input()
  public view: TeamRatingCardView = "power";

  @Output()
  public viewChange = new EventEmitter<TeamRatingCardView>();

  /** Whether the team is rated, so the power rating card has something to show. */
  public get hasRating(): boolean {
    return (this.ratings ?? []).some(rating => rating.teamId === this.teamId);
  }

  /** Whether the stats have the team's row, so the stats card has something to show. */
  public get hasStats(): boolean {
    return (this.teamStats ?? []).some(stats => stats.teamId === this.teamId);
  }

  /**
   * The card shown: the picked one while it's loading or has something to show, or else the other one.
   */
  public get shownView(): TeamRatingCardView {
    if (this.view === "stats") {
      return this.hasStats || this.statsLoading ? "stats" : "power";
    }
    return this.hasRating || this.ratingLoading ? "power" : "stats";
  }

  /** Whether both cards are ready, so the toggle can switch between them. */
  public get canToggle(): boolean {
    return this.hasRating && !this.ratingLoading && this.hasStats && !this.statsLoading;
  }

  /**
   * Shows a card and tells the page.
   */
  public selectView(view: TeamRatingCardView): void {
    if (view === this.view) {
      return;
    }
    this.view = view;
    this.viewChange.emit(view);
  }
}
