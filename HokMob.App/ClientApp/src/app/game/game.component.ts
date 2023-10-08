import {AfterViewInit, Component, HostListener, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute, Params, Router} from "@angular/router";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlBoxscoreModel} from "@shared/models/nhl-boxscore/nhl-boxscore.model";
import * as dayjs from "dayjs";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {NhlLinescoreModel} from "@shared/models/nhl-linescore/nhl-linescore.model";
import {GoalModel} from "@shared/models/goal.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {MatDialog} from "@angular/material/dialog";
import {PlayerGameDialogComponent} from "@app/game/player-game-dialog/player-game-dialog.component";
import {GamePlayerModel} from "@shared/models/game-player.model";
import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlBoxscorePlayerStatsModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player-stats.model";
import {NhlBoxscorePlayerModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player.model";
import {StatsUtils} from "@shared/utils/stats-utils";

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {

  public gameLiveData: NhlLiveFeedModel;

  public gameBoxscore: NhlBoxscoreModel;

  public gameLinescore: NhlLinescoreModel;

  public gameModel: NhlGameModel;

  public homeTeamGames: NhlScheduleModel;

  public awayTeamGames: NhlScheduleModel;

  public homeTeamGoals: GoalModel[] = [];

  public awayTeamGoals: GoalModel[] = [];

  public homePlayerStats: NhlBoxscorePlayerModel[] = [];

  public awayPlayerStats: NhlBoxscorePlayerModel[] = [];

  public homeTeamLogo: any;

  public awayTeamLogo: any;

  public gameId: string;

  public stickyHeader: HTMLElement;

  public isIntermission: boolean = false

  private intermissionTimeRemainingMs: number;

  private periodEndEvent: NhlLiveFeedPlayModel;

  private nhlGameUpdateTimerId: number;

  private intermissionTimerId: number;

  private nextPeriod: string;

  private readonly nhlGameRefreshTime = 10000;

  public get gameInfoLabel(): string {
    if (this.gameLiveData && this.gameModel) {
      return NhlGameInfoUtils.getNhlGameDescription(this.gameLiveData.gameData.game.type, Number(this.gameId.charAt(7)),
          this.gameLiveData.gameData.teams.home.conference.name, this.gameModel.seriesSummary,
          this.gameLinescore.teams.home.team.triCode + " vs " + this.gameLinescore.teams.away.team.triCode);
    }
    return "";
  }

  public get tvInfo(): string {
    if (this.gameModel && this.gameModel.broadcasts && this.gameModel.broadcasts[0]) {
      return "TV: " + this.gameModel.broadcasts[0].name;
    }
    return "";
  }

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

  public get gameDay(): string {
    if (this.gameLiveData) {
      return DateTimeUtils.getDayDisplayValue(dayjs(this.gameLiveData.gameData.datetime.dateTime).toDate());
    }
    return "N/A";
  }

  public get haveGoalsBeenScored(): boolean {
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
      return "https://720pstream.nu/nhl/live-" + homeTeamLink + "-stream";
    }
    return "N/A";
  }

  public get backButtonLabel(): string {
    if (this.previousUrl) {
      if (this.previousUrl.includes("playoffs")) {
        return "Playoffs";
      } else if (this.previousUrl.includes("player")) {
        return "Player";
      }
    }
    return "Games";
  }

  public get intermissionTimeRemaining(): string {
    if (this.intermissionTimeRemainingMs) {
      let pad = (n, z = 2) => ('00' + n).slice(-z);
      return ((this.intermissionTimeRemainingMs%3.6e6)/6e4 | 0) + ':' + pad((this.intermissionTimeRemainingMs%6e4)/1000 | 0)
          + " till " + this.nextPeriod;
    }
    return "";
  }

  public get showTopPlayers(): boolean {
    return this.completedGame || (this.liveGame && this.gameLiveData.liveData.linescore.currentPeriod > 1);
  }

  private previousUrl: string;

  constructor(public seriesDialog: MatDialog,
              private route: ActivatedRoute,
              private router: Router,
              private routerExtensionService: RouterExtensionService,
              private nhlLogoService: NhlImageService,
              private nhlGameService: NhlGameService) {
  }

  public ngOnInit(): void {
    this.previousUrl = this.routerExtensionService.getPreviousUrl();
    this.route.params.subscribe((params: Params) => {
      this.gameId = params['id'];
      this.nhlGameService.getNhlGameLiveFeed(this.gameId).then(gameLiveData => {
        this.gameLiveData = gameLiveData;
        this.gameBoxscore = gameLiveData.liveData.boxscore;
        this.gameLinescore = gameLiveData.liveData.linescore;
        this.calculateGoals();
        this.calculatePlayerStats();
        this.loadLogos();
        if (!this.completedGame && this.gameDay === "Today") {
          this.startContinuousNhlGameUpdates();
          this.calculateIntermission();
        }
      });
      this.nhlGameService.getNhlGame(this.gameId).then(gameModel => {
        this.gameModel = gameModel;
        let yesterday = dayjs().subtract(1, 'day');
        let thirtyDaysAgo = yesterday.subtract(30, 'days');
        this.nhlGameService.getTeamGames(thirtyDaysAgo.toDate(), yesterday.toDate(), this.gameModel.teams.home.team.id).then(homeTeamGames => {
          this.homeTeamGames = homeTeamGames;
        });
        this.nhlGameService.getTeamGames(thirtyDaysAgo.toDate(), yesterday.toDate(), this.gameModel.teams.away.team.id).then(awayTeamGames => {
          this.awayTeamGames = awayTeamGames;
        });
      });
    });
  }

  public ngAfterViewInit(): void {
    this.stickyHeader = document.getElementById("dropdownHeader");
  }

  public ngOnDestroy(): void {
    this.stopContinuousNhlGameUpdates();
    this.stopNhlIntermissionTimer();
  }

  public backToPrevious(): void {
    if (this.previousUrl) {
      this.router.navigateByUrl(this.previousUrl);
    } else {
      let dateString = dayjs(this.gameLiveData.gameData.datetime.dateTime).format("YYYYMMDD");
      const dateParam = {date: dateString};
      this.router.navigate([''],
          {
            relativeTo: this.route,
            queryParams: dateParam
          }
      );
    }
  }

  public openPlayerGameDialog(playerId: number): void {
    let isHomePlayer = this.homePlayerStats.findIndex(player => player.person.id === playerId) > -1;
    let data = new GamePlayerModel();
    if (isHomePlayer) {
      data.playerInfo = this.homePlayerStats.find(player => player.person.id === playerId);
      data.playerTeam = this.gameLiveData.gameData.teams.home;
    } else {
      data.playerInfo = this.awayPlayerStats.find(player => player.person.id === playerId);
      data.playerTeam = this.gameLiveData.gameData.teams.away;
    }

    this.seriesDialog.open(PlayerGameDialogComponent, {
      maxWidth: "85vw",
      backdropClass: "dialog-backdrop",
      data: data
    });
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
          this.calculateGoals();
          this.calculateIntermission();
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

  /**
   * Starts an intermission countdown timer if the current play or the previous play are of type 'PERIOD_END'.
   * Stops the existing intermission time if the current play is of type 'PERIOD_START' or 'GAME_END'.
   * 1st and 2nd intermissions are about 18.5 minutes long. Intermissions between playoff overtimes are about 15.5
   * minutes long. Intermission before regular season overtime is about 3 minutes long.
   */
  private calculateIntermission() {
    let allPlays = this.gameLiveData.liveData.plays.allPlays;
    if (this.gameLiveData.liveData.plays.allPlays.length < 3) {
      return;
    }
    if (this.gameLiveData.liveData.plays.currentPlay.result.eventTypeId === "PERIOD_END") {
      this.periodEndEvent = this.gameLiveData.liveData.plays.currentPlay;
      this.isIntermission = true;
    } else if (allPlays[allPlays.length - 2].result.eventTypeId === "PERIOD_END") {
      this.periodEndEvent = allPlays[allPlays.length - 2];
      this.isIntermission = true;
    }
      if (this.gameLiveData.liveData.plays.currentPlay.result.eventTypeId === "PERIOD_START" ||
        this.gameLiveData.liveData.plays.currentPlay.result.eventTypeId === "GAME_END") {
      this.periodEndEvent = null;
      this.isIntermission = false;
      this.stopNhlIntermissionTimer();
    }
    if (this.isIntermission && !this.intermissionTimerId) {
      switch (this.gameLinescore.currentPeriod) {
        case 1:
          this.nextPeriod = "2nd";
          break;
        case 2:
          this.nextPeriod = "3rd";
          break;
        case 3:
          this.nextPeriod = "OT";
          break;
        default:
          this.nextPeriod = (this.gameLinescore.currentPeriod - 3) + "OT";
          break;
      }
      let intermissionTimeMs = 18.5 * 60 * 1000;
      if (this.nextPeriod === "OT" && this.gameModel.gameType !== "P") {
        intermissionTimeMs =  3 * 60 * 1000;
      } else if (this.nextPeriod.includes("OT") && this.gameModel.gameType === "P") {
        intermissionTimeMs =  15.5 * 60 * 1000;
      }
      this.intermissionTimerId = setInterval(() => {
        this.calculateIntermissionTimer(intermissionTimeMs);
      }, 1000);
    }
  }

  private stopNhlIntermissionTimer(): void {
    if (this.intermissionTimerId) {
      clearInterval(this.intermissionTimerId);
      this.intermissionTimerId = null;
    }
  }

  private calculateIntermissionTimer(intermissionTimeMs: number): void {
    if (this.isIntermission) {
      let periodEndTime = dayjs(this.periodEndEvent.about.dateTime);
      let currentTime = dayjs();
      let elapsedTimeMs = currentTime.diff(periodEndTime, 'ms');
      this.intermissionTimeRemainingMs = Math.max(intermissionTimeMs - elapsedTimeMs, 0);
    }
  }

  private calculateGoals(): void {
    let allPlays = this.gameLiveData.liveData.plays.allPlays;
    this.homeTeamGoals = [];
    this.awayTeamGoals = [];
    this.gameLiveData.liveData.plays.scoringPlays.forEach(scoringPlayIndex => {
      let goal = new GoalModel();
      goal.period = allPlays[scoringPlayIndex].about.period;
      goal.periodTime = allPlays[scoringPlayIndex].about.periodTime;
      goal.periodTimeRemaining = allPlays[scoringPlayIndex].about.periodTimeRemaining

      // Assumes scorer will always be 1st player in goal scoring event player list
      goal.scorerFullName = allPlays[scoringPlayIndex].players[0].player.fullName;
      goal.scorerLastName = goal.scorerFullName.substring(goal.scorerFullName.indexOf(' '));
      goal.scorerId = allPlays[scoringPlayIndex].players[0].player.id;
      if (allPlays[scoringPlayIndex].team.id === this.gameBoxscore.teams.home.team.id) {
        this.homeTeamGoals.push(goal);
      } else {
        this.awayTeamGoals.push(goal);
      }
    });
  }

  private calculatePlayerStats(): void {
    const homeTeam = this.gameLiveData.liveData.boxscore.teams.home;
    const awayTeam = this.gameLiveData.liveData.boxscore.teams.away;
    let homePlayerStats: NhlBoxscorePlayerModel[] = [];
    let awayPlayerStats: NhlBoxscorePlayerModel[] = [];
    let homePlayers = homeTeam.skaters.filter(player => !homeTeam.scratches.includes(player)).map(id => "ID" + id);
    let awayPlayers = awayTeam.skaters.filter(player => !awayTeam.scratches.includes(player)).map(id => "ID" + id);
    homePlayers.forEach((playerId: string) => {
      homePlayerStats.unshift(homeTeam.players[playerId]);
      homePlayerStats[0].stats.skaterStats.hokmobRating = StatsUtils.calculateSkaterHokmobRating(homePlayerStats[0].stats.skaterStats);
    });
    awayPlayers.forEach((playerId: string) => {
      awayPlayerStats.unshift(awayTeam.players[playerId]);
      awayPlayerStats[0].stats.skaterStats.hokmobRating = StatsUtils.calculateSkaterHokmobRating(awayPlayerStats[0].stats.skaterStats);
    });
    this.homePlayerStats = homePlayerStats.sort((a, b) => b.stats.skaterStats.hokmobRating - a.stats.skaterStats.hokmobRating);
    this.awayPlayerStats = awayPlayerStats.sort((a, b) => b.stats.skaterStats.hokmobRating - a.stats.skaterStats.hokmobRating);
  }

  private loadLogos(): void {
    this.homeTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.gameBoxscore.teams.home.team.id);
    this.awayTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.gameBoxscore.teams.away.team.id);
  }

  @HostListener('document:scroll')
  private onScroll(): void {
    if (window.scrollY > 265) {
      this.stickyHeader.classList.add("header-show");
    } else {
      this.stickyHeader.classList.remove("header-show");
    }
  }

}
