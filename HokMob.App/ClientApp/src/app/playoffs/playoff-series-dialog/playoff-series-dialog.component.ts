import {Component, Inject, OnInit, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlPlayoffSeriesModel} from "@shared/models/nhl-playoffs/nhl-playoff-series.model";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";


@Component({
  selector: 'app-playoff-series-dialog',
  templateUrl: './playoff-series-dialog.component.html',
  styleUrls: ['./playoff-series-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayoffSeriesDialogComponent implements OnInit {

  public get seriesTitle(): string {
    if (this.seriesData) {
      return NhlGameInfoUtils.getNhlGameDescription("P", this.seriesData.round.number, this.seriesData.conference.name,
          this.seriesData.currentGame.seriesSummary, this.seriesData.names.matchupShortName);
    }
    return "NHL Playoffs";
  }

  public seriesGames: NhlGameModel[];

  constructor(private nhlPlayoffService: NhlStandingAndPlayoffService,
              private dialogRef: MatDialogRef<PlayoffSeriesDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public seriesData: NhlPlayoffSeriesModel) {}

  public ngOnInit(): void {
    if (this.seriesData.matchupTeams && this.seriesData.matchupTeams[0] && this.seriesData.matchupTeams[1]) {
      this.nhlPlayoffService.getNhlPlayoffSeriesGames(this.seriesData.matchupTeams[0].team.id, this.seriesData.matchupTeams[1].team.id).then(result => {
        this.seriesGames = [];
        result.dates.forEach(date => {
          date.games.forEach(game => {
            if (this.isSeriesGame(game)) {
              this.seriesGames.push(game);
            }
          });
        });
      });
    } else {
      if (['E', 'F', 'G', 'H', 'L', 'K', 'N'].includes(this.seriesData.seriesCode)) {
        this.seriesData.conference.name = "Western";
      } else {
        this.seriesData.conference.name = "Eastern";
      }
    }
  }

  public seriesGameClicked(): void {
    this.dialogRef.close();
  }

  private isSeriesGame(game: NhlGameModel): boolean {
    return (game.teams.home.team.id === this.seriesData.matchupTeams[0].team.id &&
        game.teams.away.team.id === this.seriesData.matchupTeams[1].team.id) ||
        (game.teams.home.team.id === this.seriesData.matchupTeams[1].team.id &&
            game.teams.away.team.id === this.seriesData.matchupTeams[0].team.id)
  }
}
