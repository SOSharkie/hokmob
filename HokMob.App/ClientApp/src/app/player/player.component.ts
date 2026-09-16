import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";
import {
  GoalieSeasonStats,
  PlayerStats,
  SkaterSeasonStats
} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * The player page. Two requests: player/{id}/landing for the header and bio, and /api/nhl-stats/player/{id} for the
 * season cards, the career table and the recent games. The bio stays when the stats fail, and the season shown is the
 * landing's featuredStats season, so the off-season shows the last season played.
 */
@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent implements OnInit {

  public playerId: number;

  /** The player's bio. Undefined until the landing loads, or when it fails. */
  public player: PlayerLanding;

  /** Whether the landing failed, so the page shows that the player couldn't be loaded. */
  public playerFailed: boolean = false;

  /** The player's stats. Undefined until they load, or when the request fails. */
  public stats: PlayerStats;

  /** Whether the stats request failed, so the cards, career and recent games are replaced by a message. */
  public statsFailed: boolean = false;

  public teamColor: string = "#000000";

  public teamLogo: string;

  public countryFlagPath: string;

  public get playerName(): string {
    return (this.player?.firstName?.default ?? "") + " " + (this.player?.lastName?.default ?? "");
  }

  public get playerHeadshot(): string {
    return this.player?.headshot || NhlPlayerHeadshotUtils.blankHeadshot;
  }

  public get teamName(): string {
    return this.player?.fullTeamName?.default;
  }

  public get isGoalie(): boolean {
    return this.player?.position === "G";
  }

  public get backButtonLabel(): string {
    return RouterExtensionService.getBackLabel(this.routerExtensionService.getPreviousUrl(), "Stats");
  }

  /** The season the cards show, like "2025-2026". Empty for a player who has never played an NHL game. */
  public get seasonLabel(): string {
    const season = this.player?.featuredStats?.season;
    return season ? DateTimeUtils.getNhlSeasonDisplayValue(String(season)) : "";
  }

  /** The playoffs of the season the cards show, like "2026". */
  public get playoffsLabel(): string {
    const season = this.player?.featuredStats?.season;
    return season ? String(season).substring(4) : "";
  }

  /** The featured season's regular season row, or undefined when there is none. */
  public get regularSeasonStats(): SkaterSeasonStats | GoalieSeasonStats {
    return this.findFeaturedSeason(this.stats?.regularSeasons);
  }

  /** The featured season's playoff row, or undefined when the player didn't play in those playoffs. */
  public get playoffStats(): SkaterSeasonStats | GoalieSeasonStats {
    return this.findFeaturedSeason(this.stats?.playoffSeasons);
  }

  constructor(private route: ActivatedRoute,
              private routerExtensionService: RouterExtensionService,
              private nhlGameService: NhlGameService,
              private nhlStatsApiService: NhlStatsApiService) {}

  public ngOnInit(): void {
    this.route.params.subscribe((params: Params) => {
      this.playerId = Number(params['id']);
      this.resetPlayerData();
      this.retrievePlayer();
    });
  }

  /**
   * Goes back to the previous page, or without one (the player was opened directly) to the stats page.
   */
  public backToPrevious(): void {
    this.routerExtensionService.back("/stats");
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  /**
   * Loads the player's bio, then their stats. A retired player has no current team, so the team link, logo and color
   * are only set when the landing has one.
   */
  private retrievePlayer(): void {
    const playerId = this.playerId;
    this.nhlGameService.getPlayerLanding(playerId).then(player => {
      if (this.playerId !== playerId) {
        return;
      }
      this.player = player;
      if (player.currentTeamId) {
        this.teamColor = NhlTeamColorUtils.getTeamPrimaryColor(player.currentTeamId);
        this.teamLogo = NhlTeamLogoUtils.getTeamPrimaryLogo(player.currentTeamId);
      }
      this.countryFlagPath = player.birthCountry ? "assets/flags/" + player.birthCountry + ".png" : undefined;
      this.retrieveStats();
    }).catch(() => {
      // The service logs the error. Without the landing there's no player to show at all
      if (this.playerId === playerId) {
        this.playerFailed = true;
      }
    });
  }

  private retrieveStats(): void {
    const playerId = this.playerId;
    this.nhlStatsApiService.getPlayerStats(playerId, this.isGoalie).then(stats => {
      if (this.playerId === playerId) {
        this.stats = stats;
      }
    }).catch(() => {
      // The service logs the error. The header and bio stay, the stats sections show a message
      if (this.playerId === playerId) {
        this.statsFailed = true;
      }
    });
  }

  /**
   * The row of the landing's featured season, which is the player's latest season.
   */
  private findFeaturedSeason(seasons: SkaterSeasonStats[] | GoalieSeasonStats[]): SkaterSeasonStats | GoalieSeasonStats {
    const season = this.player?.featuredStats?.season;
    if (!season) {
      return undefined;
    }
    return (seasons as (SkaterSeasonStats | GoalieSeasonStats)[] ?? [])
        .find(row => row.seasonId === season);
  }

  private resetPlayerData(): void {
    this.player = undefined;
    this.playerFailed = false;
    this.stats = undefined;
    this.statsFailed = false;
    this.teamColor = "#000000";
    this.teamLogo = undefined;
    this.countryFlagPath = undefined;
  }
}
