import {Component, Input} from '@angular/core';
import {ClubScheduleGame} from "@shared/models/nhl-web-api/club-schedule.model";

/**
 * The team page's form: the team's last finished games, most recent first
 * (NhlGameService.getTeamFormGames).
 */
@Component({
  selector: 'app-single-team-form',
  templateUrl: './single-team-form.component.html',
  styleUrls: ['./single-team-form.component.scss']
})
export class SingleTeamFormComponent {

  /**
   * The team whose form this is. Its wins are green and its losses red.
   */
  @Input()
  public teamId: number;

  @Input()
  public games: ClubScheduleGame[] = [];

}
