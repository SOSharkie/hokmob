import {Component, OnInit} from '@angular/core';
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {NhlStatsSplitModel} from "@shared/models/nhl-stats/nhl-stats-split.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {ActivatedRoute, Params, Router} from "@angular/router";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import * as dayjs from "dayjs";
import {NhlTeamExtendedModel} from "@shared/models/nhl-general/nhl-team-extended.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {NhlStandingsModel} from "@shared/models/nhl-general/nhl-standings.model";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";

@Component({
  selector: 'app-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss']
})
export class TeamComponent implements OnInit {

  public teamId: string;

  public previousUrl: string;

  public teamLogo: any;

  public teamColor: string = "#000000";

  public teamData: NhlTeamExtendedModel;

  public pastTeamGames: NhlScheduleModel;

  public futureTeamGames: NhlScheduleModel;

  public standings: NhlStandingsModel[];

  public nextGame: NhlGameModel;

  public nextGameLiveFeed: NhlLiveFeedModel;

  private readonly nhlLeagueId: number = 133;

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

  constructor(private route: ActivatedRoute,
              private router: Router,
              private routerExtensionService: RouterExtensionService,
              private nhlGameService: NhlGameService,
              private nhlImageService: NhlImageService,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService,
              private nhlStatsService: NhlStatsService) {}

  public ngOnInit(): void {
    this.previousUrl = this.routerExtensionService.getPreviousUrl();
    this.route.params.subscribe((params: Params) => {
      this.teamId = params['id'];
      this.nhlStatsService.getNhlTeamStats(this.teamId, DateTimeUtils.getCurrentNhlSeason()).then(teamData => {
        this.teamData = teamData;
        this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.teamData.id);
        this.loadImages();
        this.nhlStandingAndPlayoffService.getNhlStandings(DateTimeUtils.getCurrentNhlSeason(), NhlStandingsTypeEnum.BY_CONFERENCE).then(standings => {
          if (this.teamData.conference.id === 5) {
            this.standings = [standings[1]];
          } else {
            this.standings = [standings[0]];
          }
        });
      });
      let thirtyDaysFuture = dayjs().add(30, 'day');
      let thirtyDaysAgo = dayjs().subtract(30, 'days');
      let yesterday = dayjs().subtract(1, 'day');
      this.nhlGameService.getTeamGames(thirtyDaysAgo.toDate(), yesterday.toDate(), Number(this.teamId)).then(past => {
        this.pastTeamGames = past;
      });
      this.nhlGameService.getTeamGames(new Date(), thirtyDaysFuture.toDate(), Number(this.teamId)).then(schedule => {
        this.futureTeamGames = schedule;
        this.nhlGameService.getNhlGame(this.futureTeamGames.dates[0].games[0].gamePk.toString()).then(nextGame =>{
          this.nextGame = nextGame;
        });
        this.nhlGameService.getNhlGameLiveFeed(this.futureTeamGames.dates[0].games[0].gamePk.toString()).then(nextGameLive => {
          this.nextGameLiveFeed = nextGameLive;
        });
      });
    });
  }

  public loadImages(): void {
    if (!this.teamData) {
      return;
    }
    this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.teamData.id);
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

  protected readonly NhlStandingsTypeEnum = NhlStandingsTypeEnum;
}
