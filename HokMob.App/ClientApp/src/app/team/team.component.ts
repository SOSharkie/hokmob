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

  public recentGames: NhlGameModel[];

  public standings: NhlStandingsModel[];

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
        console.log(teamData);
        this.teamData = teamData;
        this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.teamData.id);
        this.loadImages();
        this.nhlStandingAndPlayoffService.getNhlStandings(DateTimeUtils.getCurrentNhlSeason(), NhlStandingsTypeEnum.BY_CONFERENCE).then(standings => {
          if (this.teamData.conference.id === 5) {
            this.standings = standings.reverse();
          } else {
            this.standings = standings;
          }
          console.log(standings);
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
