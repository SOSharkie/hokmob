import {Component, Input, ChangeDetectionStrategy} from '@angular/core';
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {PlayerSeasonRating, PlayerSeasonRatingUtils} from "@shared/utils/player-season-rating-utils";

/**
 * One season's stats card, from the stats API row of that season (/api/nhl-stats/player/{id}). A season with two
 * teams is already one row, so nothing is summed here. A season with a history file (SeasonHistoryService) also gets a
 * column on the right: the player's average HokMob rating, and below it a skater's 5v5 Corsi For % or a goalie's goals
 * saved above average.
 */
@Component({
    selector: 'app-player-stats',
    templateUrl: './player-stats.component.html',
    styleUrls: ['./player-stats.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PlayerStatsComponent {

  @Input()
  public statTitle: string;

  @Input()
  public stats: SkaterSeasonStats | GoalieSeasonStats;

  @Input()
  public isGoalie: boolean;

  /** The player's rated season, for the rating column. Undefined while it loads, or without one. */
  @Input()
  public seasonRating: PlayerSeasonRating;

  /** Whether the rated season is loading, so the column keeps its place with dashes instead of appearing late. */
  @Input()
  public ratingPending: boolean = false;

  /** Whether the stats are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /** Whether the card has the rating column. */
  public get showRating(): boolean {
    return this.ratingPending || !!this.seasonRating;
  }

  /** The skeleton's stat tiles: two rows of 4, and the rating column's 2 beside them when the card will have it. */
  public get skeletonLayout(): SkeletonCardLayout {
    return this.showRating ? PlayerStatsComponent.ratedSkeletonLayout : PlayerStatsComponent.unratedSkeletonLayout;
  }

  /** On a phone the stats keep their two rows, with the rating and its stat at the end of each, five to a row. */
  public get skeletonMobileLayout(): SkeletonCardLayout {
    return this.showRating ? PlayerStatsComponent.ratedSkeletonMobileLayout : PlayerStatsComponent.unratedSkeletonMobileLayout;
  }

  private static readonly ratedSkeletonLayout: SkeletonCardLayout = {
    rows: 2, rowHeight: 94.5, columns: 5, headerHeight: 51.5
  };

  private static readonly unratedSkeletonLayout: SkeletonCardLayout = {
    rows: 2, rowHeight: 94.5, columns: 4, headerHeight: 51.5
  };

  private static readonly ratedSkeletonMobileLayout: SkeletonCardLayout = {rows: 2, rowHeight: 94.5, columns: 5};

  private static readonly unratedSkeletonMobileLayout: SkeletonCardLayout = {rows: 2, rowHeight: 94.5, columns: 4};

  /** The average rating, like "7.12", or a dash while it loads. */
  public get averageRating(): string {
    return PlayerSeasonRatingUtils.formatAverageRating(this.seasonRating?.averageRating);
  }

  /** The average rating's badge color, the same scale as a game's rating. None while it loads. */
  public get averageRatingColor(): string {
    return PlayerSeasonRatingUtils.getAverageRatingColor(this.seasonRating?.averageRating);
  }

  /** The rating's tooltip, like "Average HokMob rating over 14 games, through Nov 8". */
  public get ratingTooltip(): string {
    const gamesRated = this.seasonRating?.gamesRated;
    if (!gamesRated) {
      return "Average HokMob rating";
    }
    const throughDate = this.seasonRating.throughDate;
    const through = throughDate ? ", through " + new Date(throughDate + "T00:00:00")
        .toLocaleDateString("en-US", {month: "short", day: "numeric"}) : "";
    return "Average HokMob rating over " + gamesRated + (gamesRated === 1 ? " game" : " games") + through;
  }

  /** A skater's 5v5 Corsi For %, like "52.3%". */
  public get corsiForPct(): string {
    return PlayerSeasonRatingUtils.formatCorsiForPct(this.seasonRating?.corsiForPct);
  }

  /** A goalie's goals saved above average, like "+4.2". */
  public get goalsSavedAboveAverage(): string {
    return PlayerSeasonRatingUtils.formatGoalsSavedAboveAverage(this.seasonRating?.goalsSavedAboveAverage);
  }

  /** The row as a skater's, for the skater grid. */
  public get skaterStats(): SkaterSeasonStats {
    return this.stats as SkaterSeasonStats;
  }

  /** The row as a goalie's, for the goalie grid. */
  public get goalieStats(): GoalieSeasonStats {
    return this.stats as GoalieSeasonStats;
  }

  /**
   * A faceoff percentage (0 to 1) as "48.7%". A player who took no faceoffs has none, and shows a dash.
   *
   * @param value - The faceoff win percentage, from 0 to 1.
   */
  public formatFaceoffPercent(value: number): string {
    if (value == null) {
      return "-";
    }
    return (value * 100).toFixed(1) + "%";
  }
}
