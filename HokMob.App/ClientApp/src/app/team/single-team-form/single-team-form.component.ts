import {Component, Input} from '@angular/core';
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

// TODO: Not yet migrated to the new NHL API (see docs/nhl-api-migration-plan.md). The shared app-previous-game now expects
//  new API club schedule games. Fix: take games from club-schedule-season/{abbrev}/now, filter to finished games
//  (gameState OFF/FINAL) and pass the last 5.
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
