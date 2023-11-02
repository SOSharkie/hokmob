import {Component, Input} from '@angular/core';
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";

@Component({
  selector: 'app-team-schedule',
  templateUrl: './team-schedule.component.html',
  styleUrls: ['./team-schedule.component.scss']
})
export class TeamScheduleComponent {

  @Input()
  public team: NhlTeamModel;

  @Input()
  public teamGames: NhlScheduleModel;

  public get next5TeamGames(): NhlGameModel[] {
    if (this.teamGames) {
      return this.teamGames.dates.slice(0, Math.min(5, this.teamGames.dates.length)).map(item => item.games[0]);
    }
    return [];
  }
}
