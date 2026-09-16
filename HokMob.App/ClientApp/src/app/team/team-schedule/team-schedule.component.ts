import {Component, Input} from '@angular/core';
import {ScoreGame} from "@shared/models/nhl-web-api/score.model";

/**
 * The team page's schedule: the team's next games, soonest first, as scorecards.
 */
@Component({
  selector: 'app-team-schedule',
  templateUrl: './team-schedule.component.html',
  styleUrls: ['./team-schedule.component.scss']
})
export class TeamScheduleComponent {

  /**
   * The games that aren't over, soonest first, converted to the score response shape app-scorecard expects
   * (NhlGameInfoUtils.getUpcomingGames and toScoreGame).
   */
  @Input()
  public games: ScoreGame[] = [];

}
