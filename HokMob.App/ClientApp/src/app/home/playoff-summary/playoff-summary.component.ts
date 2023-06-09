import {Component, OnInit} from '@angular/core';
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlPlayoffSeriesModel} from "@shared/models/nhl-playoffs/nhl-playoff-series.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

@Component({
  selector: 'app-playoff-summary',
  templateUrl: './playoff-summary.component.html',
  styleUrls: ['./playoff-summary.component.scss']
})
export class PlayoffSummaryComponent implements OnInit {

  public playoffsData: NhlPlayoffModel;

  public get currentSeries(): NhlPlayoffSeriesModel[] {
    if (this.playoffsData) {
      return this.playoffsData.rounds[this.playoffsData.defaultRound - 1].series;
    }
    return [];
  }

  public get playoffsTitle(): string {
    if (this.playoffsData) {
      return "Playoffs: " + this.playoffsData.rounds[this.playoffsData.defaultRound -1].names.name
    }
    return "Playoffs"
  }

  constructor(private nhlPlayoffService: NhlStandingAndPlayoffService) {
  }

  public ngOnInit(): void {
    this.nhlPlayoffService.getNhlPlayoffs(DateTimeUtils.getCurrentNhlSeason()).then(result => {
      this.playoffsData = result;
    })
  }

}
