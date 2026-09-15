import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {TeamGameStat} from "@shared/models/nhl-web-api/right-rail.model";
Chart.register(...registerables);

/**
 * A row of the team stats table. The better team's value is highlighted with its color.
 */
export interface GameStatRow {
  label: string;
  homeValue: string;
  awayValue: string;
  homeBetter: boolean;
  awayBetter: boolean;
}

/**
 * How a team stats row is built from the right-rail teamGameStats.
 */
interface GameStatRowDefinition {
  label: string;
  /** The category whose value is shown. */
  category: string;
  /** The category compared to find the better team, when it isn't the shown one. */
  compareCategory?: string;
  lowerIsBetter?: boolean;
  format?: (value: number | string) => string;
}

@Component({
  selector: 'app-game-stats',
  templateUrl: './game-stats.component.html',
  styleUrls: ['./game-stats.component.scss']
})
export class GameStatsComponent implements OnChanges, AfterViewInit, OnDestroy {

  @Input()
  public homeTeamLogo: any;

  @Input()
  public awayTeamLogo: any;

  @Input()
  public homeTeamId: number;

  @Input()
  public awayTeamId: number;

  /**
   * The right-rail team stats, like { category: "hits", awayValue: 13, homeValue: 26 }.
   */
  @Input()
  public teamGameStats: TeamGameStat[];

  public statRows: GameStatRow[] = [];

  public homeShots: number = 0;

  public awayShots: number = 0;

  @ViewChild("shotChart")
  private chartCanvas: ElementRef<HTMLCanvasElement>;

  private shotDoughnutChart: Chart<"doughnut">;

  private readonly rowDefinitions: GameStatRowDefinition[] = [
    {label: "Faceoff %", category: "faceoffWinningPctg", format: value => (Number(value) * 100).toFixed(1) + "%"},
    {label: "Power Plays", category: "powerPlay", compareCategory: "powerPlayPctg"},
    {label: "Penalty Minutes", category: "pim", lowerIsBetter: true},
    {label: "Hits", category: "hits"},
    {label: "Blocks", category: "blockedShots"},
    {label: "Takeaways", category: "takeaways"}
  ];

  public get homeColor(): string {
    return NhlTeamColorUtils.getTeamPrimaryColor(this.homeTeamId);
  }

  public get awayColor(): string {
    return NhlTeamColorUtils.getTeamSecondaryColor(this.homeTeamId, this.awayTeamId);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    this.buildStats();
    this.updateChart();
  }

  public ngAfterViewInit(): void {
    this.shotDoughnutChart = new Chart(this.chartCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Away', 'Home'],
        datasets: [{
          label: 'Team Shots',
          data: [this.awayShots, this.homeShots],
          backgroundColor: [this.awayColor, this.homeColor],
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

  public ngOnDestroy(): void {
    this.shotDoughnutChart?.destroy();
    this.shotDoughnutChart = undefined;
  }

  /**
   * Builds the shots and the stats rows. Missing stats show "-" and aren't highlighted.
   */
  private buildStats(): void {
    const stats = new Map((this.teamGameStats ?? []).map(stat => [stat.category, stat] as [string, TeamGameStat]));
    this.homeShots = Number(stats.get("sog")?.homeValue ?? 0) || 0;
    this.awayShots = Number(stats.get("sog")?.awayValue ?? 0) || 0;
    this.statRows = this.rowDefinitions.map(definition => {
      const stat = stats.get(definition.category);
      const compared = stats.get(definition.compareCategory ?? definition.category);
      const home = GameStatsComponent.toNumber(compared?.homeValue);
      const away = GameStatsComponent.toNumber(compared?.awayValue);
      const comparable = home !== undefined && away !== undefined;
      const format = (value: number | string) => value === undefined || value === null ? "-" :
          definition.format ? definition.format(value) : String(value);
      return {
        label: definition.label,
        homeValue: format(stat?.homeValue),
        awayValue: format(stat?.awayValue),
        homeBetter: comparable && (definition.lowerIsBetter ? home < away : home > away),
        awayBetter: comparable && (definition.lowerIsBetter ? away < home : away > home)
      };
    });
  }

  private updateChart(): void {
    if (!this.shotDoughnutChart) {
      return;
    }
    const dataset = this.shotDoughnutChart.data.datasets[0];
    dataset.backgroundColor = [this.awayColor, this.homeColor];
    dataset.data = [this.awayShots, this.homeShots];
    this.shotDoughnutChart.update();
  }

  private static toNumber(value: number | string): number {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const number = Number(value);
    return isNaN(number) ? undefined : number;
  }
}
