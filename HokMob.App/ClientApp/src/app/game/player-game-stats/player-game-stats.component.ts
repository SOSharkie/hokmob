import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
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
export class PlayerGameStatsComponent implements OnChanges, AfterViewInit, OnDestroy {

  /**
   * The compact stats the bar drops to stay on one row, least important first.
   */
  private static readonly compactDropOrder: string[] = ["giveaways", "takeaways", "blocks"];

  @Input()
  public player: GamePlayer;

  /**
   * Lays the bio out on one row and the stats in a wide bar, for the goal highlight dialog, which needs the room
   * below for the video.
   */
  @Input()
  public compact: boolean = false;

  @ViewChild("statsContainer")
  public statsContainer: ElementRef<HTMLElement>;

  /**
   * How many of `compactDropOrder` the compact bar is currently hiding, so it stays on one row.
   */
  public droppedCompactStats: number = 0;

  private refitFrameId: number;

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
   * Whether to show the faceoff percentage: for skaters who took a faceoff, counted from the play-by-play. Without the
   * play-by-play's counts, the boxscore can't tell a player who took none from one who lost them all, so it falls
   * back to centers and to other skaters who won a faceoff.
   */
  public get showFaceoffs(): boolean {
    const faceoffsTaken = this.player?.ratingContext?.faceoffsTaken;
    if (faceoffsTaken != null) {
      return faceoffsTaken > 0;
    }
    return this.player?.position === "C" || this.skaterStats?.faceoffWinningPctg > 0;
  }

  public get faceoffPercentage(): string {
    return ((this.skaterStats?.faceoffWinningPctg ?? 0) * 100).toFixed(1) + "%";
  }

  constructor(private nhlGameService: NhlGameService,
              private changeDetector: ChangeDetectorRef) {}

  /**
   * Shows the player's game stats right away, and loads the bio (country, age). If the bio fails, those show "-".
   */
  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['player']) {
      return;
    }
    this.playerLanding = undefined;
    this.droppedCompactStats = 0;
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

  public ngAfterViewInit(): void {
    this.fitCompactStats();
  }

  public ngOnDestroy(): void {
    cancelAnimationFrame(this.refitFrameId);
  }

  /**
   * Refits the bar when the dialog gets narrower or wider with the window. Synchronously, so a wrapped bar is never
   * painted, and again on the next frame (also before it paints) in case the overlay resized itself after this event.
   */
  @HostListener("window:resize")
  public onWindowResize(): void {
    this.fitCompactStats();
    cancelAnimationFrame(this.refitFrameId);
    this.refitFrameId = requestAnimationFrame(() => this.fitCompactStats());
  }

  /**
   * Whether the compact bar still shows a stat of `compactDropOrder`. Every other stat is always shown.
   */
  public isStatShown(stat: string): boolean {
    if (!this.compact) {
      return true;
    }
    const dropIndex = PlayerGameStatsComponent.compactDropOrder.indexOf(stat);
    return dropIndex < 0 || dropIndex >= this.droppedCompactStats;
  }

  /**
   * Drops compact stats, least important first, until the bar fits on one row, so a second row can't push the goal
   * highlight dialog's video off screen. Once all of `compactDropOrder` is gone the bar wraps as before, because a
   * phone is too narrow for the stats that are left. Runs on view init and on a window resize; the dialogs build a
   * new component for each player, so the stats never change under it.
   */
  public fitCompactStats(): void {
    if (!this.compact || !this.statsContainer) {
      return;
    }
    for (let dropped = 0; dropped <= PlayerGameStatsComponent.compactDropOrder.length; dropped++) {
      this.droppedCompactStats = dropped;
      this.changeDetector.detectChanges();
      if (!this.compactStatsWrap()) {
        return;
      }
    }
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  /**
   * Whether the bar's stats sit on more than one row. Stats the phone styles hide (Faceoff % and the penalty minutes)
   * have no box, so they are left out: the last one in the template would otherwise report the first row's position.
   */
  private compactStatsWrap(): boolean {
    const items = Array.from(this.statsContainer.nativeElement.querySelectorAll<HTMLElement>(".game-stat-item"))
        .filter(item => item.offsetHeight > 0);
    return items.length > 1 && items[items.length - 1].offsetTop > items[0].offsetTop;
  }

  protected readonly StatsUtils = StatsUtils;
}
