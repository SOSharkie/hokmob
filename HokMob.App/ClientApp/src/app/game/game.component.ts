import {Component, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlBoxscoreModel} from "@shared/models/nhl-boxscore/nhl-boxscore.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import * as dayjs from "dayjs";
import {NhlLogoService} from "@shared/services/nhl-logo.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit {

  public gameBoxscore: NhlBoxscoreModel;

  public game: NhlGameModel;

  public isHomeLogoLoading: boolean;

  public isAwayLogoLoading: boolean;

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
      return dayjs(this.game.gameDate).format("h:mm A");
    }
    return "N/A"
  }

  public get gameDay(): string {
    if (this.game) {
      return DateTimeUtils.getDayDisplayValue(dayjs(this.game.gameDate).toDate());
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

  public get haveGoalsBeenSCored(): boolean {
    if (this.gameBoxscore) {
      return this.gameBoxscore.teams.home.teamStats.teamSkaterStats.goals > 0 ||
          this.gameBoxscore.teams.away.teamStats.teamSkaterStats.goals > 0;
    }
    return false;
  }

  public get gameDateTime(): string {
    if (this.game) {
      return dayjs(this.game.gameDate).format("MMMM D, YYYY, h:mm A");
    }
    return "N/A";
  }

  public get gameVenue(): string {
    if (this.game) {
      return this.game.venue.name;
    }
    return "N/A";
  }

  public get gameTVInfo(): string {
    if (this.game) {
      return "TV Info Here";
    }
    return "N/A";
  }

  constructor(private route: ActivatedRoute,
              private nhlLogoService: NhlLogoService,
              private nhlGameService: NhlGameService) {
  }

  public ngOnInit(): void {
    this.route.params.subscribe((params: Params) => {
      const gameId = params['id'];
      console.log("game id is", gameId);
      this.nhlGameService.getNhlGameBoxscore(gameId).then(boxscore => {
        this.gameBoxscore = boxscore;
        this.loadLogos();
        console.log("boxscore", boxscore);
      });
      this.nhlGameService.getNhlGame(Number(gameId)).then(gameModel => {
        this.game = gameModel;
        console.log("game model:", this.game);
      });
    });
  }

  private loadLogos(): void {
    this.isHomeLogoLoading = true;
    this.isAwayLogoLoading = true;
    this.nhlLogoService.getNhlTeamLogo(this.gameBoxscore.teams.home.team.id).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.homeTeamLogo = reader.result;
      }, false);
      reader.readAsDataURL(data);
      this.isHomeLogoLoading = false;
    });
    this.nhlLogoService.getNhlTeamLogo(this.gameBoxscore.teams.away.team.id).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.awayTeamLogo = reader.result;
      }, false);
      reader.readAsDataURL(data);
      this.isAwayLogoLoading = false;
    });
  }

  private formatTimeRemaining(): string {
    if (this.game.linescore.currentPeriodTimeRemaining.startsWith("0")) {
      return this.game.linescore.currentPeriodTimeRemaining.substring(1);
    } else {
      return this.game.linescore.currentPeriodTimeRemaining;
    }
  }

}
