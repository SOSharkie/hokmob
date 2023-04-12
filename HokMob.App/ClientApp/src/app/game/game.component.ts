import {Component, OnChanges, OnDestroy, OnInit, SimpleChanges} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlBoxscoreModel} from "@shared/models/nhl-boxscore/nhl-boxscore.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import * as dayjs from "dayjs";
import {NhlLogoService} from "@shared/services/nhl-logo.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {NhlLinescoreModel} from "@shared/models/nhl-linescore/nhl-linescore.model";

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit, OnDestroy {

  public gameLiveData: NhlLiveFeedModel;

  public gameBoxscore: NhlBoxscoreModel;

  public gameLinescore: NhlLinescoreModel;

  public isHomeLogoLoading: boolean;

  public isAwayLogoLoading: boolean;

  public homeTeamLogo: any;

  public awayTeamLogo: any;

  public gameId: string;

  /**
   * The ID of the timer which runs a function to GET the latest NHL games.
   */
  private nhlGameUpdateTimerId: number;

  /**
   * The refresh time to get updates on NHL games, set to 10 seconds.
   */
  private readonly nhlGameRefreshTime = 10000;

  public get liveGame(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.status.abstractGameState === "Live"
    }
    return false;
  }

  public get completedGame(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.status.abstractGameState === "Final"
    }
    return false;
  }

  public get futureGame(): boolean {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.status.abstractGameState === "Preview"
    }
    return false;
  }

  public get homeTeamName(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.home.name
    }
    return "N/A"
  }

  public get awayTeamName(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.teams.away.name
    }
    return "N/A"
  }

  public get gameTime(): string {
    if (this.gameLiveData) {
      return dayjs(this.gameLiveData.gameData.datetime.dateTime).format("h:mm A");
    }
    return "N/A"
  }

  public get gameDay(): string {
    if (this.gameLiveData) {
      return DateTimeUtils.getDayDisplayValue(dayjs(this.gameLiveData.gameData.datetime.dateTime).toDate());
    }
    return "N/A"
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
        return "SO";
      } else if (this.gameLinescore.currentPeriod === 4 && !this.gameLinescore.hasShootout) {
        return "OT";
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

  public get haveGoalsBeenSCored(): boolean {
    if (this.gameBoxscore) {
      return this.gameBoxscore.teams.home.teamStats.teamSkaterStats.goals > 0 ||
          this.gameBoxscore.teams.away.teamStats.teamSkaterStats.goals > 0;
    }
    return false;
  }

  public get gameDateTime(): string {
    if (this.gameLiveData) {
      return dayjs(this.gameLiveData.gameData.datetime.dateTime).format("MMMM D, YYYY, h:mm A");
    }
    return "N/A";
  }

  public get gameVenue(): string {
    if (this.gameLiveData) {
      return this.gameLiveData.gameData.venue.name;
    }
    return "N/A";
  }

  public get gameStreamLink(): string {
    if (this.gameLiveData) {
      let homeTeamLink = this.gameLiveData.gameData.teams.home.name.toLowerCase().replace(' ', '-');
      return "http://hdtv.720pstream.me/live-" + homeTeamLink + "-stream";
    }
    return "N/A";
  }

  constructor(private route: ActivatedRoute,
              private nhlLogoService: NhlLogoService,
              private nhlGameService: NhlGameService) {
  }

  public ngOnInit(): void {
    this.route.params.subscribe((params: Params) => {
      this.gameId = params['id'];
      this.nhlGameService.getNhlGameLiveFeed(this.gameId).then(gameLiveData => {
        console.log(gameLiveData);
        this.gameLiveData = gameLiveData;
        this.gameBoxscore = gameLiveData.liveData.boxscore;
        this.gameLinescore = gameLiveData.liveData.linescore;
        this.loadLogos();
        if (!this.completedGame && this.gameDay === "Today") {
          this.startContinuousNhlGameUpdates();
        }
      })
    });
  }

  public ngOnDestroy() {
    this.stopContinuousNhlGameUpdates();
  }

  /**
   * Starts continuous timer updating of current day nhl games every 10 seconds. Should always call retrieveNhlGames once
   * before starting this timer.
   */
  private startContinuousNhlGameUpdates(): void {
    this.nhlGameUpdateTimerId = setInterval(() => {
      this.nhlGameService.getNhlGameLiveFeed(this.gameId).then(gameLiveData => {
        if (gameLiveData) {
          this.gameLiveData = gameLiveData;
          this.gameBoxscore = gameLiveData.liveData.boxscore;
          this.gameLinescore = gameLiveData.liveData.linescore;
        } else {
          console.log("Problem updating NHL game with ID", this.gameId);
        }
      });
    }, this.nhlGameRefreshTime);
  }

  private stopContinuousNhlGameUpdates(): void {
    if (this.nhlGameUpdateTimerId) {
      clearInterval(this.nhlGameUpdateTimerId);
      this.nhlGameUpdateTimerId = null;
    }
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
    if (this.gameLinescore.currentPeriodTimeRemaining.startsWith("0")) {
      return this.gameLinescore.currentPeriodTimeRemaining.substring(1);
    } else {
      return this.gameLinescore.currentPeriodTimeRemaining;
    }
  }

}
