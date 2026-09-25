import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild} from '@angular/core';
import {Chart, Plugin, registerables, TooltipItem} from 'chart.js';
import {PositionGroup, RatedGame} from "@shared/models/nhl-history/season-history.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {PositionOption, RatingDistribution, SeasonRatingStatsUtils} from "@app/history/season-rating-stats";
Chart.register(...registerables);

/**
 * The rating distribution card: a histogram of every game rating of the season in 0.5 bins from 0 to 10, for
 * forwards, defensemen or goalies, with the green (7) and blue (8.5) thresholds marked, and the mean, median and share
 * of green and blue games.
 */
@Component({
  selector: 'app-rating-distribution',
  templateUrl: './rating-distribution.component.html',
  styleUrls: ['./rating-distribution.component.scss']
})
export class RatingDistributionComponent implements OnChanges, AfterViewInit, OnDestroy {

  public readonly positionOptions: PositionOption[] = SeasonRatingStatsUtils.positionOptions;

  /** Every rated game of the season. */
  @Input()
  public ratedGames: RatedGame[];

  public position: PositionGroup = "F";

  public distribution: RatingDistribution = SeasonRatingStatsUtils.getDistribution([], "F");

  public readonly greenColor = StatsUtils.hokmobRatingGreen;

  public readonly blueColor = StatsUtils.hokmobRatingBlue;

  @ViewChild("distributionChart")
  private chartCanvas: ElementRef<HTMLCanvasElement>;

  private distributionChart: Chart<"bar", {x: number, y: number}[]>;

  public get mean(): string {
    return this.distribution.total ? this.distribution.mean.toFixed(2) : "-";
  }

  public get median(): string {
    return this.distribution.total ? this.distribution.median.toFixed(1) : "-";
  }

  public get greenShare(): string {
    return RatingDistributionComponent.formatShare(this.distribution.greenShare, this.distribution.total);
  }

  public get blueShare(): string {
    return RatingDistributionComponent.formatShare(this.distribution.blueShare, this.distribution.total);
  }

  public get gameCount(): string {
    return this.distribution.total.toLocaleString("en-US");
  }

  public ngOnChanges(): void {
    this.buildDistribution();
    this.updateChart();
  }

  public ngAfterViewInit(): void {
    this.createChart();
    this.updateChart();
  }

  public ngOnDestroy(): void {
    this.distributionChart?.destroy();
    this.distributionChart = undefined;
  }

  public selectPosition(position: PositionGroup): void {
    if (position === this.position) {
      return;
    }
    this.position = position;
    this.buildDistribution();
    this.updateChart();
  }

  private buildDistribution(): void {
    this.distribution = SeasonRatingStatsUtils.getDistribution(this.ratedGames, this.position);
  }

  private createChart(): void {
    const binSize = SeasonRatingStatsUtils.binSize;
    this.distributionChart = new Chart<"bar", {x: number, y: number}[]>(this.chartCanvas.nativeElement, {
      type: "bar",
      data: {
        datasets: [{
          data: [],
          // Bars fill their bin, with a sliver between them
          barPercentage: 0.92,
          categoryPercentage: 1,
          borderRadius: 3
        }]
      },
      options: {
        maintainAspectRatio: false,
        animation: {duration: 250},
        scales: {
          x: {
            type: "linear",
            min: 0,
            max: SeasonRatingStatsUtils.maxRating,
            // Bin edges fall on whole and half ratings, so the whole ratings are labeled
            ticks: {stepSize: 1, color: "#959595"},
            grid: {display: false},
            border: {color: "#414141"},
            offset: false
          },
          y: {
            beginAtZero: true,
            ticks: {color: "#959595", precision: 0},
            grid: {color: "#272727"},
            border: {display: false}
          }
        },
        plugins: {
          legend: {display: false},
          tooltip: {
            displayColors: false,
            backgroundColor: "#2b2b2b",
            borderColor: "#414141",
            borderWidth: 1,
            callbacks: {
              title: items => RatingDistributionComponent.getBinLabel(items[0]?.parsed?.x - binSize / 2),
              label: item => this.getTooltipLabel(item)
            }
          }
        }
      },
      plugins: [RatingDistributionComponent.thresholdPlugin]
    });
  }

  private updateChart(): void {
    if (!this.distributionChart) {
      return;
    }
    const dataset = this.distributionChart.data.datasets[0];
    // Each bar is centered in its bin on the linear axis
    dataset.data = this.distribution.bins.map(bin => ({x: bin.from + SeasonRatingStatsUtils.binSize / 2, y: bin.count}));
    dataset.backgroundColor = this.distribution.bins.map(bin => StatsUtils.getHokmobRatingColor(bin.from));
    this.distributionChart.update();
  }

  private getTooltipLabel(item: TooltipItem<"bar">): string {
    const count = item.parsed.y;
    const share = this.distribution.total ? count / this.distribution.total : 0;
    return count.toLocaleString("en-US") + (count === 1 ? " game" : " games") + " (" + (share * 100).toFixed(1) + "%)";
  }

  /**
   * A bin's ratings, like "7.0 - 7.4". Ratings have one decimal, so a bin ends a tenth below the next one, and the
   * last one holds the 10s too.
   */
  public static getBinLabel(from: number): string {
    const next = from + SeasonRatingStatsUtils.binSize;
    const to = next >= SeasonRatingStatsUtils.maxRating ? SeasonRatingStatsUtils.maxRating : next - 0.1;
    return from.toFixed(1) + " - " + to.toFixed(1);
  }

  /**
   * A share as a percentage with one decimal, like "18.3%", or "-" without games.
   */
  private static formatShare(share: number, total: number): string {
    return total ? (share * 100).toFixed(1) + "%" : "-";
  }

  /**
   * Draws the green and blue rating thresholds as dashed lines across the chart, over the bars.
   */
  private static readonly thresholdPlugin: Plugin<"bar"> = {
    id: "ratingThresholds",
    afterDatasetsDraw: chart => {
      const {ctx, chartArea, scales} = chart;
      [
        {rating: SeasonRatingStatsUtils.greenRating, color: StatsUtils.hokmobRatingGreen},
        {rating: SeasonRatingStatsUtils.blueRating, color: StatsUtils.hokmobRatingBlue}
      ].forEach(threshold => {
        const x = scales["x"].getPixelForValue(threshold.rating);
        ctx.save();
        ctx.strokeStyle = threshold.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      });
    }
  };
}
