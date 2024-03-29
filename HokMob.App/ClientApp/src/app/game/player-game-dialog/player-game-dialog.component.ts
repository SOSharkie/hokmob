import {Component, Inject, OnInit, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {GamePlayerModel} from "@shared/models/game-player.model";
import {NhlBoxscorePlayerModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player.model";
import {NhlTeamModel} from "@shared/models/nhl-general/nhl-team.model";
import {Router} from "@angular/router";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {StatsUtils} from "../../shared/utils/stats-utils";

@Component({
  selector: 'app-player-game-dialog',
  templateUrl: './player-game-dialog.component.html',
  styleUrls: ['./player-game-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayerGameDialogComponent implements OnInit {

  public player: NhlBoxscorePlayerModel;

  public playerTeam: NhlTeamModel;

  public playerHeadshot: any;

  public teamLogo: any;

  public teamColor: string = "#000000";

  public countryFlagPath = "assets/flags/CAN.png";

  public get isGoalie(): boolean {
    if (this.player) {
      return this.player.person.primaryPosition.code === "G";
    }
    return false;
  }

  public get weight(): string {
    if (this.player) {
      return this.player.person.weight + " lb";
    }
    return "-";
  }

  constructor(private nhlImageService: NhlImageService,
              private nhlStatsService: NhlStatsService,
              private router: Router,
              private dialogRef: MatDialogRef<PlayerGameDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: GamePlayerModel) {}

  public ngOnInit(): void {
    this.player = this.data.playerInfo;
    this.playerTeam = this.data.playerTeam;
    this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.playerTeam.id);
    this.loadImages();
    this.nhlStatsService.getNhlPlayerStats(this.player.person.id.toString()).then(result => {
      this.player.person = result;
      this.countryFlagPath = "assets/flags/" + this.player.person.birthCountry + ".png"
    });
  }

  public loadImages(): void {
    if (!this.player) {
      return;
    }
    this.playerHeadshot = 'assets/blank_headshot.png';
    this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.playerTeam.id);
    this.nhlImageService.getNhlPlayerHeadshot(this.player.person.id).then(data => {
      let reader = new FileReader();
      reader.addEventListener("load", () => {
        this.playerHeadshot = reader.result;
      }, false);
      reader.readAsDataURL(data);
    });
  }

  public clickPlayerProfile(): void {
    this.dialogRef.close();
    setTimeout(() => {
      window.scrollTo(0, 0);
      this.router.navigate(['/player', this.player.person.id]);
    }, 100)
  }

  public closeDialog(): void {
    this.dialogRef.close();
  }

  protected readonly StatsUtils = StatsUtils;
  protected readonly Math = Math;
}
