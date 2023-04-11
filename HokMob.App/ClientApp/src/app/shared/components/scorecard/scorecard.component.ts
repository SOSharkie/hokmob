import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import * as dayjs from 'dayjs'
import {NhlLogoService} from "@shared/services/nhl-logo.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.component.html',
  styleUrls: ['./scorecard.component.scss']
})
export class ScorecardComponent implements OnChanges {

  @Input()
  public game: NhlGameModel;

  public isHomeLogoLoading: boolean;

  public isAwayLogoLoading: boolean;

  public isHomeLogoLoaded: boolean = false;

  public isAwayLogoLoaded: boolean = false;

  public homeTeamLogo: any;

  public awayTeamLogo: any;

  public get liveGame(): boolean {
    if (this.game) {
      return this.game.status.abstractGameState === "Live"
    }
    return false;
  }

  public get completedGame(): boolean {
    if (this.game) {
      return this.game.status.abstractGameState === "Final"
    }
    return false;
  }

  public get futureGame(): boolean {
    if (this.game) {
      return this.game.status.abstractGameState === "Preview"
    }
    return false;
  }

  public get homeTeamName(): string {
    if (this.game) {
      return this.game.teams.home.team.name
    }
    return "N/A"
  }

  public get awayTeamName(): string {
    if (this.game) {
      return this.game.teams.away.team.name
    }
    return "N/A"
  }

  public get gameTime(): string {
    if (this.game) {
      return dayjs(this.game.gameDate).format("h:mm");
    }
    return "N/A"
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
      } else {
        return "Final";
      }
    }
    return "N/A"
  }

  public get liveGameStatus(): string {
    if (this.game) {
      if (this.game.linescore.hasShootout) {
        return "SO";
      } else if (this.game.linescore.currentPeriodTimeRemaining === "END") {
        return "End " + this.game.linescore.currentPeriodOrdinal;
      } else {
        return this.game.linescore.currentPeriodOrdinal + " - " + this.formatTimeRemaining();
      }
    }
    return "N/A"
  }

  constructor(private nhlLogoService: NhlLogoService) {
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['game'] && !this.isHomeLogoLoaded && !this.isAwayLogoLoaded) {
      this.isHomeLogoLoading = true;
      this.isAwayLogoLoading = true;
      this.nhlLogoService.getNhlTeamLogo(this.game.teams.home.team.id).then(data => {
        let reader = new FileReader();
        reader.addEventListener("load", () => {
          this.homeTeamLogo = reader.result;
          this.isHomeLogoLoaded = true;
        }, false);
        reader.readAsDataURL(data);
        this.isHomeLogoLoading = false;
      });
      this.nhlLogoService.getNhlTeamLogo(this.game.teams.away.team.id).then(data => {
        let reader = new FileReader();
        reader.addEventListener("load", () => {
          this.awayTeamLogo = reader.result;
          this.isAwayLogoLoaded = true;
        }, false);
        reader.readAsDataURL(data);
        this.isAwayLogoLoading = false;
      });
    }
  }

  private formatTimeRemaining(): string {
    if (this.game.linescore.currentPeriodTimeRemaining.startsWith("0")) {
      return this.game.linescore.currentPeriodTimeRemaining.substring(1);
    } else {
      return this.game.linescore.currentPeriodTimeRemaining;
    }
  }
}
