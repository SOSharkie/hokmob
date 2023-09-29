import {Component, Input} from '@angular/core';
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

@Component({
  selector: 'app-single-team-form',
  templateUrl: './single-team-form.component.html',
  styleUrls: ['./single-team-form.component.scss']
})
export class SingleTeamFormComponent {

  @Input()
  public team: NhlTeamModel;

  @Input()
  public teamGames: NhlScheduleModel;

  public get last5TeamGames(): NhlGameDayModel[] {
    if (this.teamGames) {
      return this.teamGames.dates.slice(this.teamGames.dates.length - 5, this.teamGames.dates.length).reverse();
    }
    return [];
  }

}
