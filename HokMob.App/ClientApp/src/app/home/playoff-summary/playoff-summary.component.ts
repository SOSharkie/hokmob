import {Component, OnInit} from '@angular/core';
import {NhlPlayoffModel} from "@shared/models/nhl-playoffs/nhl-playoff.model";
import {NhlPlayoffService} from "@shared/services/nhl-playoff.service";
import {NhlPlayoffSeriesModel} from "@shared/models/nhl-playoffs/nhl-playoff-series.model";

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

  constructor(private nhlPlayoffService: NhlPlayoffService) {
  }

  public ngOnInit(): void {
    this.nhlPlayoffService.getNhlPlayoffs().then(result => {
      this.playoffsData = result;
      console.log(this.playoffsData);
    })
  }

}
