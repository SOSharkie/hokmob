import {Component, Input, OnChanges, SimpleChanges, ViewEncapsulation} from '@angular/core';
import {NhlPlayoffSeriesModel} from "@shared/models/nhl-playoffs/nhl-playoff-series.model";
import {NhlImageService} from "@shared/services/nhl-image.service";
import * as dayjs from "dayjs";
import {NhlPlayoffService} from "@shared/services/nhl-playoff.service";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {MatDialog} from "@angular/material/dialog";
import {PlayoffSeriesDialogComponent} from "@app/playoffs/playoff-series-dialog/playoff-series-dialog.component";

@Component({
  selector: 'app-playoff-series',
  templateUrl: './playoff-series.component.html',
  styleUrls: ['./playoff-series.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayoffSeriesComponent implements OnChanges {

  @Input()
  public seriesData: NhlPlayoffSeriesModel;

  public isLogoALoaded: boolean = false;

  public isLogoBLoaded: boolean = false;

  public logoA: any = "assets/team_fallback.png";

  public logoB: any = "assets/team_fallback.png";

  public seriesGames: NhlScheduleModel;

  public get teamAName() : string {
    if (this.seriesData && this.seriesData.names.teamAbbreviationA.length > 0) {
      return this.seriesData.names.teamAbbreviationA;
    }
    return "";
  }

  public get teamBName() : string {
    if (this.seriesData && this.seriesData.names.teamAbbreviationB.length > 0) {
      return this.seriesData.names.teamAbbreviationB;
    }
    return "";
  }

  public get teamARank() : string {
    if (this.seriesData && this.seriesData.matchupTeams) {
      return "  " + this.seriesData.matchupTeams[0].seed.rank;
    }
    return " ";
  }

  public get teamBRank() : string {
    if (this.seriesData && this.seriesData.matchupTeams) {
      return  "  " + this.seriesData.matchupTeams[1].seed.rank.toString();
    }
    return " ";
  }

  public get teamAWins(): number {
    if (this.seriesData && this.seriesData.matchupTeams) {
      return this.seriesData.matchupTeams[0].seriesRecord.wins;
    }
    return 0;
  }

  public get teamBWins(): number {
    if (this.seriesData && this.seriesData.matchupTeams) {
      return this.seriesData.matchupTeams[1].seriesRecord.wins;
    }
    return 0;
  }

  public get nextGameDay(): string {
    if (this.seriesData && this.seriesData.currentGame.seriesSummary.gameTime) {
      return dayjs(this.seriesData.currentGame.seriesSummary.gameTime).format("MMM D");
    }
    return "TBD";
  }

  constructor(public seriesDialog: MatDialog,
              private nhlLogoService: NhlImageService,
              private nhlPlayoffService: NhlPlayoffService) {
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['seriesData'] && !this.isLogoALoaded && !this.isLogoBLoaded) {
      if (!this.seriesData.matchupTeams) {
        return;
      }
      this.nhlPlayoffService.getNhlPlayoffSeriesGames(this.seriesData.matchupTeams[0].team.id, this.seriesData.matchupTeams[1].team.id).then(result => {
        this.seriesGames = result;
      });
      this.nhlLogoService.getNhlTeamLogo(this.seriesData.matchupTeams[0].team.id).then(data => {
        let reader = new FileReader();
        reader.addEventListener("load", () => {
          this.logoA = reader.result;
          this.isLogoALoaded = true;
        }, false);
        reader.readAsDataURL(data);
      });
      this.nhlLogoService.getNhlTeamLogo(this.seriesData.matchupTeams[1].team.id).then(data => {
        let reader = new FileReader();
        reader.addEventListener("load", () => {
          this.logoB = reader.result;
          this.isLogoBLoaded = true;
        }, false);
        reader.readAsDataURL(data);
      });
    }
  }

  public openSeriesDialog(): void {
    this.seriesDialog.open(PlayoffSeriesDialogComponent, {
      maxWidth: "85vw",
      backdropClass: "dialog-backdrop",
      data: this.seriesData
    });
  }
}
