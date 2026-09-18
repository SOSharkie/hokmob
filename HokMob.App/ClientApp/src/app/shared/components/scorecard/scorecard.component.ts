import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import * as dayjs from 'dayjs'
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {ScoreGame, ScoreTeam} from "@shared/models/nhl-web-api/score.model";
import {NhlGameScheduleStateEnum} from "@shared/enums/nhl-game-schedule-state.enum";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {PeriodUtils} from "@shared/utils/period-utils";

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.component.html',
  styleUrls: ['./scorecard.component.scss']
})
export class ScorecardComponent implements OnChanges {

  @Input()
  public game: ScoreGame;

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
      return NhlGameInfoUtils.isLiveGame(this.game.gameState);
    }
    return false;
  }

  public get completedGame(): boolean {
    if (this.game) {
      return NhlGameInfoUtils.isCompletedGame(this.game.gameState);
    }
    return false;
  }

  public get futureGame(): boolean {
    if (this.game) {
      return NhlGameInfoUtils.isFutureGame(this.game.gameState);
    }
    return false;
  }

  public get homeTeamName(): string {
    if (this.game) {
      return this.getTeamFullName(this.game.homeTeam);
    }
    return "N/A"
  }

  public get awayTeamName(): string {
    if (this.game) {
      return this.getTeamFullName(this.game.awayTeam);
    }
    return "N/A"
  }

  public get isPlayoffGame(): boolean {
    if (this.game) {
      return !!this.game.seriesStatus && this.game.gameType === NhlGameTypeEnum.PLAYOFFS;
    }
    return false;
  }

  public get playoffSeriesDetails(): string {
    if (this.game) {
      return NhlGameInfoUtils.getSeriesStatusShort(this.game.seriesStatus);
    }
    return "";
  }

  /**
   * A short label for a game that isn't part of the regular season, like "PRE". A playoff game with a series status
   * shows that instead, since it already says the game is a playoff game.
   */
  public get gameTypeLabel(): string {
    if (this.game && !this.isPlayoffGame) {
      return NhlGameInfoUtils.getGameTypeLabel(this.game.gameType);
    }
    return "";
  }

  public get gameDate(): string {
    if (this.game) {
      switch (this.game.gameScheduleState) {
        case NhlGameScheduleStateEnum.TBD:
        case NhlGameScheduleStateEnum.POSTPONED:
          return "";
        default:
          return DateTimeUtils.getDateDisplayValue(dayjs(this.game.startTimeUTC).toDate());
      }
    }
    return ""
  }

  public get gameTime(): string {
    if (this.game) {
      switch (this.game.gameScheduleState) {
        case NhlGameScheduleStateEnum.TBD:
          return "TBD";
        case NhlGameScheduleStateEnum.POSTPONED:
          return "Postponed";
        default:
          return dayjs(this.game.startTimeUTC).format("h:mm");
      }
    }
    return "N/A"
  }

  public get gameAmPm(): string {
    if (this.game) {
      switch (this.game.gameScheduleState) {
        case NhlGameScheduleStateEnum.TBD:
        case NhlGameScheduleStateEnum.POSTPONED:
          return "";
        default:
          return dayjs(this.game.startTimeUTC).format("A");
      }
    }
    return ""
  }

  public get gameScore(): string {
    if (this.game) {
      return this.game.homeTeam.score + " - " + this.game.awayTeam.score;
    }
    return "N/A"
  }

  public get completedGameStatus(): string {
    if (this.game) {
      return PeriodUtils.getFinalLabel(this.game.gameOutcome, this.game.periodDescriptor);
    }
    return "N/A"
  }

  public get liveGameStatus(): string {
    if (this.game) {
      return PeriodUtils.getLiveLabel(this.game.periodDescriptor, this.game.clock);
    }
    return "Live"
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['game'] && !this.isHomeLogoLoaded && !this.isAwayLogoLoaded) {
      this.homeTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.game.homeTeam.id);
      this.isHomeLogoLoaded = true;
      this.awayTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.game.awayTeam.id);
      this.isAwayLogoLoaded = true;
    }
  }

  public clickScorecard($event: any) {
    this.scorecardClicked.emit(true);
  }

  /**
   * The score API only has the common name ("Jets"), so use the full name for known teams.
   */
  private getTeamFullName(team: ScoreTeam): string {
    let knownTeam = NhlTeamUtils.getTeam(team.id);
    return knownTeam.id === team.id ? knownTeam.name : team.name.default;
  }
}
