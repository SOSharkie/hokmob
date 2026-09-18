import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import * as dayjs from "dayjs";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {BoxscoreGoalie, BoxscoreSkater, GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";

/**
 * A player's bio and game stats, shown at the top of the player game dialog and the goal highlight dialog.
 */
@Component({
  selector: 'app-player-game-stats',
  templateUrl: './player-game-stats.component.html',
  styleUrls: ['./player-game-stats.component.scss']
})
export class PlayerGameStatsComponent implements OnChanges {

  @Input()
  public player: GamePlayer;

  /**
   * Lays the bio out on one row and the stats in a wide bar, for the goal highlight dialog, which needs the room
   * below for the video.
   */
  @Input()
  public compact: boolean = false;

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

  constructor(private nhlGameService: NhlGameService) {}

  /**
   * Shows the player's game stats right away, and loads the bio (country, age). If the bio fails, those show "-".
   */
  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['player']) {
      return;
    }
    this.playerLanding = undefined;
    this.teamColor = "#000000";
    this.teamLogo = undefined;
    if (!this.player) {
      return;
    }
    this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(this.player.teamId);
    this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(this.player.teamId);
    const playerId = this.player.playerId;
    this.nhlGameService.getPlayerLanding(playerId).then(playerLanding => {
      if (playerId === this.player?.playerId) {
        this.playerLanding = playerLanding;
      }
    }).catch(() => {
      // Already logged by the service
    });
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  protected readonly StatsUtils = StatsUtils;
}
