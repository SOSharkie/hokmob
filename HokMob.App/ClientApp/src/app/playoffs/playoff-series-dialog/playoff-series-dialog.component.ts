import {Component, Inject, OnInit, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlPlayoffSeriesModel} from "@shared/models/nhl-playoffs/nhl-playoff-series.model";
import {NhlPlayoffService} from "@shared/services/nhl-playoff.service";


@Component({
  selector: 'app-playoff-series-dialog',
  templateUrl: './playoff-series-dialog.component.html',
  styleUrls: ['./playoff-series-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayoffSeriesDialogComponent implements OnInit {

  public get seriesTitle(): string {
    if (this.seriesData) {
      switch (this.seriesData.round.number) {
        case 1:
          return this.seriesData.conference.name + " Conference Round 1";
        case 2:
          return this.seriesData.conference.name + " Conference Semifinals";
        case 3:
          return this.seriesData.conference.name + " Conference Finals";
        case 4:
          return "Stanley Cup Finals";
        default:
          return "NHL Playoffs";
      }
    }
    return "";
  }

  public get seriesStatus(): string {
    if (this.seriesData) {
      return this.seriesData.currentGame.seriesSummary.seriesStatus;
    }
    return "";
  }

  public seriesGames: NhlGameModel[];

  constructor(private nhlPlayoffService: NhlPlayoffService,
              private dialogRef: MatDialogRef<PlayoffSeriesDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public seriesData: NhlPlayoffSeriesModel) {}

  public ngOnInit(): void {
    if (this.seriesData.matchupTeams) {
      this.nhlPlayoffService.getNhlPlayoffSeriesGames(this.seriesData.matchupTeams[0].team.id, this.seriesData.matchupTeams[1].team.id).then(result => {
        this.seriesGames = [];
        result.dates.forEach(date => {
          date.games.forEach(game => {
            this.seriesGames.push(game);
          });
        });
      });
    } else {
      if (this.seriesData.seriesCode === "L" || this.seriesData.seriesCode === "K" || this.seriesData.seriesCode === "N") {
        this.seriesData.conference.name = "Western";
      } else {
        this.seriesData.conference.name = "Eastern";
      }
    }
  }

  public seriesGameClicked(): void {
    this.dialogRef.close();
  }
}
