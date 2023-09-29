import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import * as dayjs from 'dayjs'
import {NhlImageService} from "@shared/services/nhl-image.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.component.html',
  styleUrls: ['./scorecard.component.scss']
})
export class ScorecardComponent implements OnChanges {

  @Input()
  public game: NhlGameModel;

  @Input()
  public smallerScorecard: boolean = false;

  @Output()
  public scorecardClicked = new EventEmitter<boolean>();

  public isHomeLogoLoaded: boolean = false;

  public isAwayLogoLoaded: boolean = false;

  public homeTeamLogo: any;

  public awayTeamLogo: any;

  public get liveGame(): boolean {
    if (this.game) {
      return NhlGameInfoUtils.isLiveGame(this.game.status);
    }
    return false;
  }

  public get completedGame(): boolean {
    if (this.game) {
      return NhlGameInfoUtils.isCompletedGame(this.game.status);
    }
    return false;
  }

  public get futureGame(): boolean {
    if (this.game) {
      return NhlGameInfoUtils.isFutureGame(this.game.status);
    }
    return false;
  }

  public get homeTeamName(): string {
    if (this.game) {
      return this.game.teams.home.team.name;
    }
    return "N/A"
  }

  public get awayTeamName(): string {
    if (this.game) {
      return this.game.teams.away.team.name;
    }
    return "N/A"
  }

  public get isPlayoffGame(): boolean {
    if (this.game) {
      return this.game.seriesSummary && this.game.gameType === "P";
    }
    return false;
  }

  public get playoffSeriesDetails(): string {
    if (this.game && this.game.seriesSummary) {
      if (this.game.seriesSummary.gameNumber === 1 || !this.game.seriesSummary.seriesStatusShort) {
        return "(0-0)";
      } else {
        return this.game.seriesSummary.seriesStatusShort;
      }
    }
    return "";
  }

  public get gameDate(): string {
    if (this.game) {
      switch (this.game.status.detailedState) {
        case NhlGameStateEnum.SCHEDULE_TBD:
        case NhlGameStateEnum.POSTPONED:
          return "";
        default:
          return DateTimeUtils.getDateDisplayValue(dayjs(this.game.gameDate).toDate());
      }
    }
    return ""
  }

  public get gameTime(): string {
    if (this.game) {
      switch (this.game.status.detailedState) {
        case NhlGameStateEnum.SCHEDULE_TBD:
          return "TBD";
        case NhlGameStateEnum.POSTPONED:
          return "Postponed";
        default:
          return dayjs(this.game.gameDate).format("h:mm");
      }
    }
    return "N/A"
  }

  public get gameAmPm(): string {
    if (this.game) {
      switch (this.game.status.detailedState) {
        case NhlGameStateEnum.SCHEDULE_TBD:
        case NhlGameStateEnum.POSTPONED:
          return "";
        default:
          return dayjs(this.game.gameDate).format("A");
      }
    }
    return ""
  }

  public get gameScore(): string {
    if (this.game) {
      return this.game.teams.home.score + " - " + this.game.teams.away.score;
    }
    return "N/A"
  }

  public get completedGameStatus(): string {
    if (this.game) {
      if (this.game.linescore.currentPeriod === 5 && this.game.linescore.hasShootout) {
        return "SO";
      } else if (this.game.linescore.currentPeriod === 4 && !this.game.linescore.hasShootout) {
        return "OT";
      } else if (this.game.linescore.currentPeriod > 4) {
        return (this.game.linescore.currentPeriod - 3) + "OT";
      } else {
        return "Final";
      }
    }
    return "N/A"
  }

  public get liveGameStatus(): string {
    if (this.game && this.game.linescore) {
      if (this.game.linescore.hasShootout) {
        return "SO";
      } else if (this.game.linescore.currentPeriodTimeRemaining === "END") {
        return "End " + this.game.linescore.currentPeriodOrdinal;
      } else {
        return this.game.linescore.currentPeriodOrdinal + " - " + this.formatTimeRemaining();
      }
    }
    return "Live"
  }

  constructor(private nhlLogoService: NhlImageService) {
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['game'] && !this.isHomeLogoLoaded && !this.isAwayLogoLoaded) {
      this.homeTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.game.teams.home.team.id);
      this.isHomeLogoLoaded = true;
      this.awayTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.game.teams.away.team.id);
      this.isAwayLogoLoaded = true;
    }
  }

  public clickScorecard($event: any) {
    this.scorecardClicked.emit(true);
  }

  private formatTimeRemaining(): string {
    if (this.game.linescore.currentPeriodTimeRemaining.startsWith("0")) {
      return this.game.linescore.currentPeriodTimeRemaining.substring(1);
    } else {
      return this.game.linescore.currentPeriodTimeRemaining;
    }
  }
}
