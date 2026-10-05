import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {combineLatest, Subscription} from "rxjs";
import {NhlLeadersService} from "@shared/services/nhl-leaders.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {
  LeaderboardEntry,
  StatCategory,
  StatCategoryUtils,
  StatColumn
} from "@shared/utils/stat-category-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {PickerMenuUtils} from "@shared/utils/picker-menu-utils";

/**
 * One player of a category's table, with every value as shown.
 */
export interface StatCategoryRow {
  playerId: number;
  /** Like "1", or "T-3" for a tie. */
  rank: string;
  name: string;
  headshot: string;
  /** The NHL team ID, or undefined for an abbreviation NhlTeamUtils doesn't know. */
  teamId: number;
  /** Like "EDM", or "-" for an unknown team. */
  teamAbbrev: string;
  teamColor: string;
  /** The values of the category's columns, in order, like ["82", "48", "90", "+28", "1.68", "138"]. */
  values: string[];
}

/**
 * A column of the table, with how it's shown.
 */
export interface StatCategoryColumn extends StatColumn {
  /** Whether it's the category's own stat, which stands out and sorts the table. */
  isSelected: boolean;
  /** Whether it's hidden on a phone, so the table fits without scrolling. */
  isPhoneHidden: boolean;
}

/**
 * A stats page category's top 25 at /stats/{category}, like /stats/points?gameType=P: the leaders in a table with
 * related stats beside the category's own, which stands out and sorts the table.
 *
 * Two requests in a row: the leaders of the category, from the same source as the stats page's card so the order and
 * qualification rules match, then the stats API's season rows of those players for the other columns. Without those
 * rows, the table still shows the leaders with their own stat. The season and the default game type are the stats
 * page's.
 */
@Component({
  selector: 'app-stat-category',
  templateUrl: './stat-category.component.html',
  styleUrls: ['./stat-category.component.scss']
})
export class StatCategoryComponent implements OnInit, OnDestroy {

  public readonly categories: StatCategory[] = StatCategoryUtils.categories;

  public readonly logoSize: number = 20;

  public readonly logoMaxWidth: number = 26;

  public category: StatCategory;

  /** The category's columns, in order, its own stat last. */
  public columns: StatCategoryColumn[] = [];

  public rows: StatCategoryRow[] = [];

  public playoffsSelected: boolean = false;

  /** Whether the regular season / playoffs picker is shown, during playoff mode like on the stats page. */
  public showGameTypePicker: boolean = false;

  public isLoading: boolean = true;

  /** Whether the leaders failed to load, as opposed to there being none yet. */
  public hasError: boolean = false;

  /** The season the table is for, from the standings. Undefined until they load. */
  public season: number;

  /** Whether the season is in playoff mode, which makes the playoffs the default game type. */
  private isPlayoffMode: boolean = false;

  /** Counts the loads, so a response for a category or game type that is no longer shown is ignored. */
  private loadCount: number = 0;

  private routeSubscription: Subscription;

  constructor(private nhlLeadersService: NhlLeadersService,
              private nhlStatsApiService: NhlStatsApiService,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService,
              private activatedRoute: ActivatedRoute,
              private router: Router) {
  }

  public get gameType(): number {
    return this.playoffsSelected ? 3 : 2;
  }

  public get gameTypeLabel(): string {
    return this.playoffsSelected ? "Playoffs" : "Regular Season";
  }

  /** Like "2025-2026 Regular Season", or the game type alone until the season loads. */
  public get subtitle(): string {
    const season = this.season ? DateTimeUtils.getNhlSeasonDisplayValue(String(this.season)) + " " : "";
    return season + this.gameTypeLabel;
  }

  /**
   * Waits for playoff mode, which shows the game type picker and selects the playoffs by default, then loads the
   * category in the route. When the season dates fail, it's the regular season without the picker.
   */
  public ngOnInit(): void {
    this.nhlStatsApiService.getCurrentSeason().then(currentSeason => currentSeason.isPlayoffMode).catch(() => {
      // The service logs the error
      return false;
    }).then(isPlayoffMode => {
      this.isPlayoffMode = isPlayoffMode;
      this.showGameTypePicker = isPlayoffMode;
      this.subscribeToRoute();
    });
  }

  public ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    // Any response still on its way is for a page that is gone
    this.loadCount++;
  }

  /** How the table is sorted, for screen readers: a goals against average is lowest first. */
  public get sortDirection(): string {
    return this.category?.format === "gaa" ? "ascending" : "descending";
  }

  /**
   * Opens another category's table, keeping the game type.
   */
  public selectCategory(category: StatCategory): void {
    if (category.id !== this.category?.id) {
      this.router.navigate(["/stats", category.id], {queryParamsHandling: "preserve"});
    }
  }

  /**
   * Switches between the regular season and the playoffs. The game type is a query parameter, so the table is loaded
   * by the route subscription rather than here.
   */
  public selectGameType(isPlayoffs: boolean): void {
    if (isPlayoffs !== this.playoffsSelected) {
      this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {gameType: isPlayoffs ? "P" : "R"}});
    }
  }

  public scrollToSelectedOption(menuClass: string): void {
    PickerMenuUtils.scrollToSelectedOption(menuClass);
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public trackPlayer(index: number, row: StatCategoryRow): number {
    return row.playerId;
  }

  /**
   * Loads the table whenever the category or the gameType query parameter changes ("P" for the playoffs, "R" for the
   * regular season), including with the browser's back and forward buttons. Without the parameter, it's the default
   * game type. An unknown category goes back to the stats page.
   */
  private subscribeToRoute(): void {
    this.routeSubscription = combineLatest([this.activatedRoute.paramMap, this.activatedRoute.queryParamMap])
        .subscribe(([params, queryParams]) => {
          const category = StatCategoryUtils.getCategory(params.get("category"));
          if (!category) {
            this.router.navigate(["/stats"], {queryParamsHandling: "preserve", replaceUrl: true});
            return;
          }
          const gameType = queryParams.get("gameType");
          if (category !== this.category) {
            this.category = category;
            this.columns = StatCategoryUtils.getTableColumns(category).map(column => {
              const isSelected = column.field === category.field;
              return {...column, isSelected, isPhoneHidden: !isSelected && !column.showOnPhone};
            });
          }
          this.playoffsSelected = gameType === "P" || gameType === "R" ? gameType === "P" : this.isPlayoffMode;
          this.loadTable();
        });
  }

  /**
   * Loads the table of the selected category and game type. The season comes from the standings, which are only asked
   * for once.
   */
  private loadTable(): void {
    const loadCount = ++this.loadCount;
    const category = this.category;
    const gameType = this.gameType;
    this.isLoading = true;
    this.hasError = false;
    this.getSeason().then(season => {
      if (!season) {
        throw new Error("No season in the standings");
      }
      return this.getLeaders(category, season, gameType).then(entries => {
        const playerIds = entries.map(entry => entry.playerId);
        return this.nhlStatsApiService.getSeasonPlayerStats(season, gameType, category.isGoalie, playerIds)
            .catch(() => {
              // The service logs the error. The leaders still show, with their own stat only
              return [] as SkaterSeasonStats[];
            })
            .then(seasonRows => ({entries, seasonRows}));
      });
    }).then(({entries, seasonRows}) => {
      if (loadCount !== this.loadCount) {
        return;
      }
      this.rows = this.buildRows(category, entries, seasonRows);
      this.isLoading = false;
    }).catch(() => {
      // The services log the error
      if (loadCount !== this.loadCount) {
        return;
      }
      this.rows = [];
      this.hasError = true;
      this.isLoading = false;
    });
  }

  /**
   * Gets the season from the standings, the first time it's needed.
   */
  private getSeason(): Promise<number> {
    if (this.season) {
      return Promise.resolve(this.season);
    }
    return this.nhlStandingAndPlayoffService.getNhlStandings(NhlStandingsTypeEnum.BY_LEAGUE).then(standings => {
      this.season = standings?.[0]?.teams?.[0]?.seasonId;
      return this.season;
    });
  }

  /**
   * Gets a category's top 25 from the source of its stats page card.
   */
  private getLeaders(category: StatCategory, season: number, gameType: number): Promise<LeaderboardEntry[]> {
    const limit = StatCategoryUtils.tableLeaderCount;
    switch (category.source) {
      case "skaterLeaders":
        return this.nhlLeadersService.getSkaterLeaders(season, gameType, [category.leaderCategory], limit)
            .then(skaters => StatCategoryUtils.getEntries(category, skaters, null, null, season));
      case "goalieLeaders":
        return this.nhlLeadersService.getGoalieLeaders(season, gameType, [category.leaderCategory], limit)
            .then(goalies => StatCategoryUtils.getEntries(category, null, goalies, null, season));
      default:
        return this.nhlStatsApiService.getHitsAndShotsLeaders(season, gameType, limit)
            .then(hitsAndShots => StatCategoryUtils.getEntries(category, null, null, hitsAndShots, season));
    }
  }

  /**
   * Builds the table rows: the leaders in their order, with the category's own stat from the leaders (so it matches
   * the stats page's card) and the other columns from the season rows. A player without a season row shows "-" there.
   */
  private buildRows(category: StatCategory, entries: LeaderboardEntry[],
                    seasonRows: SkaterSeasonStats[] | GoalieSeasonStats[]): StatCategoryRow[] {
    const seasonRowsById = new Map<number, SkaterSeasonStats & GoalieSeasonStats>();
    for (const seasonRow of (seasonRows ?? []) as (SkaterSeasonStats & GoalieSeasonStats)[]) {
      seasonRowsById.set(seasonRow.playerId, seasonRow);
    }
    const ranks = StatCategoryUtils.getRankLabels(entries.map(entry => entry.value));
    return entries.map((entry, index) => {
      const seasonRow = seasonRowsById.get(entry.playerId);
      const team = NhlTeamUtils.getTeam(entry.teamId);
      return {
        playerId: entry.playerId,
        rank: ranks[index],
        name: entry.name,
        headshot: entry.headshot || NhlPlayerHeadshotUtils.blankHeadshot,
        teamId: entry.teamId,
        teamAbbrev: team.triCode,
        teamColor: NhlTeamColorUtils.getTeamPrimaryColor(entry.teamId),
        values: StatCategoryUtils.getTableColumns(category).map(column => StatCategoryUtils.formatValue(
            column.field === category.field ? entry.value : seasonRow?.[column.field], column.format))
      };
    });
  }
}
