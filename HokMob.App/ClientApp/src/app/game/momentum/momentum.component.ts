import {AfterViewInit, Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
Chart.register(...registerables);

@Component({
  selector: 'app-momentum',
  templateUrl: './momentum.component.html',
  styleUrls: ['./momentum.component.scss']
})
export class MomentumComponent implements OnInit, OnChanges {

  @Input()
  public homeTeamLogo: any;

  @Input()
  public awayTeamLogo: any;

  @Input()
  public gameLiveData: NhlLiveFeedModel;

  public momentumData: number[];

  public goalData: number[];

  public goalDataStyle: string[];

  public chartLabels: any[];

  private momentumChart: Chart<"line">;

  private maxChartValue: number = 30;

  private minChartValue: number = -30;

  public get hasOvertime(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.liveData.linescore.periods.length > 3;
    }
    return false;
  }

  public ngOnInit(): void {
    this.momentumData = [0];
    this.momentumChart = new Chart("momentumChart", {
      type: 'line',
      data: {
        labels: this.chartLabels,
        datasets: [{
          data: this.momentumData,
          fill: {
            above: 'blue',
            below: 'red',
            target: "origin"
          },
          borderWidth: 0,
        }]
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          y: {
            display: false,
            max: this.maxChartValue,
            min: this.minChartValue
          },
          x: {
            ticks: {
              autoSkip: false,
              maxRotation: 0,
            },
            grid: {
              display: true,
              color: (context) => {
                if (context.tick.label === "2nd" || context.tick.label === "3rd" || context.tick.label === "OT") {
                  return "#414141";
                }
                return "#1b1b1b";
              }
            },
            border: {
              display: false
            }
          }
        },
        elements: {
          line: {
            tension: 0.4
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          },
          title: {
            display: false,
          }
        },
        interaction: {
          intersect: false,
        }
      },
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes["gameLiveData"] && this.momentumChart) {
      this.momentumChart.data.datasets[0].fill = {
        above: NhlTeamColorUtils.getTeamPrimaryColor(this.gameLiveData.gameData.teams.home.id),
        below: NhlTeamColorUtils.getTeamSecondaryColor(this.gameLiveData.gameData.teams.home.id, this.gameLiveData.gameData.teams.away.id),
        target: "origin"
      };
      this.generateChartData();

      let goalImage = new Image(20, 22);
      goalImage.src = "assets/cropped_puck.png";
      this.momentumChart.data.datasets[0].pointRadius = this.goalData;
      this.momentumChart.data.datasets[0].pointHoverRadius = this.goalData;
      this.momentumChart.data.datasets[0].pointStyle = this.goalData.map(value => value > 0 ? goalImage : "false");

      this.momentumChart.data.datasets[0].data = this.momentumData;
      this.momentumChart.data.labels = this.chartLabels;
      this.momentumChart.update();
    }
  }

  private generateChartData() {
    let homeTeamId = this.gameLiveData.gameData.teams.home.id;
    this.chartLabels = ["1st", '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      "2nd", '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      "3rd", '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    this.momentumData = [];
    this.goalData = [];
    this.goalDataStyle = [];
    let numDataPoints = 62;
    if (this.hasOvertime) {
      let overtimeTime = Number(this.gameLiveData.liveData.plays.currentPlay.about.periodTime.slice(0, 2)) + 1;
      numDataPoints += overtimeTime;
      this.chartLabels.push('OT');
      for (let i = 0; i < overtimeTime; i++) {
        this.chartLabels.push('');
      }
    }
    this.chartLabels.push("End");
    for (let i = 0; i < numDataPoints; i++) {
      this.momentumData.push(0);
      this.goalData.push(0);
      this.goalDataStyle.push("false");
    }
    this.gameLiveData.liveData.plays.allPlays.forEach(play => {
      let index = this.calculateMomentumIndex(play);
      switch (play.result.eventTypeId) {
        case 'GOAL':
          if (play.team.id === homeTeamId) {
            this.momentumData[index] += 9;
            this.goalData[index] = 7;
          } else {
            this.momentumData[index] -= 9;
            this.goalData[index] = 7;
          }
          break;
        case 'SHOT':
          if (play.team.id === homeTeamId) {
            this.momentumData[index] += 7;
          } else {
            this.momentumData[index] -= 7;
          }
          break;
        case 'MISSED_SHOT':
          if (play.team.id === homeTeamId) {
            this.momentumData[index] += 5;
          } else {
            this.momentumData[index] -= 5;
          }
          break;
        case 'BLOCKED_SHOT':
          if (play.team.id === homeTeamId) {
            this.momentumData[index] += 4;
          } else {
            this.momentumData[index] -= 4;
          }
          break;
      }
    });
    this.momentumData.forEach((value, index) => {
      this.momentumData[index] = Math.max(Math.min(value, this.maxChartValue), this.minChartValue);
    });
  }

  private calculateMomentumIndex(play: NhlLiveFeedPlayModel): number {
    let index = Number(play.about.periodTime.slice(0, 2)) + 1;

    if (play.about.period === 2) {
      index += 20;
    } else if (play.about.period === 3) {
      index += 40;
    } else if (play.about.period === 4) {
      index += 60;
    }
    return index
  }

}
