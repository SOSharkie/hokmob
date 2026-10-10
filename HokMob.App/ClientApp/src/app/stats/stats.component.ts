import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {NhlLeadersService} from "@shared/services/nhl-leaders.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {GoalieStatsLeaders, SkaterStatsLeaders} from "@shared/models/nhl-web-api/stats-leaders.model";
import {HitsAndShotsLeaders} from "@shared/models/nhl-stats-api/leaders.model";
import {LeaderboardEntry, StatCategoryUtils, StatFormat} from "@shared/utils/stat-category-utils";

/**
 * One leaderboard of the stats page.
 */
export interface Leaderboard {
  /** The category's id, like "points", which its top 25 table is routed by. */
  categoryId: string;
  title: string;
  entries: LeaderboardEntry[];
  format: StatFormat;
}

/**
 * The stats page. Three requests: the NHL web API's skater and goalie leaders, which carry the NHL's own
 * qualification rules, headshots and logos, and the stats API's hits and shots leaders, which the web API has no
 * category for. The season is the standings season, so the off-season shows the last season played.
 */
@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {

  public leaderboards: Leaderboard[] = [];

  public showFilters: boolean = false;

  public playoffsSelected: boolean = false;

  /**
   * Whether the leaderboards are loading. On a game type switch the previous leaderboards stay, dimmed, until the new
   * ones replace them, so the page doesn't collapse to a spinner and back.
   */
  public isLoading: boolean = false;

  /** The season the leaderboards are for, from the standings. Undefined until they load. */
  private season: number;

  /** The game type of the last request, so a response of the other one is ignored. */
  private requestedGameType: number;

  /** Whether the season is in playoff mode, which makes the playoffs the default game type. */
  private isPlayoffMode: boolean = false;

  private readonly skaterCategories = StatCategoryUtils.getLeaderCategories("skaterLeaders");

  private readonly goalieCategories = StatCategoryUtils.getLeaderCategories("goalieLeaders");

  private readonly leaderCount = 5;

  private get gameType(): number {
    return this.playoffsSelected ? 3 : 2;
  }

  constructor(private nhlLeadersService: NhlLeadersService,
              private nhlStatsApiService: NhlStatsApiService,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService,
              private activatedRoute: ActivatedRoute,
              private router: Router) {
  }

  /**
   * Waits for playoff mode, which shows the game type filters and selects the playoffs by default, then loads the
   * leaders of the game type in the query parameter. When the season dates fail, it's the regular season without
   * filters.
   */
  public ngOnInit(): void {
    this.isLoading = true;
    this.nhlStatsApiService.getCurrentSeason().then(currentSeason => currentSeason.isPlayoffMode).catch(() => {
      // The service logs the error
      return false;
    }).then(isPlayoffMode => {
      this.isPlayoffMode = isPlayoffMode;
      this.showFilters = isPlayoffMode;
      this.subscribeToGameType();
    });
  }

  /**
   * Loads the leaders whenever the gameType query parameter changes ("P" for the playoffs, "R" for the regular season),
   * including with the browser's back and forward buttons. Without the parameter, it's the default game type.
   */
  private subscribeToGameType(): void {
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      const gameType = params.get("gameType");
      this.playoffsSelected = gameType === "P" || gameType === "R" ? gameType === "P" : this.isPlayoffMode;
      this.updateStats();
    });
  }

  /**
   * Switches between the regular season and the playoffs. The game type is a query parameter, so the leaders are
   * loaded by the query parameter subscription rather than here. The filters always respond, even mid-load: the
   * response of a game type the user left is ignored (see retrieveLeaders).
   */
  public updateGameType(isPlayoffs: boolean): void {
    if (isPlayoffs !== this.playoffsSelected) {
      this.playoffsSelected = isPlayoffs;
      this.isLoading = true;
      const gameTypeParam = this.playoffsSelected ? "P" : "R";
      this.router.navigate([],
          {
            relativeTo: this.activatedRoute,
            queryParams: {gameType: gameTypeParam},
          }
      );
    }
  }

  /**
   * Loads the leaderboards of the selected game type. The season comes from the standings, which are only asked for
   * once: switching between the regular season and the playoffs reloads the leaders alone.
   */
  private updateStats(): void {
    this.isLoading = true;
    this.requestedGameType = this.gameType;
    if (this.season) {
      this.retrieveLeaders(this.season, this.gameType);
      return;
    }
    this.nhlStandingAndPlayoffService.getNhlStandings(NhlStandingsTypeEnum.BY_LEAGUE).then(standings => {
      this.season = standings[0]?.teams[0]?.seasonId;
      if (!this.season) {
        this.showEmptyLeaderboards();
        return;
      }
      this.retrieveLeaders(this.season, this.requestedGameType);
    }).catch(() => {
      // The service logs the error. Without a season there's nothing to ask the leaders for
      this.showEmptyLeaderboards();
    });
  }

  /**
   * Loads the three sources at once and builds every leaderboard from what came back, so a source that fails only
   * leaves its own boards empty.
   */
  private retrieveLeaders(season: number, gameType: number): void {
    const skaterLeaders = this.nhlLeadersService
        .getSkaterLeaders(season, gameType, this.skaterCategories, this.leaderCount)
        .catch(() => null);
    const goalieLeaders = this.nhlLeadersService
        .getGoalieLeaders(season, gameType, this.goalieCategories, this.leaderCount)
        .catch(() => null);
    const hitsAndShots = this.nhlStatsApiService.getHitsAndShotsLeaders(season, gameType, this.leaderCount)
        .catch(() => null);
    Promise.all([skaterLeaders, goalieLeaders, hitsAndShots]).then(([skaters, goalies, hitsAndShotsLeaders]) => {
      if (this.requestedGameType !== gameType) {
        return;
      }
      this.leaderboards = this.buildLeaderboards(skaters, goalies, hitsAndShotsLeaders);
      this.isLoading = false;
    });
  }

  /**
   * Builds a leaderboard per category, in the stats page's order, from what each source returned (null when it
   * failed).
   */
  private buildLeaderboards(skaters: SkaterStatsLeaders, goalies: GoalieStatsLeaders,
                            hitsAndShots: HitsAndShotsLeaders): Leaderboard[] {
    return StatCategoryUtils.categories.map(category => ({
      categoryId: category.id,
      title: category.title,
      entries: StatCategoryUtils.getEntries(category, skaters, goalies, hitsAndShots, this.season),
      format: category.format
    }));
  }

  /**
   * Shows every leaderboard's empty state, for when there is no season to ask the leaders for.
   */
  private showEmptyLeaderboards(): void {
    this.leaderboards = this.buildLeaderboards(null, null, null);
    this.isLoading = false;
  }
}
