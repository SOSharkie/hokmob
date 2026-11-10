import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {SeasonHistoryService} from "@shared/services/season-history.service";
import {PlayerSeasonRating, PlayerSeasonRatingUtils} from "@shared/utils/player-season-rating-utils";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
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
 * landing's featuredStats season, so the off-season shows the last season played. When that season has a history
 * file (SeasonHistoryService), it's loaded too, for the regular season card's average HokMob rating.
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

  /** The player's rated regular season. Undefined while it loads, without a history file, or when it fails. */
  public seasonRating: PlayerSeasonRating;

  /** Whether the featured season's history file is loading, so the card keeps a place for the rating. */
  public seasonRatingPending: boolean = false;

  public teamColor: string = "#000000";

  /** A little wider than it is tall, so the widest crests keep roughly the visual weight of the square ones. */
  public readonly logoSize: number = 40;

  public readonly logoMaxWidth: number = 52;

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

  /**
   * Whether the regular season card has its rating column (loading or loaded), which makes it five columns wide to the
   * bio's four, so the wide layout gives it more room.
   */
  public get hasSeasonRating(): boolean {
    return !!this.regularSeasonStats && (this.seasonRatingPending || !!this.seasonRating);
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
              private nhlStatsApiService: NhlStatsApiService,
              private seasonHistoryService: SeasonHistoryService) {}

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
      }
      this.countryFlagPath = player.birthCountry ? "assets/flags/" + player.birthCountry + ".png" : undefined;
      this.retrieveStats();
      this.retrieveSeasonRating();
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
   * Rates the featured regular season from its history file, when there is one. The file is shared with the history
   * page and kept for the session, so it's only loaded once. A player who isn't in it, or a file that fails, leaves
   * the card without the rating column.
   */
  private retrieveSeasonRating(): void {
    const playerId = this.playerId;
    const season = this.player?.featuredStats?.season;
    const hasHistory = SeasonHistoryService.seasons.some(option =>
        option.season === season && option.gameType === NhlGameTypeEnum.REGULAR_SEASON);
    if (!hasHistory) {
      return;
    }
    this.seasonRatingPending = true;
    this.seasonHistoryService.getSeasonHistory(season, NhlGameTypeEnum.REGULAR_SEASON).then(ratedSeason => {
      if (this.playerId === playerId) {
        this.seasonRating = PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, playerId);
        this.seasonRatingPending = false;
      }
    }).catch(() => {
      // The service logs the error. The card just goes without the rating
      if (this.playerId === playerId) {
        this.seasonRatingPending = false;
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
    this.seasonRating = undefined;
    this.seasonRatingPending = false;
    this.teamColor = "#000000";
    this.countryFlagPath = undefined;
  }
}
