import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Params, Router} from "@angular/router";
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
import * as dayjs from "dayjs";

/**
 * The team page. One club-schedule-season/{abbrev}/now response feeds the form, the schedule and the next game, the
 * standings give the division and conference, and the stats API gives the season stats card.
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

  public previousUrl: string;

  public teamLogo: string;

  public teamColor: string = "#000000";

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
    if (this.previousUrl) {
      if (this.previousUrl.includes("stats")) {
        return "Stats";
      } else if (this.previousUrl.includes("game")) {
        return "Game";
      }
    }
    return "Games";
  }

  public get teamName(): string {
    return this.team?.name;
  }

  constructor(private route: ActivatedRoute,
              private router: Router,
              private routerExtensionService: RouterExtensionService,
              private nhlGameService: NhlGameService,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService,
              private nhlStatsApiService: NhlStatsApiService) {}

  public ngOnInit(): void {
    this.previousUrl = this.routerExtensionService.getPreviousUrl();
    this.route.params.subscribe((params: Params) => {
      this.stopContinuousNextGameUpdates();
      this.teamId = Number(params['id']);
      const team = NhlTeamUtils.getTeam(this.teamId);
      this.team = team.id === this.teamId ? team : undefined;
      this.resetTeamData();
      if (!this.team) {
        return;
      }
      this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.teamId);
      this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.teamId);
      this.retrieveStandings();
      this.retrieveSchedule();
    });
  }

  public ngOnDestroy(): void {
    this.stopContinuousNextGameUpdates();
  }

  public backToPrevious(): void {
    if (this.previousUrl) {
      this.router.navigateByUrl(this.previousUrl);
    } else {
      let dateString = dayjs().format("YYYYMMDD");
      const dateParam = {date: dateString};
      this.router.navigate([''],
          {
            relativeTo: this.route,
            queryParams: dateParam
          }
      );
    }
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
        this.retrieveTeamStats(teamRow.seasonId);
      }
    }).catch(() => {
      // The service logs the error. The page keeps working without the standings, division and stats card
      this.standings = [];
    });
  }

  private retrieveTeamStats(season: number): void {
    this.nhlStatsApiService.getTeamStats(season).then(teamStats => {
      this.teamStats = teamStats;
    }).catch(() => {
      // The service logs the error. Without stats the card isn't shown
      this.teamStats = [];
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
    this.teamStats = [];
    this.formGames = [];
    this.scheduleGames = [];
    this.nextGame = undefined;
  }

  protected readonly NhlStandingsTypeEnum = NhlStandingsTypeEnum;
}
