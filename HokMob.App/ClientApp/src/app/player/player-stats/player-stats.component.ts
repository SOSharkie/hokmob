import {Component, Input} from '@angular/core';
import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * One season's stats card, from the stats API row of that season (/api/nhl-stats/player/{id}). A season with two
 * teams is already one row, so nothing is summed here.
 */
@Component({
  selector: 'app-player-stats',
  templateUrl: './player-stats.component.html',
  styleUrls: ['./player-stats.component.scss']
})
export class PlayerStatsComponent {

  @Input()
  public statTitle: string;

  @Input()
  public stats: SkaterSeasonStats | GoalieSeasonStats;

  @Input()
  public teamColor: string;

  @Input()
  public isGoalie: boolean;

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
