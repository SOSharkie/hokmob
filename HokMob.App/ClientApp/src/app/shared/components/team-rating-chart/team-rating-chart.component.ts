import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {Chart, ChartDataset, Plugin, registerables, TooltipItem} from 'chart.js';
import dayjs from "dayjs";
import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {TeamMetricId, TeamRatingPoint, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
Chart.register(...registerables);

/** A line the chart can plot: the power rating, or one of its stats. */
export type TeamChartLineId = "rating" | TeamMetricId;

/** A toggle of the chart's lines. */
export interface TeamChartLine {
  id: TeamChartLineId;
  label: string;
  color: string;
  description: string;
}

/** Which games each point rates: the season so far, or each team's last 10 games. */
export type TeamChartWindow = "season" | "last10";

/** The chart's data point: x is the day of the season (0 for its first game day), y the score. */
interface TeamChartPoint {
  x: number;
  y: number;
  point: TeamRatingPoint;
}

/**
 * The power rating chart: a team's power rating after each game of the season, and the stats it's built from, all on
 * the rating's 0 to 10 scale (5 is the league average), so they share one axis. The toggles above it pick up to 4 lines, and
 * the window rates the season so far or each team's last 10 games. Hovering a game shows each line's stat and league
 * rank.
 *
 * It takes every team's games and the teams to chart, so a league page can chart several teams: with more than one
 * team, it plots one line per team, in the team's color, for the one picked stat.
 */
@Component({
    selector: 'app-team-rating-chart',
    templateUrl: './team-rating-chart.component.html',
    styleUrls: ['./team-rating-chart.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamRatingChartComponent implements OnChanges, AfterViewInit, OnDestroy {

  /** Every team's games of the season, from /api/nhl-stats/team-games. */
  @Input()
  public games: TeamGameStats[] = [];

  /** The teams to chart. */
  @Input()
  public teamIds: number[] = [];

  @Input()
  public title: string = "Power Rating";

  /** The most lines shown at once, so they stay readable. */
  public static readonly maxLines = 4;

  /** The power rating's line, white so it stands out from its stats' colored lines. */
  public static readonly ratingLine: TeamChartLine = {
    id: "rating",
    label: "Power rating",
    color: "#ffffff",
    description: "The HokMob power rating: 30% points %, 20% goal differential, 30% 5v5 Corsi % and 20% special teams"
  };

  public readonly lines: TeamChartLine[] = [TeamRatingChartComponent.ratingLine,
    ...TeamRatingUtils.chartMetrics.map(metric => ({
      id: metric.id,
      label: metric.shortLabel,
      color: metric.color,
      description: metric.description
    }))];

  public readonly windowOptions: {value: TeamChartWindow, label: string}[] = [
    {value: "season", label: "Season"},
    {value: "last10", label: "Last 10"}
  ];

  public selectedLines: TeamChartLineId[] = ["rating"];

  public window: TeamChartWindow = "season";

  /** Each charted team's points, oldest first. */
  public timeline = new Map<number, TeamRatingPoint[]>();

  @ViewChild("ratingChart")
  private chartCanvas: ElementRef<HTMLCanvasElement>;

  private chart: Chart<"line", TeamChartPoint[]>;

  /** The first game day of the season, day 0 of the x axis. */
  private firstDate: dayjs.Dayjs;

  /** With several teams, one stat is charted, a line per team. */
  public get isMultiTeam(): boolean {
    return (this.teamIds ?? []).length > 1;
  }

  /** Whether any team has enough games for a point. */
  public get hasPoints(): boolean {
    return [...this.timeline.values()].some(points => points.length > 0);
  }

  public get chartLabel(): string {
    const lines = this.selectedLines.map(id => this.getLine(id).label).join(", ");
    return "Line chart of " + lines + " after each game, on a 0 to 10 scale where 5 is the league average";
  }

  public ngOnChanges(changes: SimpleChanges): void {
    const teamIdsChange = changes["teamIds"];
    const isSameTeams = teamIdsChange && !teamIdsChange.firstChange
        && TeamRatingChartComponent.isSameList(teamIdsChange.previousValue, teamIdsChange.currentValue);
    // A new array of the same teams doesn't redraw, which would restart the chart's animation
    if (!changes["games"] && (!teamIdsChange || isSameTeams)) {
      return;
    }
    if (this.isMultiTeam && this.selectedLines.length > 1) {
      this.selectedLines = [this.selectedLines[0]];
    }
    this.buildTimeline();
    this.updateChart();
  }

  public ngAfterViewInit(): void {
    this.createChart();
    this.updateChart();
  }

  public ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  public isSelected(line: TeamChartLine): boolean {
    return this.selectedLines.includes(line.id);
  }

  /** A line that can't be added because maxLines are already shown. */
  public isDisabled(line: TeamChartLine): boolean {
    return !this.isMultiTeam && !this.isSelected(line) && this.selectedLines.length >= TeamRatingChartComponent.maxLines;
  }

  /**
   * Shows or hides a line. The last line can't be hidden. With several teams, it picks the one stat to chart.
   */
  public toggleLine(line: TeamChartLine): void {
    if (this.isMultiTeam) {
      this.selectedLines = [line.id];
    } else if (this.isSelected(line)) {
      if (this.selectedLines.length === 1) {
        return;
      }
      this.selectedLines = this.selectedLines.filter(id => id !== line.id);
    } else if (!this.isDisabled(line)) {
      // Kept in the toggles' order, so the legend and the tooltip list the lines the same way
      this.selectedLines = this.lines.map(item => item.id)
          .filter(id => id === line.id || this.selectedLines.includes(id));
    }
    this.updateChart();
  }

  public selectWindow(window: TeamChartWindow): void {
    if (window === this.window) {
      return;
    }
    this.window = window;
    this.buildTimeline();
    this.updateChart();
  }

  public getLineTitle(line: TeamChartLine): string {
    return this.isDisabled(line)
        ? line.description + ". Up to " + TeamRatingChartComponent.maxLines + " lines at once"
        : line.description;
  }

  private static isSameList(listA: number[], listB: number[]): boolean {
    return (listA ?? []).length === (listB ?? []).length && (listA ?? []).every((item, i) => item === listB[i]);
  }

  private getLine(id: TeamChartLineId): TeamChartLine {
    return this.lines.find(line => line.id === id);
  }

  private buildTimeline(): void {
    const games = this.games ?? [];
    this.firstDate = games.length
        ? dayjs(games.reduce((first, game) => game.gameDate < first ? game.gameDate : first, games[0].gameDate))
        : undefined;
    this.timeline = TeamRatingUtils.getTimeline(games, this.teamIds ?? [],
        {lastGames: this.window === "last10" ? 10 : undefined});
  }

  private createChart(): void {
    this.chart = new Chart<"line", TeamChartPoint[]>(this.chartCanvas.nativeElement, {
      type: "line",
      data: {datasets: []},
      options: {
        maintainAspectRatio: false,
        animation: {duration: 250},
        parsing: false,
        interaction: {mode: "nearest", axis: "x", intersect: false},
        elements: {
          point: {radius: 0, hoverRadius: 4, hitRadius: 8, hoverBorderWidth: 2, hoverBorderColor: "#1b1b1b"},
          line: {borderWidth: 2, tension: 0.25, borderCapStyle: "round", borderJoinStyle: "round"}
        },
        scales: {
          x: {
            type: "linear",
            ticks: {
              color: "#959595",
              maxTicksLimit: 7,
              maxRotation: 0,
              // The last game's day isn't labelled, which could crowd the round tick before it
              includeBounds: false,
              callback: value => this.firstDate?.add(Number(value), "day").format("MMM D")
            },
            grid: {display: false},
            border: {color: "#414141"}
          },
          y: {
            suggestedMin: 2,
            suggestedMax: 8,
            ticks: {color: "#959595", stepSize: 1},
            grid: {color: "#272727"},
            border: {display: false}
          }
        },
        plugins: {
          legend: {display: false},
          tooltip: {
            backgroundColor: "#2b2b2b",
            borderColor: "#414141",
            borderWidth: 1,
            titleColor: "#ffffff",
            bodyColor: "#e0e0e0",
            usePointStyle: true,
            boxPadding: 4,
            itemSort: (itemA, itemB) => itemA.datasetIndex - itemB.datasetIndex,
            callbacks: {
              title: items => this.getTooltipTitle(items),
              label: item => this.getTooltipLabel(item)
            }
          }
        }
      },
      plugins: [TeamRatingChartComponent.averageLinePlugin]
    });
  }

  private updateChart(): void {
    if (!this.chart) {
      return;
    }
    const datasets = this.getDatasets();
    this.chart.data.datasets = datasets;
    // From the season's first game day to the last game charted, rather than the next round tick
    this.chart.options.scales["x"].min = 0;
    this.chart.options.scales["x"].max = Math.max(1, ...datasets.flatMap(dataset => dataset.data.map(point => point.x)));
    // A single team's lines share their games, so the tooltip lists all of them; several teams' games differ
    this.chart.options.interaction.mode = this.isMultiTeam ? "nearest" : "index";
    this.chart.update();
  }

  private getDatasets(): ChartDataset<"line", TeamChartPoint[]>[] {
    const datasets: ChartDataset<"line", TeamChartPoint[]>[] = [];
    [...this.timeline.entries()].forEach(([teamId, points]) => {
      this.selectedLines.forEach(lineId => {
        const line = this.getLine(lineId);
        const color = this.isMultiTeam ? NhlTeamColorUtils.getTeamPrimaryColor(teamId) : line.color;
        datasets.push({
          label: this.isMultiTeam ? NhlTeamUtils.getTeam(teamId)?.triCode : line.label,
          data: points.map(point => ({
            x: this.firstDate ? dayjs(point.date).diff(this.firstDate, "day") : 0,
            y: lineId === "rating" ? point.rating : point.scores[lineId],
            point
          })),
          borderColor: color,
          backgroundColor: color,
          pointHoverBackgroundColor: color,
          // The rating is the chart's subject, so it's a little heavier than its stats
          borderWidth: lineId === "rating" && !this.isMultiTeam ? 3 : 2
        });
      });
    });
    return datasets;
  }

  private getTooltipTitle(items: TooltipItem<"line">[]): string {
    const point = (items[0]?.raw as TeamChartPoint)?.point;
    if (!point) {
      return "";
    }
    const games = this.window === "last10" ? "Last " + Math.min(10, point.gamesPlayed) + " games" : "Game " + point.gamesPlayed;
    return dayjs(point.date).format("MMM D") + (this.isMultiTeam ? "" : " · " + games);
  }

  /**
   * A line's stat and rank, like "Corsi %: 52.3% (9th)", or "Power rating: 6.2 (8th)".
   */
  private getTooltipLabel(item: TooltipItem<"line">): string {
    const point = (item.raw as TeamChartPoint)?.point;
    const lineId = this.isMultiTeam ? this.selectedLines[0] : this.selectedLines[item.datasetIndex];
    if (!point || !lineId) {
      return "";
    }
    const label = item.dataset.label + ": ";
    if (lineId === "rating") {
      return label + TeamRatingUtils.formatRating(point.rating) + " (" + TeamRatingUtils.getOrdinal(point.rank) + ")";
    }
    const value = point.values[lineId];
    const metric = TeamRatingUtils.getMetric(lineId);
    return label + (value == null ? "-" : metric.format(value) + " (" + TeamRatingUtils.getOrdinal(point.ranks[lineId]) + ")");
  }

  /**
   * Draws the league average (5) as a dashed line across the chart, under the lines, labelled at its right end.
   */
  private static readonly averageLinePlugin: Plugin<"line"> = {
    id: "leagueAverage",
    beforeDatasetsDraw: chart => {
      const {ctx, chartArea, scales} = chart;
      const y = scales["y"].getPixelForValue(TeamRatingUtils.averageRating);
      if (y < chartArea.top || y > chartArea.bottom) {
        return;
      }
      ctx.save();
      ctx.strokeStyle = "#646464";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#959595";
      ctx.font = "11px Roboto, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("League avg", chartArea.right, y - 3);
      ctx.restore();
    }
  };
}
