import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {TeamGameStat} from "@shared/models/nhl-web-api/right-rail.model";
import {NstGameStats} from "@shared/models/natural-stat-trick/nst-game-stats.model";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";
Chart.register(...registerables);

/**
 * A row of the team stats table. The better team's value is highlighted with its color.
 */
export interface GameStatRow {
  label: string;
  /** What the stat means, shown on hovering the label. */
  description?: string;
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

  /**
   * The expected goals and Corsi from Natural Stat Trick, shown above the other stats for a finished game. Undefined
   * until they load, or when NST has none.
   */
  @Input()
  public advancedStats: NstGameStats;

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

  /** The text color on homeColor: white, or near-black on a light team color. */
  public get homeTextColor(): string {
    return NhlTeamColorUtils.getTextColorOn(this.homeColor);
  }

  /** The text color on awayColor, which is a light gray when both teams are blue or both are red. */
  public get awayTextColor(): string {
    return NhlTeamColorUtils.getTextColorOn(this.awayColor);
  }

  /**
   * The Natural Stat Trick game page, credited under the stats when its rows are shown.
   */
  public get advancedStatsSourceUrl(): string {
    return this.advancedStats ? NstStatsUtils.getGamePageUrl(this.advancedStats.gameId) : "";
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
   * Builds the shots and the stats rows, with the expected goals and Corsi first when they're loaded. Missing stats
   * show "-" and aren't highlighted.
   */
  private buildStats(): void {
    const stats = new Map((this.teamGameStats ?? []).map(stat => [stat.category, stat] as [string, TeamGameStat]));
    this.homeShots = Number(stats.get("sog")?.homeValue ?? 0) || 0;
    this.awayShots = Number(stats.get("sog")?.awayValue ?? 0) || 0;
    this.statRows = [...this.buildAdvancedStatRows(), ...this.rowDefinitions.map(definition => {
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
    })];
  }

  /**
   * The all situations expected goals and Corsi % rows, or none without Natural Stat Trick's stats. The team with
   * more is highlighted, neither on a tie.
   */
  private buildAdvancedStatRows(): GameStatRow[] {
    const home = this.advancedStats?.homeTeam;
    const away = this.advancedStats?.awayTeam;
    if (!home || !away) {
      return [];
    }
    const row = (label: string, description: string, homeValue: string, awayValue: string, homeNumber: number,
                 awayNumber: number): GameStatRow => {
      const comparable = homeNumber != null && awayNumber != null;
      return {
        label, description, homeValue, awayValue,
        homeBetter: comparable && homeNumber > awayNumber,
        awayBetter: comparable && awayNumber > homeNumber
      };
    };
    return [
      row("Expected Goals", "How many goals the team's shots were worth, by their quality (xG)",
          NstStatsUtils.formatExpectedGoals(home.expectedGoalsFor),
          NstStatsUtils.formatExpectedGoals(away.expectedGoalsFor), home.expectedGoalsFor, away.expectedGoalsFor),
      row("Corsi %", "The team's share of all shot attempts: on goal, missed and blocked",
          NstStatsUtils.getCorsiPercentage(home.corsiFor, home.corsiAgainst),
          NstStatsUtils.getCorsiPercentage(away.corsiFor, away.corsiAgainst), home.corsiFor, away.corsiFor)
    ];
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
