import {Component, Input, OnChanges, SimpleChanges, ViewEncapsulation} from '@angular/core';
import * as dayjs from "dayjs";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {MatDialog} from "@angular/material/dialog";
import {
  PlayoffSeriesDialogComponent,
  PlayoffSeriesDialogData
} from "@app/playoffs/playoff-series-dialog/playoff-series-dialog.component";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {PlayoffCarouselSeed, PlayoffCarouselSeries, PlayoffSeriesGame} from "@shared/models/nhl-web-api/playoffs.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";

@Component({
  selector: 'app-playoff-series',
  templateUrl: './playoff-series.component.html',
  styleUrls: ['./playoff-series.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayoffSeriesComponent implements OnChanges {

  @Input()
  public seriesData: PlayoffCarouselSeries;

  /** The season of the series, like 20252026. Needed to load the next game date. */
  @Input()
  public season: number;

  @Input()
  public smallerVersion: boolean = false;

  /** Square, since the bracket lines the logos up in columns. Phones shorten it, see the stylesheet. */
  public readonly logoSize: number = 40;

  public isLogoALoaded: boolean = false;

  public isLogoBLoaded: boolean = false;

  public logoA: any = "assets/team_fallback.png";

  public logoB: any = "assets/team_fallback.png";

  public nextGame: PlayoffSeriesGame;

  public get teamAName(): string {
    return this.seriesData?.topSeed?.abbrev ?? "TBD";
  }

  public get teamBName(): string {
    return this.seriesData?.bottomSeed?.abbrev ?? "TBD";
  }

  public get teamARank(): string {
    return this.getRankText(this.seriesData?.topSeed);
  }

  public get teamBRank(): string {
    return this.getRankText(this.seriesData?.bottomSeed);
  }

  public get teamAWins(): number {
    return this.seriesData?.topSeed?.wins ?? 0;
  }

  public get teamBWins(): number {
    return this.seriesData?.bottomSeed?.wins ?? 0;
  }

  public get teamALost(): boolean {
    return this.hasLost(this.seriesData?.topSeed, this.seriesData?.bottomSeed);
  }

  public get teamBLost(): boolean {
    return this.hasLost(this.seriesData?.bottomSeed, this.seriesData?.topSeed);
  }

  /**
   * Whether both teams are known. A series without them (a later round before the earlier one ends) has no dialog.
   */
  public get hasBothTeams(): boolean {
    return !!this.seriesData?.topSeed && !!this.seriesData?.bottomSeed;
  }

  public get nextGameDay(): string {
    if (this.nextGame && this.nextGame.gameScheduleState !== NhlGameScheduleStateEnum.TBD) {
      return dayjs(this.nextGame.startTimeUTC).format("MMM D");
    }
    return this.seriesData?.winningTeamId ? "Final" : "TBD";
  }

  constructor(public seriesDialog: MatDialog,
              private nhlPlayoffService: NhlStandingAndPlayoffService) {
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['seriesData'] && this.seriesData && !this.isLogoALoaded && !this.isLogoBLoaded) {
      if (this.seriesData.topSeed) {
        this.logoA = NhlTeamLogoUtils.getTeamPrimaryLogo(this.seriesData.topSeed.id);
        this.isLogoALoaded = true;
      }
      if (this.seriesData.bottomSeed) {
        this.logoB = NhlTeamLogoUtils.getTeamPrimaryLogo(this.seriesData.bottomSeed.id);
        this.isLogoBLoaded = true;
      }
      // The next game date is only shown in the full-size version
      if (!this.smallerVersion && this.season && this.hasBothTeams && !this.seriesData.winningTeamId) {
        this.nhlPlayoffService.getNhlPlayoffSeriesSchedule(this.season, this.seriesData.seriesLetter).then(result => {
          this.nextGame = result.games?.find(game => !NhlGameInfoUtils.isCompletedGame(game.gameState));
        }).catch(() => {
          // The service logs the error. The next game date stays TBD
        });
      }
    }
  }

  public openSeriesDialog(): void {
    if (!this.hasBothTeams) {
      return;
    }
    this.seriesDialog.open(PlayoffSeriesDialogComponent, {
      maxWidth: "85vw",
      backdropClass: "dialog-backdrop",
      data: {series: this.seriesData, season: this.season} as PlayoffSeriesDialogData
    });
  }

  private getRankText(seed: PlayoffCarouselSeed): string {
    return seed?.rank ? "  " + seed.rank : " ";
  }

  /**
   * Whether the series is over and the given seed lost it.
   */
  private hasLost(seed: PlayoffCarouselSeed, opponent: PlayoffCarouselSeed): boolean {
    if (!seed || !opponent) {
      return false;
    }
    if (this.seriesData.winningTeamId) {
      return this.seriesData.winningTeamId === opponent.id;
    }
    return opponent.wins >= this.seriesData.neededToWin;
  }
}
