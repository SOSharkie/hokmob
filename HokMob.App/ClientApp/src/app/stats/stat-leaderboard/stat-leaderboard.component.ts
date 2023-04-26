import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsRosterPlayerModel} from "@shared/models/nhl-stats/nhl-stats-roster-player.model";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlImageService} from "@shared/services/nhl-image.service";

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
  public topPlayersList: NhlStatsRosterPlayerModel[];

  public playerHeadshots: any[];

  public teamLogos: any[];

  public playerHeadshotsLoaded: boolean = false;

  public teamLogosLoaded: boolean = false;


  public get statLeader(): NhlStatsRosterPlayerModel {
    if (this.topPlayersList && this.topPlayersList[0]) {
      return this.topPlayersList[0];
    }
    return null;
  }

  public get statRunnerUps(): NhlStatsRosterPlayerModel[] {
    if (this.topPlayersList && this.topPlayersList[4]) {
      return this.topPlayersList.slice(1, 5);
    }
    return [];
  }

  constructor(private nhlLogoService: NhlImageService) {
  }

  public getPlayerTeamColor(player: NhlStatsRosterPlayerModel): string {
    return NhlTeamColorUtils.getTeamPrimaryColor(player.person.currentTeam.id)
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['topPlayersList'] && !this.teamLogosLoaded) {
      if (!this.topPlayersList) {
        return;
      }
      this.teamLogos = ['assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png'];
      this.playerHeadshots = ['assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png', 'assets/nhl_logo.png'];
      let teams = this.topPlayersList.slice(0, 5).map(player => player.person.currentTeam);
      this.teamLogosLoaded = true;
      teams.forEach((team, index) => {
        this.nhlLogoService.getNhlTeamLogo(team.id).then(data => {
          let reader = new FileReader();
          reader.addEventListener("load", () => {
            this.teamLogos[index] = reader.result;
          }, false);
          reader.readAsDataURL(data);
        });
      });
      this.topPlayersList.slice(0, 5).forEach((player, index) => {
        this.nhlLogoService.getNhlPlayerHeadshot(player.person.id).then(data => {
          let reader = new FileReader();
          reader.addEventListener("load", () => {
            this.playerHeadshots[index] = reader.result;
          }, false);
          reader.readAsDataURL(data);
        });
      });
    }
  }
}
