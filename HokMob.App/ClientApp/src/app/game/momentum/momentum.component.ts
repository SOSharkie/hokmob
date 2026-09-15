import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import {Play, PlayByPlay} from "@shared/models/nhl-web-api/play-by-play.model";
import {PeriodDescriptor} from "@shared/models/nhl-web-api/common.model";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {PeriodUtils} from "@shared/utils/period-utils";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {NhlPlayTypeEnum} from "@shared/enums/nhl-play-type.enum";
Chart.register(...registerables);

/**
 * A period on the chart's x-axis: its first point index and its length in minutes (one point per minute).
 */
interface ChartPeriod {
  periodDescriptor: PeriodDescriptor;
  start?: number;
  minutes: number;
}

@Component({
  selector: 'app-momentum',
  templateUrl: './momentum.component.html',
  styleUrls: ['./momentum.component.scss']
})
export class MomentumComponent implements OnChanges, AfterViewInit, OnDestroy {

  /**
   * The game's play-by-play. Goals and shots move the momentum toward the team that took them.
   */
  @Input()
  public playByPlay: PlayByPlay;

  /**
   * The momentum at the end of each game minute, from -30 to 30: positive for the home team, negative for the away
   * team. Point 0 is the start of the game.
   */
  public momentumData: number[] = [];

  /**
   * The point radius of each minute: set for minutes with a goal (drawn as a puck), 0 otherwise.
   */
  public goalData: number[] = [];

  /**
   * The x-axis labels: each period's label at its first point ("1st", "OT", "2OT"), "End" at the last point.
   */
  public chartLabels: string[] = [];

  @ViewChild("momentumChart")
  private chartCanvas: ElementRef<HTMLCanvasElement>;

  private momentumChart: Chart<"line">;

  private readonly goalImage = MomentumComponent.createGoalImage();

  private readonly maxChartValue: number = 30;

  private readonly minChartValue: number = -30;

  private readonly goalPointRadius: number = 7;

  private readonly periodMinutes: number = 20;

  /**
   * The momentum each play type adds for the team that owns the play. A blocked shot's owner is the shooting team.
   */
  private readonly playMomentum: Record<string, number> = {
    [NhlPlayTypeEnum.GOAL]: 9,
    [NhlPlayTypeEnum.SHOT_ON_GOAL]: 7,
    [NhlPlayTypeEnum.MISSED_SHOT]: 5,
    [NhlPlayTypeEnum.BLOCKED_SHOT]: 4
  };

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes["playByPlay"]) {
      this.generateChartData();
      this.updateChart();
    }
  }

  public ngAfterViewInit(): void {
    if (this.chartLabels.length === 0) {
      this.generateChartData();
    }
    this.createChart();
    this.updateChart();
  }

  public ngOnDestroy(): void {
    this.momentumChart?.destroy();
    this.momentumChart = undefined;
  }

  private createChart(): void {
    this.momentumChart = new Chart(this.chartCanvas.nativeElement, {
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
              // Highlight where each period after the first starts
              color: (context) => {
                let label = context.tick?.label;
                if (context.index > 0 && label && label !== "End") {
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

  private updateChart(): void {
    if (!this.momentumChart) {
      return;
    }
    let homeTeamId = this.playByPlay?.homeTeam?.id;
    let awayTeamId = this.playByPlay?.awayTeam?.id;
    let dataset = this.momentumChart.data.datasets[0];
    dataset.fill = {
      above: NhlTeamColorUtils.getTeamPrimaryColor(homeTeamId),
      below: NhlTeamColorUtils.getTeamSecondaryColor(homeTeamId, awayTeamId),
      target: "origin"
    };
    dataset.data = this.momentumData;
    dataset.pointRadius = this.goalData;
    dataset.pointHoverRadius = this.goalData;
    dataset.pointStyle = this.goalData.map(radius => radius > 0 ? this.goalImage : false);
    this.momentumChart.data.labels = this.chartLabels;
    this.momentumChart.update();
  }

  /**
   * Builds the labels, momentum and goal points from the play-by-play. Shootout plays aren't counted.
   */
  private generateChartData(): void {
    let homeTeamId = this.playByPlay?.homeTeam?.id;
    let awayTeamId = this.playByPlay?.awayTeam?.id;
    let plays = (this.playByPlay?.plays ?? []).filter(play =>
        play.periodDescriptor && play.periodDescriptor.periodType !== NhlPeriodTypeEnum.SHOOTOUT);

    let periods = this.getChartPeriods(plays);
    this.chartLabels = [];
    periods.forEach(period => {
      period.start = this.chartLabels.length;
      this.chartLabels.push(PeriodUtils.getLabel(period.periodDescriptor), ...new Array(period.minutes - 1).fill(""));
    });
    this.chartLabels.push("End");
    this.momentumData = new Array(this.chartLabels.length).fill(0);
    this.goalData = new Array(this.chartLabels.length).fill(0);

    plays.forEach(play => {
      let momentum = this.playMomentum[play.typeDescKey];
      let ownerTeamId = play.details?.eventOwnerTeamId;
      let period = periods.find(item => item.periodDescriptor.number === play.periodDescriptor.number);
      if (!momentum || !period || !ownerTeamId || (ownerTeamId !== homeTeamId && ownerTeamId !== awayTeamId)) {
        return;
      }
      let minute = Math.floor(MomentumComponent.getSeconds(play.timeInPeriod) / 60);
      let index = period.start + Math.min(minute + 1, period.minutes);
      this.momentumData[index] += ownerTeamId === homeTeamId ? momentum : -momentum;
      if (play.typeDescKey === NhlPlayTypeEnum.GOAL) {
        this.goalData[index] = this.goalPointRadius;
      }
    });
    this.momentumData = this.momentumData.map(value => Math.max(Math.min(value, this.maxChartValue), this.minChartValue));
  }

  /**
   * Returns the regulation periods (20 minutes each, even before they're played), then each overtime played so far.
   * An overtime lasts until its last play, up to 20 minutes.
   *
   * @param plays - The plays without the shootout.
   */
  private getChartPeriods(plays: Play[]): ChartPeriod[] {
    let regulationPeriods = this.playByPlay?.regPeriods || 3;
    let periods: ChartPeriod[] = [];
    for (let number = 1; number <= regulationPeriods; number++) {
      periods.push({
        periodDescriptor: {number, periodType: NhlPeriodTypeEnum.REGULATION, maxRegulationPeriods: regulationPeriods},
        minutes: this.periodMinutes
      });
    }
    plays.filter(play => play.periodDescriptor.number > regulationPeriods).forEach(play => {
      let period = periods.find(item => item.periodDescriptor.number === play.periodDescriptor.number);
      if (!period) {
        period = {periodDescriptor: play.periodDescriptor, minutes: 1};
        periods.push(period);
      }
      let minutesPlayed = Math.ceil(MomentumComponent.getSeconds(play.timeInPeriod) / 60);
      period.minutes = Math.min(Math.max(period.minutes, minutesPlayed), this.periodMinutes);
    });
    return periods.sort((periodA, periodB) => periodA.periodDescriptor.number - periodB.periodDescriptor.number);
  }

  /**
   * Converts a period time like "05:17" to seconds.
   */
  private static getSeconds(timeInPeriod: string): number {
    let [minutes, seconds] = (timeInPeriod ?? "").split(":").map(Number);
    return (minutes || 0) * 60 + (seconds || 0);
  }

  private static createGoalImage(): HTMLImageElement {
    let goalImage = new Image(20, 22);
    goalImage.src = "assets/cropped_puck.png";
    return goalImage;
  }
}
