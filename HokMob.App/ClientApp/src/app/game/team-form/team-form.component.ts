import {Component, Input} from '@angular/core';
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

@Component({
  selector: 'app-team-form',
  templateUrl: './team-form.component.html',
  styleUrls: ['./team-form.component.scss']
})
export class TeamFormComponent {

  @Input()
  public homeTeam: NhlTeamModel;

  @Input()
  public awayTeam: NhlTeamModel;

  @Input()
  public homeTeamGames: NhlScheduleModel;

  @Input()
  public awayTeamGames: NhlScheduleModel;

  public get last5HomeTeamGames(): NhlGameDayModel[] {
    if (this.homeTeamGames) {
      let end = Math.min(this.homeTeamGames.dates.length, 5);
      return this.homeTeamGames.dates.slice(0, end);
    }
    return [];
  }

  public get last5AwayTeamGames(): NhlGameDayModel[] {
    if (this.awayTeamGames) {
      let end = Math.min(this.awayTeamGames.dates.length, 5);
      return this.awayTeamGames.dates.slice(0, end);
    }
    return [];
  }
}
