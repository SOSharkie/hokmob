import {Component, Input, ChangeDetectionStrategy} from '@angular/core';
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {ClubScheduleGame} from "@shared/models/nhl-web-api/club-schedule.model";

/**
 * The team page's form: the team's last finished games, most recent first
 * (NhlGameService.getTeamFormGames).
 */
@Component({
    selector: 'app-single-team-form',
    templateUrl: './single-team-form.component.html',
    styleUrls: ['./single-team-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SingleTeamFormComponent {

  /**
   * The team whose form this is. Its wins are green and its losses red.
   */
  @Input()
  public teamId: number;

  @Input()
  public games: ClubScheduleGame[] = [];

  /** Whether the games are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /** The skeleton's rows: the 5 games the team page asks for, each like app-previous-game. */
  public readonly skeletonLayout: SkeletonCardLayout = {rows: 5, rowHeight: 82.8};

}
