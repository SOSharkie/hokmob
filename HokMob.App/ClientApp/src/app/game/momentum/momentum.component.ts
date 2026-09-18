import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild} from '@angular/core';
import { Chart, ChartDataset, registerables, TooltipModel } from 'chart.js';
import {Play, PlayByPlay, RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {PeriodDescriptor} from "@shared/models/nhl-web-api/common.model";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {PeriodUtils} from "@shared/utils/period-utils";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {NhlPlayTypeEnum} from "@shared/enums/nhl-play-type.enum";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
Chart.register(...registerables);

/**
 * A period on the chart's x-axis: its first point index and its length in minutes (one point per minute).
 */
interface ChartPeriod {
  periodDescriptor: PeriodDescriptor;
  start?: number;
  minutes: number;
}

/**
 * How the momentum is drawn: a filled curve, or a bar per minute.
 */
export type MomentumChartView = "line" | "bar";

@Component({
  selector: 'app-momentum',
  templateUrl: './momentum.component.html',
  styleUrls: ['./momentum.component.scss']
})
export class MomentumComponent implements OnChanges, AfterViewInit, OnDestroy {

  /** The logo above a goal in the chart's hover tooltip. */
  public readonly logoSize: number = 24;

  /**
   * The game's play-by-play. Goals and shots move the momentum toward the team that took them.
   */
  @Input()
  public playByPlay: PlayByPlay;

  /**
   * The key the picked chart view is saved under in session storage.
   */
  public static readonly chartViewStorageKey = "hokmob.momentumChartView";

  /**
   * The chart view picked with the toggle. Starts as the view saved this session, or the line view.
   */
  public chartView: MomentumChartView = MomentumComponent.loadChartView();

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
   * The goals scored in each minute, by point index.
   */
  public goalPlays: Play[][] = [];

  /**
   * The goals of the hovered goal point, shown in the tooltip. Empty when no goal is hovered.
   */
  public hoveredGoals: Play[] = [];

  /**
   * The tooltip position within the chart, in pixels. It opens below points in the top half of the chart, and above
   * the others.
   */
  public tooltipPosition: {left: number, top?: number, bottom?: number, width: number};

  /**
   * The game's roster spots by player ID, for the tooltip's player names.
   */
  public rosterSpots = new Map<number, RosterSpot>();

  /**
   * The x-axis labels: each period's label at its first point ("1st", "OT", "2OT"), "End" at the last point.
   */
  public chartLabels: string[] = [];

  /**
   * The hovered goals' period, like "2nd" or "OT".
   */
  public get hoveredPeriodLabel(): string {
    return PeriodUtils.getLabel(this.hoveredGoals[0]?.periodDescriptor);
  }

  @ViewChild("momentumChart")
  private chartCanvas: ElementRef<HTMLCanvasElement>;

  private momentumChart: Chart<"bar" | "line", number[]>;

  private readonly goalImage = MomentumComponent.createGoalImage();

  private readonly maxChartValue: number = 30;

  private readonly minChartValue: number = -30;

  private readonly goalPointRadius: number = 7;

  private readonly periodMinutes: number = 20;

  private readonly goalHitRadius: number = 10;

  /**
   * How far a goal puck can reach past the chart area: half the puck image's height, plus its border.
   */
  private readonly goalOverflow: number = 12;

  private readonly tooltipMaxWidth: number = 280;

  private readonly tooltipOffset: number = 14;

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

  public isHomeGoal(goal: Play): boolean {
    return goal?.details?.eventOwnerTeamId === this.playByPlay?.homeTeam?.id;
  }

  public getGoalTime(goal: Play): string {
    return PeriodUtils.formatTimeRemaining(goal?.timeInPeriod) ?? "";
  }

  public getScorerName(goal: Play): string {
    return PlayByPlayUtils.getMainPlayerLabel(goal, this.rosterSpots);
  }

  /**
   * The assists line, like "Assists: Brad Lambert, Morgan Barron", or "Unassisted".
   */
  public getAssistsLabel(goal: Play): string {
    let assistNames = PlayByPlayUtils.getAssistPlayerIds(goal?.details)
        .map(playerId => PlayByPlayUtils.getFullName(this.rosterSpots.get(playerId)));
    return assistNames.length > 0 ? "Assists: " + assistNames.join(", ") : "Unassisted";
  }

  public getTeamLogo(goal: Play): string {
    return NhlTeamLogoUtils.getTeamPrimaryLogo(goal?.details?.eventOwnerTeamId);
  }

  /**
   * Keeps the tooltip's goals rendered while the same point stays hovered.
   */
  public trackGoal(index: number, goal: Play): number {
    return goal.eventId;
  }

  /**
   * Switches the chart to the view, rebuilding it, since a line chart and a bar chart lay out the x-axis differently.
   *
   * @param view - The view to show.
   */
  public setChartView(view: MomentumChartView): void {
    if (view === this.chartView) {
      return;
    }
    this.chartView = view;
    MomentumComponent.saveChartView(view);
    this.hoveredGoals = [];
    this.momentumChart?.destroy();
    this.createChart();
    this.updateChart();
  }

  private createChart(): void {
    let momentumDataset: ChartDataset<"bar" | "line", number[]> = this.chartView === "bar"
        ? {
          type: 'bar',
          data: this.momentumData,
          barPercentage: 0.8,
          categoryPercentage: 1,
          borderRadius: 2,
          order: 1
        }
        : {
          type: 'line',
          data: this.momentumData,
          fill: {target: "origin"},
          borderWidth: 0,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointHitRadius: 0,
          order: 1
        };
    this.momentumChart = new Chart<"bar" | "line", number[]>(this.chartCanvas.nativeElement, {
      type: this.chartView,
      data: {
        labels: this.chartLabels,
        datasets: [momentumDataset, {
          // The goal pucks, drawn over the momentum at the end of their minute
          type: 'line',
          data: [],
          showLine: false,
          // Let pucks at the max or min momentum draw past the chart area instead of being cut in half
          clip: this.goalOverflow,
          order: 0
        }]
      },
      options: {
        maintainAspectRatio: false,
        layout: {
          // Room above the chart area for a puck at the max momentum
          padding: {
            top: this.goalOverflow
          }
        },
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
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            // Only goal points get a tooltip, drawn by the template
            enabled: false,
            mode: "nearest",
            intersect: true,
            filter: item => item.datasetIndex === 1 && this.goalPlays[item.dataIndex]?.length > 0,
            external: context => this.onTooltipChanged(context.tooltip)
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
    let homeColor = NhlTeamColorUtils.getTeamPrimaryColor(homeTeamId);
    let awayColor = NhlTeamColorUtils.getTeamSecondaryColor(homeTeamId, awayTeamId);
    let [momentumDataset, goalDataset] =
        this.momentumChart.data.datasets as [ChartDataset<"bar" | "line">, ChartDataset<"line">];
    momentumDataset.data = this.momentumData;
    if (momentumDataset.type === "line") {
      momentumDataset.fill = {above: homeColor, below: awayColor, target: "origin"};
    } else {
      momentumDataset.backgroundColor = this.momentumData.map(value => value >= 0 ? homeColor : awayColor);
    }
    // Goal pucks sit on the momentum of their minute; minutes without a goal have no point
    goalDataset.data = this.momentumData.map((value, index) => this.goalData[index] > 0 ? value : null);
    goalDataset.pointRadius = this.goalData;
    goalDataset.pointHoverRadius = this.goalData;
    goalDataset.pointHitRadius = this.goalData.map(radius => radius > 0 ? this.goalHitRadius : 0);
    goalDataset.pointStyle = this.goalData.map(radius => radius > 0 ? this.goalImage : false);
    this.momentumChart.data.labels = this.chartLabels;
    this.momentumChart.update();
  }

  /**
   * Shows the hovered goal point's goals next to it, or hides them when no goal is hovered.
   *
   * @param tooltip - The chart's tooltip, with the hovered points and the caret position in canvas pixels.
   */
  private onTooltipChanged(tooltip: TooltipModel<"bar" | "line">): void {
    let index = tooltip.opacity > 0 ? tooltip.dataPoints?.[0]?.dataIndex : undefined;
    let goals = this.goalPlays[index] ?? [];
    if (goals.length === 0) {
      if (this.hoveredGoals.length > 0) {
        this.hoveredGoals = [];
      }
      return;
    }
    let chartWidth = this.momentumChart.width;
    let chartHeight = this.momentumChart.height;
    let width = Math.min(this.tooltipMaxWidth, chartWidth);
    let left = Math.max(0, Math.min(tooltip.caretX - width / 2, chartWidth - width));
    this.tooltipPosition = tooltip.caretY < chartHeight / 2
        ? {left, width, top: tooltip.caretY + this.tooltipOffset}
        : {left, width, bottom: chartHeight - tooltip.caretY + this.tooltipOffset};
    this.hoveredGoals = goals;
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
    this.goalPlays = this.chartLabels.map(() => []);
    this.rosterSpots = PlayByPlayUtils.getRosterSpotMap(this.playByPlay);

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
        this.goalPlays[index].push(play);
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

  /**
   * Returns the chart view saved this session, or the line view when none is saved or storage is blocked.
   */
  private static loadChartView(): MomentumChartView {
    try {
      return sessionStorage.getItem(MomentumComponent.chartViewStorageKey) === "bar" ? "bar" : "line";
    } catch {
      return "line";
    }
  }

  /**
   * Saves the chart view for the rest of the session. Blocked storage only means the pick isn't remembered.
   */
  private static saveChartView(view: MomentumChartView): void {
    try {
      sessionStorage.setItem(MomentumComponent.chartViewStorageKey, view);
    } catch {
      // Storage is blocked or full; keep the view for this page only
    }
  }

  private static createGoalImage(): HTMLImageElement {
    let goalImage = new Image(20, 22);
    goalImage.src = "assets/cropped_puck.png";
    return goalImage;
  }
}
