import {Component, Input, OnInit, SimpleChanges} from '@angular/core';
import {ActivatedRoute, Params, Router} from "@angular/router";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import * as dayjs from "dayjs";
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlStatsSplitModel} from "@shared/models/nhl-stats/nhl-stats-split.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";

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

  public currentYearStats: NhlPlayerStatsModel;

  public currentPlayoffStats: NhlPlayerStatsModel;

  public playoffGames: NhlStatsSplitModel[];

  public regularSeasonGames: NhlStatsSplitModel[];

  public recentGames: NhlGameModel[];

  public get shoots(): string {
    if (this.player) {
      if (this.player.shootsCatches === "L") {
        return "Left";
      }
      return "Right";
    }
    return "Right";
  }

  public get weight(): string {
    if (this.player) {
      return this.player.weight + " lb";
    }
    return "-";
  }

  public get rosterStatusHeader(): string {
    if (this.player) {
      if (this.player.captain) {
        return "Captain";
      } else if (this.player.alternateCaptain) {
        return "Captain";
      } else {
        return "Rookie"
      }
    }
    return "-";
  }

  public get rosterStatus(): string {
    if (this.player) {
      if (this.player.captain) {
        return "Yes";
      } else if (this.player.alternateCaptain) {
        return "Alternate";
      } else if (this.player.rookie) {
        return "Yes"
      } else {
        return "No";
      }
    }
    return "-";
  }

  constructor(private route: ActivatedRoute,
              private router: Router,
              private routerExtensionService: RouterExtensionService,
              private nhlGameService: NhlGameService,
              private nhlImageService: NhlImageService,
              private nhlStatsService: NhlStatsService) {}

  public ngOnInit(): void {
    this.previousUrl = this.routerExtensionService.getPreviousUrl();
    this.route.params.subscribe((params: Params) => {
      this.playerId = params['id'];
      this.nhlStatsService.getNhlPlayerStats(this.playerId).then(result => {
        this.player = result;
        this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.player.currentTeam.id);
        this.currentYearStats = this.player.stats[0].splits[this.player.stats[0].splits.length - 1].stat;
        let latestPlayoffs = this.player.stats[1].splits[this.player.stats[1].splits.length - 1];
        if (latestPlayoffs && latestPlayoffs.season === "20222023") {
          this.currentPlayoffStats = latestPlayoffs.stat;
        }
        this.regularSeasonGames = this.player.stats[3].splits;
        this.playoffGames = this.player.stats[4].splits;
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
    this.teamLogo = 'assets/nhl_logo.png';
    this.playerHeadshot = 'assets/nhl_logo.png';
    this.nhlImageService.getNhlTeamLogo(this.player.currentTeam.id).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.teamLogo = reader.result;
      }, false);
      reader.readAsDataURL(data);
    });
    this.nhlImageService.getNhlPlayerHeadshot(this.player.id).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.playerHeadshot = reader.result;
      }, false);
      reader.readAsDataURL(data);
    });
  }
}
