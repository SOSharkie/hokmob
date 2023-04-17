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
      let homeGames = this.homeTeamGames.dates.reverse();
      let end = Math.min(homeGames.length, 5);
      return homeGames.slice(0, end);
    }
    return [];
  }

  public get last5AwayTeamGames(): NhlGameDayModel[] {
    if (this.awayTeamGames) {
      let awayGames = this.awayTeamGames.dates.reverse();
      let end = Math.min(awayGames.length, 5);
      return awayGames.slice(0, end);
    }
    return [];
  }
}
