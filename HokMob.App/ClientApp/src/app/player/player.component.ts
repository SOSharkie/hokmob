import {Component, OnInit, SimpleChanges} from '@angular/core';
import {ActivatedRoute, Params, Router} from "@angular/router";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import * as dayjs from "dayjs";
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";

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

  public get isGoalie(): boolean {
    if (this.player) {
      return this.player.primaryPosition.code === "G";
    }
    return false;
  }

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
              private nhlImageService: NhlImageService,
              private nhlStatsService: NhlStatsService) {}

  public ngOnInit(): void {
    this.previousUrl = this.routerExtensionService.getPreviousUrl();
    this.route.params.subscribe((params: Params) => {
      this.playerId = params['id'];
      this.nhlStatsService.getNhlPlayerStats(this.playerId).then(result => {
        console.log(result);
        this.player = result;
        this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.player.currentTeam.id);
        this.currentYearStats = this.player.stats[0].splits[this.player.stats[0].splits.length - 1].stat;
        this.loadImages();
      })
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
