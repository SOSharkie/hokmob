import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Params, Router} from "@angular/router";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import * as dayjs from "dayjs";
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlStatsSplitModel} from "@shared/models/nhl-stats/nhl-stats-split.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent implements OnInit {

  public playerId: string;

  public previousUrl: string;

  public player: NhlPersonModel;

  public playerHeadshot: any;

  public teamLogo: any;

  public teamColor: string = "#000000";

  public countryFlagPath: string;

  public currentYearStats: NhlPlayerStatsModel;

  public currentPlayoffStats: NhlPlayerStatsModel;

  public playoffGames: NhlStatsSplitModel[];

  public regularSeasonGames: NhlStatsSplitModel[];

  public recentGames: NhlGameModel[];

  private readonly nhlLeagueId: number = 133;

  public get backButtonLabel(): string {
    if (this.previousUrl) {
      if (this.previousUrl.includes("stats")) {
        return "Stats";
      } else if (this.previousUrl.includes("game")) {
        return "Game";
      }
    }
    return "Stats";
  }

  public get isGoalie(): boolean {
    if (this.player) {
      return this.player.primaryPosition.code === "G";
    }
    return false;
  }

  constructor(private route: ActivatedRoute,
              private router: Router,
              private routerExtensionService: RouterExtensionService,
              private nhlGameService: NhlGameService,
              private nhlImageService: NhlImageService,
              private nhlStatsService: NhlStatsService) {}

  public ngOnInit(): void {
    this.previousUrl = this.routerExtensionService.getPreviousUrl();
    if (this.previousUrl === '/') {
      this.previousUrl = null;
    }
    this.route.params.subscribe((params: Params) => {
      this.initProperties(params);
      this.nhlStatsService.getNhlPlayerStats(this.playerId).then(result => {
        this.player = result;
        this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.player.currentTeam.id);
        this.countryFlagPath =  "assets/flags/" + this.player.birthCountry + ".png";
        this.setCurrentStatModels();
        this.loadImages();
        let yesterday = dayjs().subtract(1, 'day');
        let sixtyDaysAgo = yesterday.subtract(60, 'days');
        this.nhlGameService.getTeamGames(sixtyDaysAgo.toDate(), yesterday.toDate(), this.player.currentTeam.id).then(games => {
          this.recentGames = games.dates.map(date => date.games[0]).reverse().slice(0, 10);
        });
      });
    });
  }

  public loadImages(): void {
    if (!this.player) {
      return;
    }
    this.playerHeadshot = 'assets/blank_headshot.png';
    this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.player.currentTeam.id);
    this.nhlImageService.getNhlPlayerHeadshot(this.player.id).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.playerHeadshot = reader.result;
      }, false);
      reader.readAsDataURL(data);
    });
  }

  public backToPrevious(): void {
    if (this.previousUrl) {
      this.router.navigateByUrl(this.previousUrl);
    } else {
      this.router.navigate(['stats']);
    }
  }

  private initProperties(params: Params): void {
    this.currentPlayoffStats = null;
    this.currentYearStats = null;
    this.playoffGames = [];
    this.regularSeasonGames = [];
    this.recentGames = [];
    this.playerId = params['id'];
  }

  private setCurrentStatModels(): void {
    let currentSeason = DateTimeUtils.getCurrentNhlSeason();

    // Current Regular Season
    let latestRegularSeason = this.player.stats[0].splits[this.player.stats[0].splits.length - 1];
    if (latestRegularSeason && latestRegularSeason.season === currentSeason && latestRegularSeason.league.id === this.nhlLeagueId) {
      this.currentYearStats = latestRegularSeason.stat;
    } else {
      latestRegularSeason = this.player.stats[0].splits[this.player.stats[0].splits.length - 2];
      if (latestRegularSeason && latestRegularSeason.season === currentSeason && latestRegularSeason.league.id === this.nhlLeagueId) {
        this.currentYearStats = latestRegularSeason.stat;
      }
    }

    // Current Playoffs
    let latestPlayoffs = this.player.stats[1].splits[this.player.stats[1].splits.length - 1];
    if (latestPlayoffs && latestPlayoffs.season === currentSeason && latestPlayoffs.league.id === this.nhlLeagueId) {
      this.currentPlayoffStats = latestPlayoffs.stat;
    } else {
      latestPlayoffs = this.player.stats[1].splits[this.player.stats[1].splits.length - 2];
      if (latestPlayoffs && latestPlayoffs.season === currentSeason && latestPlayoffs.league.id === this.nhlLeagueId) {
        this.currentPlayoffStats = latestPlayoffs.stat;
      }
    }

    // Current season game by game breakdowns
    this.regularSeasonGames = this.player.stats[3].splits;
    this.playoffGames = this.player.stats[4].splits;
  }
}
