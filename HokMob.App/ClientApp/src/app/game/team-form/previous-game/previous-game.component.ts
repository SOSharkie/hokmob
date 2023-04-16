import {Component, Input} from '@angular/core';
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";

@Component({
  selector: 'app-previous-game',
  templateUrl: './previous-game.component.html',
  styleUrls: ['./previous-game.component.scss']
})
export class PreviousGameComponent {

  @Input()
  public gameDay: NhlGameDayModel;

  @Input()
  public team: NhlTeamModel;

  public get score(): string {
    if (this.gameDay) {
      return this.gameDay.games[0].teams.home.score + " - " + this.gameDay.games[0].teams.away.score;
    }
    return "N/A";
  }

  public get scoreColor(): string {
    if (this.gameDay) {
      if (this.gameDay.games[0].teams.home.team.id === this.team.id) {
         if (this.gameDay.games[0].teams.home.score > this.gameDay.games[0].teams.away.score) {
           return "green"
         } else {
           return "red";
         }
      } else {
        if (this.gameDay.games[0].teams.home.score < this.gameDay.games[0].teams.away.score) {
          return "green"
        } else {
          return "red";
        }
      }
    }
    return "";
  }
}
