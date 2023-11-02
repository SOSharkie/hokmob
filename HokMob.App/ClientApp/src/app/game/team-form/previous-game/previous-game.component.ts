import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";

@Component({
  selector: 'app-previous-game',
  templateUrl: './previous-game.component.html',
  styleUrls: ['./previous-game.component.scss']
})
export class PreviousGameComponent implements OnChanges {

  @Input()
  public gameDay: NhlGameDayModel;

  @Input()
  public team: NhlTeamModel;

  @Input()
  public isLast: boolean;

  public homeTeamLogo: any;

  public awayTeamLogo: any;

  public get homeTeamShortName(): string {
    return NhlTeamUtils.getTeam(this.gameDay.games[0].teams.home.team.id).teamName;
  }

  public get awayTeamShortName(): string {
    return NhlTeamUtils.getTeam(this.gameDay.games[0].teams.away.team.id).teamName;
  }

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

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['gameDay']) {
      this.homeTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.gameDay.games[0].teams.home.team.id);
      this.awayTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.gameDay.games[0].teams.away.team.id);
    }
  }

}
