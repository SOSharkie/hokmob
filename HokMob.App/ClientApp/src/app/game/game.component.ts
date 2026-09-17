import {AfterViewInit, Component, HostListener, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {NhlGameService} from "@shared/services/nhl-game.service";
import * as dayjs from "dayjs";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {MatDialog} from "@angular/material/dialog";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {PeriodUtils} from "@shared/utils/period-utils";
import {GameBundle} from "@shared/models/nhl-web-api/game-bundle.model";
import {GameLanding, GameLandingScoringPeriod} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {PlayByPlay} from "@shared/models/nhl-web-api/play-by-play.model";
import {Boxscore} from "@shared/models/nhl-web-api/boxscore.model";
import {RightRail} from "@shared/models/nhl-web-api/right-rail.model";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {
  PlayerGameDialogComponent,
  PlayerGameDialogData
} from "@app/game/player-game-dialog/player-game-dialog.component";
import {ClubScheduleGame} from "@shared/models/nhl-web-api/club-schedule.model";
import {HighlightVideo, NhlVideoUtils} from "@shared/utils/nhl-video-utils";
import {
  HighlightsDialogComponent,
  HighlightsDialogData
} from "@app/game/highlights-dialog/highlights-dialog.component";
import {PlayerHighlight} from "@shared/models/player-highlight.model";

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {

  public landing: GameLanding;

  public playByPlay: PlayByPlay;

  public boxscore: Boxscore;

  public rightRail: RightRail;

  /**
   * The playoff series status from score/{gameDate}. Only loaded for playoff games.
   */
  public seriesStatus: SeriesStatus;

  /**
   * The NHL.com path of the game's recap video (or its condensed game) from score/{gameDate}. Only loaded for finished
   * games, and missing until NHL.com posts the video.
   */
  public highlightsPath: string;

  /**
   * The game's recap and condensed game that can play in the highlights dialog, from the same score/{gameDate} paths.
   */
  public highlightVideos: HighlightVideo[] = [];

  /**
   * The home team's players with their ratings, best first. Empty without a boxscore or player stats.
   */
  public homePlayers: GamePlayer[] = [];

  public awayPlayers: GamePlayer[] = [];

  /**
   * The player hovered in the goal scorers or an event timeline, highlighted in the top players.
   */
  public highlightedPlayer: PlayerHighlight = null;

  public homeTeamLogo: any;

  public awayTeamLogo: any;

  public gameId: string;

  public stickyHeader: HTMLElement;

  public isIntermission: boolean = false

  /**
   * Set when the game landing can't be loaded.
   */
  public loadFailed: boolean = false;

  public leagueRouterLink: string = "/standings";

  /**
   * The home team's last finished games before this game, most recent first. Only loaded for games that aren't over.
   */
  public homeTeamFormGames: ClubScheduleGame[] = [];

  public awayTeamFormGames: ClubScheduleGame[] = [];

  private intermissionSecondsRemaining: number;

  private nhlGameUpdateTimerId: number;

  private intermissionTimerId: number;

  private nextPeriod: string;

  private readonly nhlGameRefreshTime = 10000;

  private readonly nhlSiteUrl = "https://www.nhl.com";

  public get gameInfoLabel(): string {
    if (this.landing) {
      return NhlGameInfoUtils.getGameDescription(this.landing.gameType, this.seriesStatus);
    }
    return "";
  }

  /**
   * The first TV network broadcasting the game, like "NHLN", or empty if there is none.
   */
  public get tvInfo(): string {
    return this.landing?.tvBroadcasts?.[0]?.network ?? "";
  }

  public get liveGame(): boolean {
    return NhlGameInfoUtils.isLiveGame(this.landing?.gameState);
  }

  public get completedGame(): boolean {
    return NhlGameInfoUtils.isCompletedGame(this.landing?.gameState);
  }

  public get futureGame(): boolean {
    return NhlGameInfoUtils.isFutureGame(this.landing?.gameState);
  }

  public get gameDay(): string {
    if (this.landing) {
      return DateTimeUtils.getDayDisplayValue(dayjs(this.landing.startTimeUTC).toDate());
    }
    return "N/A";
  }

  public get scoringPeriods(): GameLandingScoringPeriod[] {
    return this.landing?.summary?.scoring ?? [];
  }

  /**
   * Whether any goal outside a shootout has been scored.
   */
  public get haveGoalsBeenScored(): boolean {
    return this.scoringPeriods.some(period =>
        period.periodDescriptor?.periodType !== NhlPeriodTypeEnum.SHOOTOUT && period.goals?.length > 0);
  }

  public get gameDateTime(): string {
    if (this.landing) {
      return dayjs(this.landing.startTimeUTC).format("MMMM D, YYYY, h:mm A");
    }
    return "N/A";
  }

  public get gameVenue(): string {
    return this.landing?.venue?.default ?? "N/A";
  }

  /**
   * Whether the watch button opens the highlights dialog: a finished game with a posted video.
   */
  public get showHighlightsDialog(): boolean {
    return this.completedGame && this.highlightVideos.length > 0;
  }

  /**
   * The watch link, when the highlights can't play in the dialog: the recap video for a finished game once it's
   * posted, else the NHL.com game center, which lists where to watch a game. The API has no stream links.
   */
  public get watchLink(): string {
    if (this.completedGame && this.highlightsPath) {
      return this.nhlSiteUrl + this.highlightsPath;
    }
    return this.landing ? this.nhlSiteUrl + "/gamecenter/" + this.landing.id : "";
  }

  public get watchLabel(): string {
    if (this.completedGame) {
      return this.highlightsPath ? "Highlights" : "NHL.com Game Center";
    }
    return "Where to Watch";
  }

  public get watchIcon(): string {
    return this.completedGame && this.highlightsPath ? "smart_display" : "tv";
  }

  public get backButtonLabel(): string {
    return RouterExtensionService.getBackLabel(this.routerExtensionService.getPreviousUrl(), "Games");
  }

  /**
   * The intermission countdown, like "16:40 till 2nd", or empty outside an intermission.
   */
  public get intermissionTimeRemaining(): string {
    if (this.isIntermission && this.intermissionSecondsRemaining > 0) {
      let minutes = Math.floor(this.intermissionSecondsRemaining / 60);
      let seconds = this.intermissionSecondsRemaining % 60;
      return minutes + ":" + String(seconds).padStart(2, "0") + " till " + this.nextPeriod;
    }
    return "";
  }

  // TODO: Verify during a live game that the boxscore has playerByGameStats and the right-rail has teamGameStats, or top
  //  players and game stats stay hidden until the game ends (see docs/nhl-api-migration-plan.md, section 10).
  public get showTopPlayers(): boolean {
    return this.homePlayers.length > 0 && this.awayPlayers.length > 0 &&
        (this.completedGame || (this.liveGame && this.playByPlay?.plays?.length > 10));
  }

  public get homeCoach(): string {
    return this.rightRail?.gameInfo?.homeTeam?.headCoach?.default;
  }

  public get awayCoach(): string {
    return this.rightRail?.gameInfo?.awayTeam?.headCoach?.default;
  }

  public get showGameStats(): boolean {
    return !this.futureGame && this.rightRail?.teamGameStats?.length > 0;
  }

  public get showTeamForm(): boolean {
    return !this.completedGame && (this.homeTeamFormGames.length > 0 || this.awayTeamFormGames.length > 0);
  }

  constructor(public seriesDialog: MatDialog,
              private route: ActivatedRoute,
              private routerExtensionService: RouterExtensionService,
              private nhlGameService: NhlGameService) {
  }

  public ngOnInit(): void {
    this.route.params.subscribe((params: Params) => {
      this.gameId = params['id'];
      this.loadGame();
    });
  }

  public ngAfterViewInit(): void {
    this.stickyHeader = document.getElementById("dropdownHeader");
  }

  public ngOnDestroy(): void {
    this.stopContinuousNhlGameUpdates();
    this.stopNhlIntermissionTimer();
  }

  /**
   * Goes back to the previous page, or without one (the game was opened directly) to the games of the game day.
   */
  public backToPrevious(): void {
    const gameDay = this.landing ? dayjs(this.landing.startTimeUTC).format("YYYYMMDD") : undefined;
    const isToday = !gameDay || gameDay === dayjs().format("YYYYMMDD");
    this.routerExtensionService.back(isToday ? "/" : "/?date=" + gameDay);
  }

  /**
   * Plays the game's highlights in a dialog, starting with the recap.
   */
  public openHighlightsDialog(): void {
    if (!this.showHighlightsDialog) {
      return;
    }
    const data: HighlightsDialogData = {
      videos: this.highlightVideos,
      subtitle: (this.landing.awayTeam?.abbrev ?? "") + " at " + (this.landing.homeTeam?.abbrev ?? "")
    };
    this.seriesDialog.open(HighlightsDialogComponent, {
      width: "960px",
      maxWidth: "94vw",
      backdropClass: "dialog-backdrop",
      panelClass: "highlights-dialog-panel",
      autoFocus: false,
      data
    });
  }

  /**
   * Highlights the hovered player in the top players, or clears the highlight when given null. Only on devices that
   * can hover: a tap on a touch screen also fires mouseenter, which would leave the player highlighted.
   */
  public highlightPlayer(highlight: PlayerHighlight): void {
    if (highlight && !window.matchMedia?.("(hover: hover)").matches) {
      return;
    }
    this.highlightedPlayer = highlight ?? null;
  }

  /**
   * Opens the player's game stats. Does nothing for a player without boxscore stats (or without a boxscore).
   */
  public openPlayerGameDialog(playerId: number): void {
    const player = [...this.homePlayers, ...this.awayPlayers].find(item => item.playerId === playerId);
    if (!player) {
      return;
    }
    const data: PlayerGameDialogData = {player};
    this.seriesDialog.open(PlayerGameDialogComponent, {
      maxWidth: "85vw",
      backdropClass: "dialog-backdrop",
      data
    });
  }

  /**
   * Loads the game, and the series status for playoff games. Starts the 10s refresh for games that aren't over and
   * are live or scheduled today. Shows an error state when the landing can't be loaded.
   */
  private loadGame(): void {
    this.stopContinuousNhlGameUpdates();
    this.stopNhlIntermissionTimer();
    this.clearGame();
    const gameId = this.gameId;
    this.nhlGameService.getGameBundle(gameId).then(bundle => {
      if (gameId !== this.gameId) {
        return;
      }
      this.applyGameBundle(bundle);
      this.leagueRouterLink = this.landing.gameType === NhlGameTypeEnum.PLAYOFFS ? "/playoffs" : "/standings";
      this.homeTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.landing.homeTeam.id);
      this.awayTeamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.landing.awayTeam.id);
      this.loadScoreGame();
      this.loadTeamForm();
      if (!this.completedGame && (this.liveGame || this.gameDay === "Today")) {
        this.startContinuousNhlGameUpdates();
      }
    }).catch(() => {
      if (gameId === this.gameId) {
        this.loadFailed = true;
      }
    });
  }

  private clearGame(): void {
    this.landing = undefined;
    this.playByPlay = undefined;
    this.boxscore = undefined;
    this.rightRail = undefined;
    this.seriesStatus = undefined;
    this.highlightsPath = undefined;
    this.highlightVideos = [];
    this.homePlayers = [];
    this.awayPlayers = [];
    this.highlightedPlayer = null;
    this.homeTeamFormGames = [];
    this.awayTeamFormGames = [];
    this.homeTeamLogo = undefined;
    this.awayTeamLogo = undefined;
    this.isIntermission = false;
    this.loadFailed = false;
    this.leagueRouterLink = "/standings";
  }

  /**
   * Shows new game data. When an optional response is missing (its request failed), the last one is kept.
   */
  private applyGameBundle(bundle: GameBundle): void {
    this.landing = bundle.landing;
    this.playByPlay = bundle.playByPlay ?? this.playByPlay;
    this.boxscore = bundle.boxscore ?? this.boxscore;
    this.rightRail = bundle.rightRail ?? this.rightRail;
    const rosterSpots = PlayByPlayUtils.getRosterSpotMap(this.playByPlay);
    const faceoffCounts = this.playByPlay ? PlayByPlayUtils.getFaceoffCounts(this.playByPlay) : undefined;
    this.homePlayers = StatsUtils.getGamePlayers(this.boxscore, true, rosterSpots, faceoffCounts);
    this.awayPlayers = StatsUtils.getGamePlayers(this.boxscore, false, rosterSpots, faceoffCounts);
    this.updateIntermission();
  }

  /**
   * Loads the game from score/{gameDate} for the series status of a playoff game and the highlights of a finished game.
   * If it fails, the league label falls back to "NHL Playoffs" and the watch link to the NHL.com game center.
   */
  private loadScoreGame(): void {
    if (this.landing.gameType !== NhlGameTypeEnum.PLAYOFFS && !this.completedGame) {
      return;
    }
    const gameId = this.gameId;
    this.nhlGameService.getScoreGame(this.landing.id, this.landing.gameDate).then(scoreGame => {
      if (gameId === this.gameId) {
        this.seriesStatus = scoreGame?.seriesStatus;
        this.highlightsPath = scoreGame?.threeMinRecap ?? scoreGame?.condensedGame;
        this.highlightVideos = NhlVideoUtils.getHighlightVideos(scoreGame);
      }
    }).catch(() => {
      // Already logged by the service
    });
  }

  /**
   * Loads each team's last 5 games before this game for the team form, unless the game is over. It's loaded once, not
   * on refresh. A team whose games can't be loaded gets none, and the section is hidden when neither team has games.
   */
  private loadTeamForm(): void {
    if (this.completedGame) {
      return;
    }
    const gameId = this.gameId;
    const teamFormGames = (teamAbbrev: string): Promise<ClubScheduleGame[]> =>
        this.nhlGameService.getTeamFormGames(teamAbbrev, this.landing).catch((): ClubScheduleGame[] => []);
    Promise.all([teamFormGames(this.landing.homeTeam.abbrev), teamFormGames(this.landing.awayTeam.abbrev)])
        .then(([homeGames, awayGames]) => {
          if (gameId === this.gameId) {
            this.homeTeamFormGames = homeGames;
            this.awayTeamFormGames = awayGames;
          }
        });
  }

  /**
   * Refreshes the game every 10 seconds. Stops once the game is over, after reloading the series status and
   * highlights. A failed refresh keeps the data already shown.
   */
  private startContinuousNhlGameUpdates(): void {
    this.nhlGameUpdateTimerId = setInterval(() => {
      const gameId = this.gameId;
      this.nhlGameService.getGameBundle(gameId).then(bundle => {
        if (gameId !== this.gameId || !this.nhlGameUpdateTimerId) {
          return;
        }
        this.applyGameBundle(bundle);
        if (this.completedGame) {
          this.stopContinuousNhlGameUpdates();
          this.loadScoreGame();
        }
      }).catch(() => {
        // Already logged by the service
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
   * Updates the intermission countdown from the landing clock, whose secondsRemaining is expected to count down the
   * intermission while clock.inIntermission is true. A 1s timer keeps the countdown moving between refreshes.
   *
   * TODO: Verify during a live game that secondsRemaining counts down the intermission (and isn't 0 or the next
   *  period's 20:00), and that periodDescriptor is still the period just ended (see docs/nhl-api-migration-plan.md,
   *  section 10).
   */
  private updateIntermission(): void {
    let clock = this.landing?.clock;
    this.isIntermission = this.liveGame && !!clock?.inIntermission;
    if (!this.isIntermission) {
      this.intermissionSecondsRemaining = undefined;
      this.stopNhlIntermissionTimer();
      return;
    }
    this.intermissionSecondsRemaining = clock.secondsRemaining;
    this.nextPeriod = PeriodUtils.getNextPeriodLabel(this.landing.periodDescriptor, this.landing.gameType);
    if (!this.intermissionTimerId) {
      this.intermissionTimerId = setInterval(() => {
        this.intermissionSecondsRemaining = Math.max((this.intermissionSecondsRemaining ?? 0) - 1, 0);
      }, 1000);
    }
  }

  private stopNhlIntermissionTimer(): void {
    if (this.intermissionTimerId) {
      clearInterval(this.intermissionTimerId);
      this.intermissionTimerId = null;
    }
  }

  @HostListener('document:scroll')
  private onScroll(): void {
    if (window.scrollY > 265) {
      this.stickyHeader?.classList.add("header-show");
    } else {
      this.stickyHeader?.classList.remove("header-show");
    }
  }

}
