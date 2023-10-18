import {Component, Input} from '@angular/core';
import * as dayjs from "dayjs";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {NhlLinescoreModel} from "@shared/models/nhl-linescore/nhl-linescore.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";

@Component({
  selector: 'app-game-header',
  templateUrl: './game-header.component.html',
  styleUrls: ['./game-header.component.scss']
})
export class GameHeaderComponent {

  @Input()
  public isDropdownHeader;

  @Input()
  public gameLiveData: NhlLiveFeedModel;

  @Input()
  public gameLinescore: NhlLinescoreModel;

  @Input()
  public gameModel: NhlGameModel;

  @Input()
  public intermissionTimeRemaining: string;

  @Input()
  public homeTeamLogo: any;

  @Input()
  public awayTeamLogo: any;

  @Input()
  public isIntermission: boolean;

  public get liveGame(): boolean {
    if (this.gameLiveData) {
      return NhlGameInfoUtils.isLiveGame(this.gameLiveData.gameData.status);
    }
    return false;
  }

  public get completedGame(): boolean {
    if (this.gameLiveData) {
      return NhlGameInfoUtils.isCompletedGame(this.gameLiveData.gameData.status);
    }
    return false;
  }

  public get futureGame(): boolean {
    if (this.gameLiveData) {
      return NhlGameInfoUtils.isFutureGame(this.gameLiveData.gameData.status);
    }
    return false;
  }

  public get homeTeamName(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.home.name;
    }
    return "N/A";
  }

  public get awayTeamName(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.away.name;
    }
    return "N/A";
  }

  public get homeTeamShortName(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.home.teamName;
    }
    return "N/A";
  }

  public get awayTeamShortName(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.away.teamName;
    }
    return "N/A";
  }

  public get homeTeamId(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.home.id;
    }
    return 0;
  }

  public get awayTeamId(): number {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.away.id;
    }
    return 0;
  }

  public get gameTime(): string {
    if (this.gameLiveData) {
      return dayjs(this.gameLiveData.gameData.datetime.dateTime).format("h:mm A");
    }
    return "N/A";
  }

  public get gameDay(): string {
    if (this.gameLiveData) {
      return DateTimeUtils.getDayDisplayValue(dayjs(this.gameLiveData.gameData.datetime.dateTime).toDate());
    }
    return "N/A";
  }

  public get playoffSeriesDetails(): string {
    if (this.gameModel) {
      if (this.gameModel.seriesSummary.gameNumber === 1 || this.gameModel.seriesSummary.seriesStatusShort.length === 0) {
        return "Series (0-0)";
      } else {
        return this.gameModel.seriesSummary.seriesStatusShort;
      }
    }
    return "";
  }

  public get isPlayoffGame(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.game.type === "P";
    }
    return false;
  }

  public get gameScore(): string {
    if (this.gameLinescore) {
      return this.gameLinescore.teams.home.goals + " - " + this.gameLinescore.teams.away.goals;
    }
    return "N/A"
  }

  public get completedGameStatus(): string {
    if (this.gameLinescore) {
      if (this.gameLinescore.currentPeriod === 5 && this.gameLinescore.hasShootout) {
        return "Final SO";
      } else if (this.gameLinescore.currentPeriod === 4 && !this.gameLinescore.hasShootout) {
        return "Final OT";
      } else if (this.gameLinescore.currentPeriod > 4) {
        return "Final " + (this.gameLinescore.currentPeriod - 3) + "OT";
      } else {
        return "Final";
      }
    }
    return "N/A"
  }

  public get liveGameStatus(): string {
    if (this.gameLinescore) {
      if (this.gameLinescore.hasShootout) {
        return "SO";
      } else if (this.gameLinescore.currentPeriodTimeRemaining === "END") {
        return "End " + this.gameLinescore.currentPeriodOrdinal;
      } else {
        return this.gameLinescore.currentPeriodOrdinal + " - " + this.formatTimeRemaining();
      }
    }
    return "N/A"
  }

  public get homeTeamPP(): boolean {
    if (this.gameLinescore) {
      return false;
      // return this.gameLinescore.powerPlayInfo
    }
    return false;
  }

  public get awayTeamPP(): boolean {
    if (this.gameLinescore) {
      // console.log("live data", this.gameLiveData);
      return false;
      // return this.gameLinescore.powerPlayInfo
    }
    return false;
  }

  private formatTimeRemaining(): string {
    if (this.gameLinescore.currentPeriodTimeRemaining.startsWith("0")) {
      return this.gameLinescore.currentPeriodTimeRemaining.substring(1);
    } else {
      return this.gameLinescore.currentPeriodTimeRemaining;
    }
  }

}
