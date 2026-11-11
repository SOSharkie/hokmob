import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, ParamMap, Params} from "@angular/router";
import {Location} from "@angular/common";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {StandingsGroup, StandingsTeam} from "@shared/models/nhl-web-api/standings.model";
import {ClubScheduleGame, ClubScheduleSeason} from "@shared/models/nhl-web-api/club-schedule.model";
import {ScoreGame} from "@shared/models/nhl-web-api/score.model";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {NhlTeamCustomModel} from "@shared/models/nhl-team.model";
import {StandingsTypeUtils} from "@shared/utils/standings-type-utils";
import {TeamStandingsComponent} from "@app/team/team-standings/team-standings.component";
import {TeamTab, TeamTabId, TeamTabs} from "@app/team/team-tabs";
import * as dayjs from "dayjs";

/**
 * The team page: a header with the team's tabs (TeamTabs), and the picked tab below it. One
 * club-schedule-season/{abbrev}/now response feeds the form, the schedule and the next game of the overview and games
 * tabs, the standings give the division, conference and season, and the stats API gives the season stats card. The
 * standings and player stats tabs load their own data when they're opened.
 *
 * The tab is the tab query parameter (/team/6?tab=player-stats), and the standings tab's type is standingsType, like
 * on the standings page. Picking a tab rewrites the URL without the router (see saveTabToUrl).
 */
@Component({
  selector: 'app-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss']
})
export class TeamComponent implements OnInit, OnDestroy {

  public teamId: number;

  /** The team from NhlTeamUtils, or undefined for a route with an unknown team ID. */
  public team: NhlTeamCustomModel;

  /** A little wider than it is tall, so every team's header is the same size. Phones shrink it, see the stylesheet. */
  public readonly logoSize: number = 85;

  public readonly logoMaxWidth: number = 111;

  public teamColor: string = "#000000";

  public readonly tabs: TeamTab[] = TeamTabs.tabs;

  @ViewChild("tabList")
  private tabList: ElementRef<HTMLElement>;

  public selectedTab: TeamTabId = TeamTabs.defaultTab;

  /** The standings tab's type, from the standingsType query parameter. */
  public standingsType: NhlStandingsTypeEnum = TeamStandingsComponent.defaultStandingsType;

  /** The season of the standings, which the stats cards and the player stats tab show. Undefined until they load. */
  public season: number;

  /** Whether the standings failed, so there's no season for the player stats tab. */
  public seasonFailed: boolean = false;

  /** Whether the team stats request is over, so the team stats tab can tell an empty season from a pending one. */
  public teamStatsLoaded: boolean = false;

  /** The team's division, from its standings row. Empty until the standings load. */
  public divisionName: string = "";

  /** The conference standings group the team is in. */
  public standings: StandingsGroup[];

  /** Every team's stats for the standings season, for the team stats card. */
  public teamStats: TeamSeasonStats[] = [];

  /** The team's last finished games, most recent first. */
  public formGames: ClubScheduleGame[] = [];

  /** The team's next games, soonest first. */
  public scheduleGames: ScoreGame[] = [];

  /** The first game that isn't over, with live details while it's on. */
  public nextGame: ScoreGame;

  private readonly scheduleGameCount = 5;

  /**
   * The ID of the timer refreshing a live next game, like the scoreboard's.
   */
  private nextGameUpdateTimerId: number;

  private readonly nextGameRefreshTime = 10000;

  public get backButtonLabel(): string {
    return RouterExtensionService.getBackLabel(this.routerExtensionService.getPreviousUrl(), "Games");
  }

  public get teamName(): string {
    return this.team?.name;
  }

  /** Whether the team stats have the team's row, which the team stats card needs. */
  public get hasTeamStats(): boolean {
    return this.teamStats.some(stats => stats.teamId === this.teamId);
  }

  constructor(private route: ActivatedRoute,
              private location: Location,
              private routerExtensionService: RouterExtensionService,
              private nhlGameService: NhlGameService,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService,
              private nhlStatsApiService: NhlStatsApiService) {}

  public ngOnInit(): void {
    this.route.params.subscribe((params: Params) => {
      this.stopContinuousNextGameUpdates();
      this.teamId = Number(params['id']);
      const team = NhlTeamUtils.getTeam(this.teamId);
      this.team = team.id === this.teamId ? team : undefined;
      this.resetTeamData();
      if (!this.team) {
        return;
      }
      this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.teamId);
      this.retrieveStandings();
      this.retrieveSchedule();
    });
    this.route.queryParamMap.subscribe((params: ParamMap) => {
      this.selectedTab = TeamTabs.fromQueryParam(params.get("tab"));
      this.standingsType = StandingsTypeUtils.fromQueryParam(params.get("standingsType"))
          ?? TeamStandingsComponent.defaultStandingsType;
      // After the tab bar renders: a link to the last tabs opens with the selected one off screen on a phone
      setTimeout(() => this.scrollSelectedTabIntoView());
    });
  }

  public ngOnDestroy(): void {
    this.stopContinuousNextGameUpdates();
  }

  /**
   * Shows a tab and saves it in the URL, so a reload or a shared link opens the same tab.
   */
  public selectTab(tab: TeamTabId): void {
    if (tab === this.selectedTab) {
      return;
    }
    this.selectedTab = tab;
    this.saveTabToUrl();
  }

  /**
   * Shows another standings type in the standings tab and saves it in the URL.
   */
  public selectStandingsType(type: NhlStandingsTypeEnum): void {
    this.standingsType = type;
    this.saveTabToUrl();
  }

  /**
   * Moves between the tabs with the arrow keys, Home and End, as a tab list does, and shows the tab moved to.
   *
   * @param event - The key press on a tab.
   * @param index - The index of the tab that has the focus.
   */
  public onTabKeydown(event: KeyboardEvent, index: number): void {
    const lastIndex = this.tabs.length - 1;
    const nextIndex: number = {
      ArrowRight: index === lastIndex ? 0 : index + 1,
      ArrowLeft: index === 0 ? lastIndex : index - 1,
      Home: 0,
      End: lastIndex
    }[event.key];
    if (nextIndex === undefined) {
      return;
    }
    event.preventDefault();
    this.selectTab(this.tabs[nextIndex].id);
    (this.tabList?.nativeElement.children[nextIndex] as HTMLElement)?.focus();
  }

  /**
   * Scrolls the tab bar sideways, and only it, so the selected tab is in view. The tabs only overflow on a phone.
   */
  private scrollSelectedTabIntoView(): void {
    const tabList = this.tabList?.nativeElement;
    const tab = tabList?.querySelector(".selected-tab") as HTMLElement;
    if (!tab) {
      return;
    }
    if (tab.offsetLeft < tabList.scrollLeft) {
      tabList.scrollLeft = tab.offsetLeft;
    } else if (tab.offsetLeft + tab.offsetWidth > tabList.scrollLeft + tabList.clientWidth) {
      tabList.scrollLeft = tab.offsetLeft + tab.offsetWidth - tabList.clientWidth;
    }
  }

  /**
   * Goes back to the previous page, or without one (the team was opened directly) to today's games.
   */
  public backToPrevious(): void {
    this.routerExtensionService.back("/");
  }

  /**
   * Writes the tab to the URL, leaving out the overview, and the standings type while the standings tab is open. It
   * doesn't go through the router, which would scroll to the top of the page and add a history entry per tab, so the
   * back button still leaves the team page. The history state is kept, because the back buttons and the scroll
   * restoration need the router's page ID in it (like the history page's filters).
   */
  private saveTabToUrl(): void {
    const [path, query] = this.location.path().split("?");
    const params = new URLSearchParams(query);
    const isStandingsTypeShown = this.selectedTab === "standings"
        && this.standingsType !== TeamStandingsComponent.defaultStandingsType;
    const values: {[name: string]: string} = {
      tab: this.selectedTab === TeamTabs.defaultTab ? null : this.selectedTab,
      standingsType: isStandingsTypeShown ? this.standingsType : null
    };
    Object.entries(values).forEach(([name, value]) => {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
    });
    this.location.replaceState(path, params.toString(), this.location.getState());
  }

  /**
   * Loads the standings, keeps the team's conference group, and reads the division and season from its row. The team
   * stats of that season follow, so the card matches the standings even between seasons.
   */
  private retrieveStandings(): void {
    this.nhlStandingAndPlayoffService.getNhlStandings(NhlStandingsTypeEnum.BY_CONFERENCE).then(standings => {
      const teamRow = this.findTeamRow(standings);
      this.divisionName = teamRow?.divisionName ?? "";
      this.standings = teamRow
          ? standings.filter(group => group.title === teamRow.conferenceName + " Conference")
          : [];
      if (teamRow?.seasonId) {
        this.season = teamRow.seasonId;
        this.retrieveTeamStats(teamRow.seasonId);
      } else {
        this.seasonFailed = true;
        this.teamStatsLoaded = true;
      }
    }).catch(() => {
      // The service logs the error. The page keeps working without the standings, division and stats
      this.standings = [];
      this.seasonFailed = true;
      this.teamStatsLoaded = true;
    });
  }

  private retrieveTeamStats(season: number): void {
    this.nhlStatsApiService.getTeamStats(season).then(teamStats => {
      this.teamStats = teamStats;
      this.teamStatsLoaded = true;
    }).catch(() => {
      // The service logs the error. Without stats the card isn't shown
      this.teamStats = [];
      this.teamStatsLoaded = true;
    });
  }

  /**
   * Loads the team's schedule for the current season, and from it the next games, the next game and the form.
   */
  private retrieveSchedule(): void {
    this.nhlGameService.getTeamSchedule(this.team.triCode).then(schedule => {
      this.scheduleGames = NhlGameInfoUtils.getUpcomingGames(schedule.games, this.scheduleGameCount)
          .map(game => NhlGameInfoUtils.toScoreGame(game));
      this.nextGame = this.scheduleGames[0];
      this.retrieveTeamForm(schedule);
      this.retrieveLiveNextGame();
    }).catch(() => {
      // The service logs the error. Show empty sections rather than another team's games
      this.scheduleGames = [];
      this.nextGame = undefined;
      this.formGames = [];
    });
  }

  /**
   * Loads the team's last finished games. They lead up to the next game, so preseason games count while the next game
   * is a preseason game. The schedule is passed in, so only a previous season fill-in makes another request.
   */
  private retrieveTeamForm(schedule: ClubScheduleSeason): void {
    const reference = {
      season: schedule.currentSeason,
      startTimeUTC: new Date().toISOString(),
      gameType: this.nextGame?.gameType
    };
    this.nhlGameService.getTeamFormGames(this.team.triCode, reference, schedule).then(games => {
      this.formGames = games;
    }).catch(() => {
      // The service logs the error. Show the empty state instead of another team's form
      this.formGames = [];
    });
  }

  /**
   * Adds the clock, period and series status to the next game from score/{gameDate}, which the club schedule doesn't
   * have. Only for a game today or one already going, and it keeps refreshing while the game is live.
   */
  private retrieveLiveNextGame(): void {
    if (!this.nextGame || !(this.isToday(this.nextGame) || NhlGameInfoUtils.isLiveGame(this.nextGame.gameState))) {
      return;
    }
    this.updateNextGame().then(() => {
      if (NhlGameInfoUtils.isLiveGame(this.nextGame?.gameState)) {
        this.startContinuousNextGameUpdates();
      }
    });
  }

  /**
   * Replaces the next game with the score response's game, which has the clock, period and series status.
   */
  private updateNextGame(): Promise<void> {
    const game = this.nextGame;
    return this.nhlGameService.getNhlGames(dayjs(game.startTimeUTC).toDate()).then(games => {
      const liveGame = games.find(item => item.id === game.id);
      if (liveGame && this.nextGame?.id === game.id) {
        this.nextGame = liveGame;
      }
    }).catch(() => {
      // The service logs the error. Keep the game from the schedule, without live details
    });
  }

  private startContinuousNextGameUpdates(): void {
    this.stopContinuousNextGameUpdates();
    this.nextGameUpdateTimerId = setInterval(() => {
      if (!this.nextGame || NhlGameInfoUtils.isCompletedGame(this.nextGame.gameState)) {
        this.stopContinuousNextGameUpdates();
        return;
      }
      this.updateNextGame();
    }, this.nextGameRefreshTime);
  }

  private stopContinuousNextGameUpdates(): void {
    if (this.nextGameUpdateTimerId) {
      clearInterval(this.nextGameUpdateTimerId);
      this.nextGameUpdateTimerId = null;
    }
  }

  /**
   * The team's standings row, found by abbreviation because standings rows have no team ID.
   */
  private findTeamRow(standings: StandingsGroup[]): StandingsTeam {
    return standings.flatMap(group => group.teams)
        .find(team => team.teamAbbrev?.default === this.team.triCode);
  }

  private isToday(game: ScoreGame): boolean {
    return dayjs().isSame(dayjs(game.startTimeUTC), 'day');
  }

  private resetTeamData(): void {
    this.divisionName = "";
    this.standings = undefined;
    this.season = undefined;
    this.seasonFailed = false;
    this.teamStats = [];
    this.teamStatsLoaded = false;
    this.formGames = [];
    this.scheduleGames = [];
    this.nextGame = undefined;
  }

  protected readonly NhlStandingsTypeEnum = NhlStandingsTypeEnum;
}
