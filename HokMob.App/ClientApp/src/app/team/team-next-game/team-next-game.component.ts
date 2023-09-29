import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {NhlLinescoreModel} from "@shared/models/nhl-linescore/nhl-linescore.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import * as dayjs from "dayjs";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

@Component({
  selector: 'app-team-next-game',
  templateUrl: './team-next-game.component.html',
  styleUrls: ['./team-next-game.component.scss']
})
export class TeamNextGameComponent implements OnChanges {

  @Input()
  public team: NhlTeamModel;

  @Input()
  public gameLiveData: NhlLiveFeedModel;

  @Input()
  public gameLinescore: NhlLinescoreModel;

  @Input()
  public gameModel: NhlGameModel;

  public homeTeamLogo;

  public awayTeamLogo;

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

  public ngOnChanges(changes:SimpleChanges): void {
    if (changes['gameLinescore']) {
      this.homeTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.gameLinescore.teams.home.team.id);
      this.awayTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.gameLinescore.teams.away.team.id);
    }
  }

  private formatTimeRemaining(): string {
    if (this.gameLinescore.currentPeriodTimeRemaining.startsWith("0")) {
      return this.gameLinescore.currentPeriodTimeRemaining.substring(1);
    } else {
      return this.gameLinescore.currentPeriodTimeRemaining;
    }
  }

}
