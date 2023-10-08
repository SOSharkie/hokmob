import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
Chart.register(...registerables);

@Component({
  selector: 'app-game-stats',
  templateUrl: './game-stats.component.html',
  styleUrls: ['./game-stats.component.scss']
})
export class GameStatsComponent implements OnInit, OnChanges {

  @Input()
  public homeTeamLogo: any;

  @Input()
  public awayTeamLogo: any;

  @Input()
  public gameLiveData: NhlLiveFeedModel;

  private shotDoughnutChart: Chart<"doughnut">;

  public get homeColor(): string {
    if (this.gameLiveData) {
      return NhlTeamColorUtils.getTeamPrimaryColor(this.gameLiveData.liveData.linescore.teams.home.team.id);
    }
    return "#000000";
  }

  public get awayColor(): string {
    if (this.gameLiveData) {
      return NhlTeamColorUtils.getTeamSecondaryColor(this.gameLiveData.liveData.linescore.teams.home.team.id, this.gameLiveData.liveData.linescore.teams.away.team.id);
    }
    return "#FFFFFF";
  }

  public get homeShots(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.linescore.teams.home.shotsOnGoal;
    }
    return 0;
  }

  public get awayShots(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.linescore.teams.away.shotsOnGoal;
    }
    return 0;
  }

  public get homeFacOffWin(): boolean {
    if (this.gameLiveData) {
      return Number(this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.faceOffWinPercentage)
      > Number(this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.faceOffWinPercentage)
    }
    return true;
  }

  public get awayFacOffWin(): boolean {
    if (this.gameLiveData) {
      return Number(this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.faceOffWinPercentage)
          < Number(this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.faceOffWinPercentage)
    }
    return true;
  }

  public get homeFaceOffPercentage(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.faceOffWinPercentage + "%";
    }
    return "50%";
  }

  public get awayFaceOffPercentage(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.faceOffWinPercentage + "%";
    }
    return "50%";
  }

  public get homeHitWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.hits >
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.hits;
    }
    return true;
  }

  public get awayHitWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.hits <
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.hits;
    }
    return true;
  }

  public get homeHits(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.hits;
    }
    return 0;
  }

  public get awayHits(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.hits;
    }
    return 0;
  }

  public get homePPWin(): boolean {
    if (this.gameLiveData) {
      return Number(this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.powerPlayPercentage)
          > Number(this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.powerPlayPercentage);
    }
    return true;
  }

  public get awayPPWin(): boolean {
    if (this.gameLiveData) {
      return Number(this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.powerPlayPercentage)
          < Number(this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.powerPlayPercentage);
    }
    return true;
  }

  public get homePowerPlay(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.powerPlayGoals + "/" +
          this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.powerPlayOpportunities;
    }
    return "0/0";
  }

  public get awayPowerPlay(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.powerPlayGoals + "/" +
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.powerPlayOpportunities;
    }
    return "0/0";
  }

  public get homePimWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.pim <
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.pim;
    }
    return true;
  }

  public get awayPimWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.pim >
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.pim;
    }
    return true;
  }

  public get homePim(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.pim;
    }
    return 0;
  }

  public get awayPim(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.pim;
    }
    return 0;
  }

  public get homeBlockWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.blocked >
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.blocked;
    }
    return true;
  }

  public get awayBlockWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.blocked <
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.blocked;
    }
    return true;
  }

  public get homeBlocks(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.blocked;
    }
    return 0;
  }

  public get awayBlocks(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.blocked;
    }
    return 0;
  }

  public get homeTakeawayWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.takeaways >
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.takeaways;
    }
    return true;
  }

  public get awayTakeawayWin(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.takeaways <
          this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.takeaways;
    }
    return true;
  }

  public get homeTakeaways(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.home.teamStats.teamSkaterStats.takeaways;
    }
    return 0;
  }

  public get awayTakeaways(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.boxscore.teams.away.teamStats.teamSkaterStats.takeaways;
    }
    return 0;
  }

  public ngOnInit(): void {
      this.shotDoughnutChart = new Chart("shotDoughnut", {
      type: 'doughnut',
      data: {
        labels: [
          'Red',
          'Blue'
        ],
        datasets: [{
          label: 'Team Shots',
          data: [this.awayShots, this.homeShots],
          backgroundColor: [
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)'
          ],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        cutout: "90%",
        radius: 100,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        }
      }
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes["gameLiveData"] && this.shotDoughnutChart) {
      this.shotDoughnutChart.data.datasets[0].backgroundColor = [this.awayColor, this.homeColor]
      this.shotDoughnutChart.data.datasets[0].data = [this.awayShots, this.homeShots];
      this.shotDoughnutChart.update();
    }
  }
}
