import {Component, Input, ChangeDetectionStrategy} from '@angular/core';
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";
import {ScoreGame} from "@shared/models/nhl-web-api/score.model";

/**
 * The team page's schedule: the team's next games, soonest first, as scorecards.
 */
@Component({
    selector: 'app-team-schedule',
    templateUrl: './team-schedule.component.html',
    styleUrls: ['./team-schedule.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamScheduleComponent {

  /**
   * The games that aren't over, soonest first, converted to the score response shape app-scorecard expects
   * (NhlGameInfoUtils.getUpcomingGames and toScoreGame).
   */
  @Input()
  public games: ScoreGame[] = [];

  /** Whether the games are still loading, so the card shows its skeleton at its size. */
  @Input()
  public loading: boolean = false;

  /**
   * The skeleton's rows: the 5 games the team page asks for, each a smaller scorecard. A scorecard grows when a long
   * team name wraps in a narrow column, which the skeleton can't know before the games load.
   */
  public readonly skeletonLayout: SkeletonCardLayout = {rows: 5, rowHeight: 68.8};

}
