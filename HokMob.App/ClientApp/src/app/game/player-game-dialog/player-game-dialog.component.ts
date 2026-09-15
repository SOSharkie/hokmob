import {Component, Inject, OnInit, ViewEncapsulation} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {Router} from "@angular/router";
import * as dayjs from "dayjs";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {BoxscoreGoalie, BoxscoreSkater, GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";

/**
 * Data of the player game dialog: a player's stats in the game, from the game page's boxscore.
 */
export interface PlayerGameDialogData {
  player: GamePlayer;
}

@Component({
  selector: 'app-player-game-dialog',
  templateUrl: './player-game-dialog.component.html',
  styleUrls: ['./player-game-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayerGameDialogComponent implements OnInit {

  public player: GamePlayer;

  /**
   * The player's bio from player/{id}/landing. Undefined until it loads, or when it fails.
   */
  public playerLanding: PlayerLanding;

  public teamLogo: string;

  public teamColor: string = "#000000";

  public get skaterStats(): BoxscoreSkater {
    return this.player?.skaterStats;
  }

  public get goalieStats(): BoxscoreGoalie {
    return this.player?.goalieStats;
  }

  public get isGoalie(): boolean {
    return !!this.goalieStats;
  }

  /**
   * The game's headshot (the player's team that season), or the current one from the player landing.
   */
  public get playerHeadshot(): string {
    return this.player?.headshot || this.playerLanding?.headshot || NhlPlayerHeadshotUtils.blankHeadshot;
  }

  public get birthCountry(): string {
    return this.playerLanding?.birthCountry ?? "-";
  }

  public get countryFlagPath(): string {
    return this.playerLanding?.birthCountry ? "assets/flags/" + this.playerLanding.birthCountry + ".png" : undefined;
  }

  public get age(): string {
    return this.playerLanding?.birthDate ? String(dayjs().diff(dayjs(this.playerLanding.birthDate), 'year')) : "-";
  }

  public get weight(): string {
    return this.playerLanding?.weightInPounds ? this.playerLanding.weightInPounds + " lb" : "-";
  }

  /**
   * Whether to show the faceoff percentage: for centers, and for other skaters who won a faceoff. The boxscore has no
   * faceoff counts, so a player who took none can't be told apart from one who lost them all.
   */
  public get showFaceoffs(): boolean {
    return this.player?.position === "C" || this.skaterStats?.faceoffWinningPctg > 0;
  }

  public get faceoffPercentage(): string {
    return ((this.skaterStats?.faceoffWinningPctg ?? 0) * 100).toFixed(1) + "%";
  }

  constructor(private nhlGameService: NhlGameService,
              private router: Router,
              private dialogRef: MatDialogRef<PlayerGameDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: PlayerGameDialogData) {}

  /**
   * Shows the player's game stats right away, and loads the bio (country, age). If the bio fails, those show "-".
   */
  public ngOnInit(): void {
    this.player = this.data?.player;
    if (!this.player) {
      return;
    }
    this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.player.teamId);
    this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.player.teamId);
    this.nhlGameService.getPlayerLanding(this.player.playerId).then(playerLanding => {
      this.playerLanding = playerLanding;
    }).catch(() => {
      // Already logged by the service
    });
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public clickPlayerProfile(): void {
    this.dialogRef.close();
    setTimeout(() => {
      window.scrollTo(0, 0);
      this.router.navigate(['/player', this.player.playerId]);
    }, 100)
  }

  public closeDialog(): void {
    this.dialogRef.close();
  }

  protected readonly StatsUtils = StatsUtils;
}
