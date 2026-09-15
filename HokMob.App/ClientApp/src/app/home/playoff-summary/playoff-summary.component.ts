import {Component, OnInit} from '@angular/core';
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {PlayoffCarousel, PlayoffCarouselRound, PlayoffCarouselSeries} from "@shared/models/nhl-web-api/playoffs.model";

@Component({
  selector: 'app-playoff-summary',
  templateUrl: './playoff-summary.component.html',
  styleUrls: ['./playoff-summary.component.scss']
})
export class PlayoffSummaryComponent implements OnInit {

  public playoffsData: PlayoffCarousel;

  public get currentSeries(): PlayoffCarouselSeries[] {
    return this.currentRound?.series ?? [];
  }

  public get playoffsTitle(): string {
    if (this.currentRound) {
      return "Playoffs: " + this.getRoundName(this.currentRound.roundLabel);
    }
    return "Playoffs"
  }

  private get currentRound(): PlayoffCarouselRound {
    return this.playoffsData?.rounds?.find(round => round.roundNumber === this.playoffsData.currentRound);
  }

  constructor(private nhlPlayoffService: NhlStandingAndPlayoffService) {
  }

  public ngOnInit(): void {
    this.nhlPlayoffService.getNhlPlayoffs(DateTimeUtils.getCurrentNhlSeason()).then(result => {
      this.playoffsData = result;
    }).catch(() => {
      // The service logs the error. Show the plain title without series
    });
  }

  /**
   * Turns a round slug like "1st-round" or "stanley-cup-final" into "1st Round" or "Stanley Cup Final".
   */
  private getRoundName(roundLabel: string): string {
    return roundLabel.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

}
