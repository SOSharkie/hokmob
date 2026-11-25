import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {SeasonHistoryService} from "@shared/services/season-history.service";
import {NaturalStatTrickService} from "@shared/services/natural-stat-trick.service";
import {EdgeSeasonService} from "@shared/services/edge-season.service";
import {EdgeSeason} from "@shared/models/nhl-edge/edge-season.model";
import {PlayerSeasonRating, PlayerSeasonRatingUtils} from "@shared/utils/player-season-rating-utils";
import {PlayerPercentileUtils, PlayerTraits} from "@shared/utils/player-percentile-utils";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";
import {LeaguePlayers} from "@shared/models/nhl-stats-api/league-players.model";
import {NstPlayerStats} from "@shared/models/natural-stat-trick/nst-players.model";
import {EdgeGoalieDetail, EdgeSkaterDetail} from "@shared/models/nhl-web-api/edge.model";
import {
  GoalieSeasonStats,
  PlayerStats,
  SkaterSeasonStats
} from "@shared/models/nhl-stats-api/player-stats.model";

/**
 * The player page. Two requests: player/{id}/landing for the header and bio, and /api/nhl-stats/player/{id} for the
 * season cards, the career table and the recent games. The bio stays when the stats fail, and the season shown is the
 * landing's featuredStats season, so the off-season shows the last season played. When that season has a history
 * file (SeasonHistoryService), it's loaded too, for the regular season card's average HokMob rating, and so is every
 * player of his position that season (/api/nhl-stats/league-players), for the traits card's percentiles. A skater's
 * traits also count Natural Stat Trick's skaters of the season and the season's NHL EDGE file (EdgeSeasonService),
 * both optional, and the card waits for all three, so its shape doesn't change after it appears.
 *
 * While each request loads, its cards show skeletons at their size (SkeletonCardComponent), so the page doesn't jump
 * when the data comes in: the whole page until the landing loads, then the season, recent games and career cards
 * until the stats do. The landing tells how many career seasons and recent games there will be.
 */
@Component({
    selector: 'app-player',
    templateUrl: './player.component.html',
    styleUrls: ['./player.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PlayerComponent implements OnInit {

  /** The recent games the stats API returns (RecentGameCount in NhlStatsController). */
  private static readonly recentGameCount = 10;

  /** The career card's skeleton rows before the landing says how many seasons there are. */
  private static readonly defaultCareerSeasons = 10;

  /** The header stripes' color while the player loads: the skeleton blocks' gray ($gray-01) at their opacity. */
  private static readonly loadingLineColor = "#2b2b2b";

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

  /**
   * The player's percentiles in the featured regular season against his position. Undefined while they load, for a
   * player without a row in that season, and when the request fails, which all hide the traits card.
   */
  public traits: PlayerTraits;

  /** Whether the featured season's league players are loading, so the traits card shows its skeleton. */
  public traitsPending: boolean = false;

  /**
   * Every player of the featured regular season at the player's position, which the traits and season performance
   * cards rank him among. Undefined while they load and when the request fails.
   */
  public leaguePlayers: LeaguePlayers;

  /**
   * Every skater's featured regular season on Natural Stat Trick, for the season performance card's advanced stats.
   * Undefined for a goalie, while it loads and when it fails, which leaves the card with the NHL's stats.
   */
  public nstPlayers: NstPlayerStats[];

  /** Whether Natural Stat Trick's skaters are loading. */
  public nstPending: boolean = false;

  /** The player's NHL EDGE stats of the featured regular season, or undefined without them (before 2021-22). */
  public edgeDetail: EdgeSkaterDetail | EdgeGoalieDetail;

  /** Whether the NHL EDGE stats are loading. */
  public edgePending: boolean = false;

  /**
   * Every skater's NHL EDGE stats of the featured regular season, from its stored file, for the traits card's Speed.
   * Undefined for a goalie, for a season without a file (before 2021-22), while it loads and when it fails.
   */
  public edgeSeason: EdgeSeason;

  /** Whether the EDGE season file is loading. */
  public edgeSeasonPending: boolean = false;

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
   * bio's four, so the wide layout gives it more room. Before the landing loads it's assumed, like most players' cards.
   */
  public get hasSeasonRating(): boolean {
    if (this.playerLoading) {
      return true;
    }
    return (!!this.regularSeasonStats || this.statsLoading) && (this.seasonRatingPending || !!this.seasonRating);
  }

  /**
   * Whether the traits card shows its skeleton: until the landing loads, then until the league players, Natural Stat
   * Trick and the EDGE season file have all answered.
   */
  public get traitsLoading(): boolean {
    return this.playerLoading || this.traitsPending || this.nstPending || this.edgeSeasonPending;
  }

  /**
   * Whether the season performance card shows its skeleton: until the landing loads, then until the league players,
   * Natural Stat Trick and NHL EDGE have all answered, so its rows don't come in one source at a time.
   */
  public get seasonPerformanceLoading(): boolean {
    return this.playerLoading || this.traitsPending || this.nstPending || this.edgePending;
  }

  /** The featured season, like 20262027, or undefined for a player who has never played an NHL game. */
  public get featuredSeason(): number {
    return this.player?.featuredStats?.season;
  }

  /** The header's two stripes: the team's color, or the skeletons' gray while the player loads. */
  public get headerLineColor(): string {
    return this.playerLoading ? PlayerComponent.loadingLineColor : this.teamColor;
  }

  /** Whether the landing is still loading, so the header and every card show their skeletons. */
  public get playerLoading(): boolean {
    return !this.player && !this.playerFailed;
  }

  /**
   * Whether the stats are still loading, for a player who has some: the season, recent games and career cards show
   * their skeletons until they're in. A player who has never played an NHL game has none to wait for.
   */
  public get statsLoading(): boolean {
    return !this.stats && !this.statsFailed && (!this.player || !!this.player.featuredStats);
  }

  /** The recent games' skeleton rows: the 10 asked for, or the player's NHL games when they've played fewer. */
  public get expectedRecentGames(): number {
    const career = this.player?.featuredStats;
    if (!career) {
      return PlayerComponent.recentGameCount;
    }
    const games = (career.regularSeason?.career?.gamesPlayed ?? 0) + (career.playoffs?.career?.gamesPlayed ?? 0);
    return Math.min(PlayerComponent.recentGameCount, games);
  }

  /** The career card's skeleton rows: the player's NHL regular seasons in the landing, or 10 before it loads. */
  public get expectedCareerSeasons(): number {
    const totals = this.player?.seasonTotals;
    if (!totals) {
      return PlayerComponent.defaultCareerSeasons;
    }
    return new Set(totals.filter(total => total.leagueAbbrev === "NHL" && total.gameTypeId === 2)
        .map(total => total.season)).size;
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
              private seasonHistoryService: SeasonHistoryService,
              private naturalStatTrickService: NaturalStatTrickService,
              private edgeSeasonService: EdgeSeasonService) {}

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
      this.retrieveTraits();
      this.retrieveSeasonPerformance();
      this.retrieveEdgeSeason();
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
   * Loads every player of his position in the featured regular season, which the traits and season performance cards
   * rank him among. The season is kept by NhlStatsApiService for a few minutes, so the next player of the same season
   * doesn't load it again. A player who has never played an NHL game has no featured season, and gets no card.
   */
  private retrieveTraits(): void {
    const playerId = this.playerId;
    const season = this.featuredSeason;
    if (!season) {
      return;
    }
    this.traitsPending = true;
    this.nhlStatsApiService.getLeaguePlayers(season, NhlGameTypeEnum.REGULAR_SEASON, this.isGoalie)
        .then(leaguePlayers => {
          if (this.playerId === playerId) {
            this.leaguePlayers = leaguePlayers;
            this.traitsPending = false;
            this.updateTraits();
          }
        }).catch(() => {
          // The service logs the error. The card is left out
          if (this.playerId === playerId) {
            this.traitsPending = false;
          }
        });
  }

  /**
   * Loads the featured regular season's NHL EDGE file for a skater's Speed, when the season has one. The file is kept
   * for the session. Without it (a goalie, a season before 2021-22, a failed load) the traits go without Speed.
   */
  private retrieveEdgeSeason(): void {
    const playerId = this.playerId;
    const season = this.featuredSeason;
    if (!season || this.isGoalie || !EdgeSeasonService.hasSeason(season)) {
      return;
    }
    this.edgeSeasonPending = true;
    this.edgeSeasonService.getEdgeSeason(season).then(edgeSeason => {
      if (this.playerId === playerId) {
        this.edgeSeason = edgeSeason;
        this.edgeSeasonPending = false;
        this.updateTraits();
      }
    }).catch(() => {
      // The service logs the error. The traits go without Speed
      if (this.playerId === playerId) {
        this.edgeSeasonPending = false;
        this.updateTraits();
      }
    });
  }

  /**
   * Works out the player's traits once the league players, Natural Stat Trick and the EDGE season file have all
   * answered, with whichever of the last two came in.
   */
  private updateTraits(): void {
    if (this.traitsPending || this.nstPending || this.edgeSeasonPending || !this.leaguePlayers) {
      return;
    }
    this.traits = PlayerPercentileUtils.getPlayerTraits(this.leaguePlayers, this.playerId, {
      nstPlayers: this.nstPlayers,
      edgeSeason: this.edgeSeason
    });
  }

  /**
   * Loads what the season performance card adds to the league players (retrieveTraits): Natural Stat Trick's skaters
   * of the featured regular season, which the traits use too, and the player's NHL EDGE stats. Either one failing
   * leaves its rows out. NST has no goalie stats here, so a goalie only gets EDGE's.
   */
  private retrieveSeasonPerformance(): void {
    const playerId = this.playerId;
    const season = this.featuredSeason;
    if (!season) {
      return;
    }
    if (!this.isGoalie) {
      this.nstPending = true;
      this.naturalStatTrickService.getPlayers(season).then(nstPlayers => {
        if (this.playerId === playerId) {
          this.nstPlayers = nstPlayers;
          this.nstPending = false;
          this.updateTraits();
        }
      }).catch(() => {
        // The service logs the error. The cards show the NHL's stats alone
        if (this.playerId === playerId) {
          this.nstPending = false;
          this.updateTraits();
        }
      });
    }
    this.edgePending = true;
    this.nhlGameService.getPlayerEdgeDetail(playerId, season, NhlGameTypeEnum.REGULAR_SEASON, this.isGoalie)
        .then(edgeDetail => {
          if (this.playerId === playerId) {
            this.edgeDetail = edgeDetail;
            this.edgePending = false;
          }
        }).catch(() => {
          // The service logs the error. The card goes without EDGE's stats
          if (this.playerId === playerId) {
            this.edgePending = false;
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
    this.traits = undefined;
    this.traitsPending = false;
    this.leaguePlayers = undefined;
    this.nstPlayers = undefined;
    this.nstPending = false;
    this.edgeDetail = undefined;
    this.edgePending = false;
    this.edgeSeason = undefined;
    this.edgeSeasonPending = false;
    this.teamColor = "#000000";
    this.countryFlagPath = undefined;
  }
}
