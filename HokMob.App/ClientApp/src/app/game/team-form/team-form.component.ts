import {Component, Input} from '@angular/core';
import {ClubScheduleGame} from "@shared/models/nhl-web-api/club-schedule.model";

@Component({
  selector: 'app-team-form',
  templateUrl: './team-form.component.html',
  styleUrls: ['./team-form.component.scss']
})
export class TeamFormComponent {

  @Input()
  public homeTeamId: number;

  @Input()
  public awayTeamId: number;

  /**
   * The home team's last finished games before the game, most recent first (NhlGameService.getTeamFormGames).
   */
  @Input()
  public homeTeamGames: ClubScheduleGame[] = [];

  @Input()
  public awayTeamGames: ClubScheduleGame[] = [];
}
