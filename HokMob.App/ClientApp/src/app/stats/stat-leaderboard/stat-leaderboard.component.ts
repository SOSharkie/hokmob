import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

@Component({
  selector: 'app-stat-leaderboard',
  templateUrl: './stat-leaderboard.component.html',
  styleUrls: ['./stat-leaderboard.component.scss']
})
export class StatLeaderboardComponent implements OnChanges {

  @Input()
  public statTitle: string;

  @Input()
  public statField: string;

  @Input()
  public topPlayersList: NhlPlayerModel[];

  public playerHeadshots: any[];

  public teamLogos: any[];

  public imagesLoaded: boolean = false;

  public get statLeader(): NhlPlayerModel {
    if (this.topPlayersList && this.topPlayersList[0]) {
      return this.topPlayersList[0];
    }
    return null;
  }

  public get statRunnerUps(): NhlPlayerModel[] {
    if (this.topPlayersList && this.topPlayersList[4]) {
      return this.topPlayersList.slice(1, 5);
    }
    return [];
  }

  constructor(private nhlImageService: NhlImageService) {
  }

  public getPlayerTeamColor(player: NhlPlayerModel): string {
    return NhlTeamColorUtils.getTeamPrimaryColor(player.person.currentTeam.id)
  }

  public getPlayerStatField(player: NhlPlayerModel): string {
    if (this.statField) {
      if (this.statField === "savePercentage") {
        if (player.person.stats[0].splits[0].stat[this.statField] === 1) {
          return "1.00";
        }
        return player.person.stats[0].splits[0].stat[this.statField].toFixed(3).slice(1);
      } else if (this.statField === "goalAgainstAverage") {
        return player.person.stats[0].splits[0].stat[this.statField].toFixed(2);
      } else {
        return player.person.stats[0].splits[0].stat[this.statField];
      }
    }
    return "";
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['topPlayersList'] && !this.imagesLoaded) {
      if (!this.topPlayersList) {
        return;
      }
      this.teamLogos = ['assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png'];
      this.playerHeadshots = ['assets/blank_headshot.png', 'assets/blank_headshot.png', 'assets/blank_headshot.png', 'assets/blank_headshot.png', 'assets/blank_headshot.png'];
      let teams = this.topPlayersList.slice(0, 5).map(player => player.person.currentTeam);
      teams.forEach((team, index) => {
        this.teamLogos[index] = NhlTeamLogoUtils.getTeamPrimaryLogo(team.id);
      });
      this.topPlayersList.slice(0, 5).forEach((player, index) => {
        this.nhlImageService.getNhlPlayerHeadshot(player.person.id).then(data => {
          let reader = new FileReader();
          reader.addEventListener("load", () => {
            this.playerHeadshots[index] = reader.result;
          }, false);
          reader.readAsDataURL(data);
        });
      });
      this.imagesLoaded = true;
    }
  }
}
