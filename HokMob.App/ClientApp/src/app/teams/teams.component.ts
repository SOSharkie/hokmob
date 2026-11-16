import {ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import {ScrollDirectionService} from "@shared/services/scroll-direction.service";
import {ActivatedRoute, ParamMap} from "@angular/router";
import {Location} from "@angular/common";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NaturalStatTrickService} from "@shared/services/natural-stat-trick.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {NstTeamSeasonStats} from "@shared/models/natural-stat-trick/nst-team-stats.model";
import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {TeamMetricId, TeamRating, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {SortDirection} from "@app/team/team-player-stats/team-player-stats.component";

/** A team's row of the table, before it's formatted for a column. */
export interface TeamTableRow {
  teamId: number;
  /** Like "Winnipeg Jets". */
  name: string;
  /** Like "WPG", shown instead of the name on a phone. */
  triCode: string;
  /** The team's stats API row, or undefined when /api/nhl-stats/teams failed or has no row for it. */
  stats?: TeamSeasonStats;
  /** The team's power rating and advanced stats, or undefined when the season's games failed. */
  rating?: TeamRating;
  /** The team's 5v5 xGF% from Natural Stat Trick, 0 to 1, or undefined without it. */
  expectedGoalsShare?: number;
}

/**
 * Which section of stats a column is in: its header group on a wide screen, and what the section picker shows on a
 * narrower one.
 */
export type TeamTableColumnGroup = "record" | "scoring" | "specialTeams" | "possession" | "fiveOnFive";

/** A section of the picker, which shows one column group at a time on a narrower screen. */
export interface TeamTableSection {
  id: TeamTableColumnGroup;
  label: string;
}

/** A column of the teams table. */
export interface TeamTableColumn {
  /** The column's ID, which the sort query parameter holds. */
  id: string;
  /** The header, like "PTS". */
  label: string;
  /** The header's tooltip. */
  title: string;
  /** The header group and section, or undefined for the power rating, which stands alone and is always shown. */
  group?: TeamTableColumnGroup;
  /** The value the column sorts by. Null or undefined sorts last either way, and shows a dash. */
  value: (row: TeamTableRow) => number;
  /** The shown value, like "48.7%", for a value that isn't missing. */
  format: (value: number) => string;
  /** For a stat where less is better (goals against), which then sorts ascending first. */
  lowerIsBetter?: boolean;
  /** For the power rating, shown as a colored badge. */
  isRating?: boolean;
  /** For NST's xGF%, which is only shown once NST answers. */
  needsExpectedGoals?: boolean;
}

/** A group of the header's top row, over its columns. */
export interface TeamTableHeaderGroup {
  label: string;
  span: number;
}

/**
 * The teams page (/teams): every team's season stats in one sortable table, sorted by the HokMob power rating by
 * default. The record, scoring and special teams stats come from the stats API's team rows (/api/nhl-stats/teams), the
 * power rating and the advanced stats from every team's games (/api/nhl-stats/team-games, TeamRatingUtils), and 5v5
 * xGF% from Natural Stat Trick's team table, when it answers. The season is the standings' season, like the stats and
 * team pages, so the off-season shows the last season played. Only the regular season.
 *
 * Below $small-display-breakpoint (1200px), the table shows one section of stats at a time beside the team and its
 * power rating, picked from pills above the table, instead of scrolling sideways through all of them. The CSS hides the
 * other sections' columns, so a wide screen shows every column whatever is picked.
 *
 * The sort and the section are kept in the URL: `sort` is the column's ID, `order` is `asc` or `desc` and `section` is
 * the section's ID, each left out at its default (the power rating, the column's best value first, and the sorted
 * column's section, or Record for the power rating).
 */
@Component({
    selector: 'app-teams',
    templateUrl: './teams.component.html',
    styleUrls: ['./teams.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamsComponent implements OnInit, OnDestroy {

  /** The column sorted by without a sort query parameter. */
  public static readonly defaultSortId = "rating";

  public static readonly expectedGoalsDescription = "The team's share of the expected goals at 5 on 5, from Natural " +
      "Stat Trick: like Fenwick, but each unblocked shot attempt counts by how likely it was to score";

  public static readonly ratingDescription = "The HokMob power rating, 0 to 10 with 5 for an average team: points %, " +
      "goal differential, 5v5 Corsi % and special teams, each compared to the league";

  /** The sections, in the columns' order. Their labels head the column groups too. */
  public static readonly sections: TeamTableSection[] = [
    {id: "record", label: "Record"},
    {id: "scoring", label: "Scoring"},
    {id: "specialTeams", label: "Special Teams"},
    {id: "possession", label: "Possession"},
    {id: "fiveOnFive", label: "5v5"}
  ];

  /** The section shown without a section query parameter, when the power rating is sorted by. */
  public static readonly defaultSectionId: TeamTableColumnGroup = "record";

  /** Every column, in order. */
  public static readonly columns: TeamTableColumn[] = [
    {
      id: "rating", label: "Rating", title: TeamsComponent.ratingDescription, isRating: true,
      value: row => row.rating?.rating,
      format: value => TeamRatingUtils.formatRating(value)
    },
    TeamsComponent.countColumn("gp", "GP", "Games Played", "gamesPlayed", "gamesPlayed"),
    TeamsComponent.countColumn("w", "W", "Wins", "wins", "wins"),
    TeamsComponent.countColumn("l", "L", "Losses", "losses", "losses", true),
    TeamsComponent.countColumn("otl", "OTL", "Overtime Losses", "otLosses", "otLosses", true),
    TeamsComponent.countColumn("pts", "PTS", "Points", "points", "points"),
    {
      id: "ptsPct", label: "P%", title: "Points percentage: the share of the possible standings points earned",
      group: "record",
      value: row => row.stats?.pointPct ?? row.rating?.values.pointPct,
      format: value => TeamsComponent.formatPercent(value)
    },
    {
      id: "gf", label: "GF/GP", title: "Goals For per Game", group: "scoring",
      value: row => row.stats?.goalsForPerGame ?? TeamsComponent.perGame(row, row.rating?.totals.goalsFor),
      format: value => value.toFixed(2)
    },
    {
      id: "ga", label: "GA/GP", title: "Goals Against per Game", group: "scoring", lowerIsBetter: true,
      value: row => row.stats?.goalsAgainstPerGame ?? TeamsComponent.perGame(row, row.rating?.totals.goalsAgainst),
      format: value => value.toFixed(2)
    },
    TeamsComponent.metricColumn("goalDiff", "GD/GP", "scoring"),
    {
      id: "sf", label: "SF/GP", title: "Shots For per Game", group: "scoring",
      value: row => row.stats?.shotsForPerGame ?? TeamsComponent.perGame(row, row.rating?.totals.shotsFor),
      format: value => value.toFixed(1)
    },
    {
      id: "sa", label: "SA/GP", title: "Shots Against per Game", group: "scoring", lowerIsBetter: true,
      value: row => row.stats?.shotsAgainstPerGame ?? TeamsComponent.perGame(row, row.rating?.totals.shotsAgainst),
      format: value => value.toFixed(1)
    },
    {
      id: "pp", label: "PP%", title: "Power Play Percentage", group: "specialTeams",
      value: row => row.stats?.powerPlayPct,
      format: value => TeamsComponent.formatPercent(value)
    },
    {
      id: "pk", label: "PK%", title: "Penalty Kill Percentage", group: "specialTeams",
      value: row => row.stats?.penaltyKillPct,
      format: value => TeamsComponent.formatPercent(value)
    },
    TeamsComponent.metricColumn("specialTeams", "STD/GP", "specialTeams"),
    {
      id: "fo", label: "FO%", title: "Faceoff Win Percentage", group: "specialTeams",
      value: row => row.stats?.faceoffWinPct,
      format: value => TeamsComponent.formatPercent(value)
    },
    TeamsComponent.metricColumn("corsi", "CF%", "possession"),
    TeamsComponent.metricColumn("fenwick", "FF%", "possession"),
    {
      id: "xg", label: "xGF%", title: TeamsComponent.expectedGoalsDescription, group: "possession",
      needsExpectedGoals: true,
      value: row => row.expectedGoalsShare,
      format: value => TeamsComponent.formatPercent(value)
    },
    TeamsComponent.metricColumn("shotShare", "SF%", "possession"),
    // The 5v5 header says it, so the labels don't
    TeamsComponent.metricColumn("goalShare5v5", "GF%", "fiveOnFive"),
    TeamsComponent.metricColumn("shooting5v5", "SH%", "fiveOnFive"),
    TeamsComponent.metricColumn("save5v5", "SV%", "fiveOnFive"),
    TeamsComponent.metricColumn("pdo", "PDO", "fiveOnFive")
  ];

  /** The season, like 20262027. Undefined until the standings load. */
  public season: number;

  /** Every team's row, in the table's order. */
  public rows: TeamTableRow[] = [];

  public sortColumn: TeamTableColumn = TeamsComponent.getColumn(TeamsComponent.defaultSortId);

  public sortDirection: SortDirection = "descending";

  /** The section shown on a narrower screen, beside the team and its power rating. */
  public selectedSection: TeamTableColumnGroup = TeamsComponent.defaultSectionId;

  public readonly sections: TeamTableSection[] = TeamsComponent.sections;

  public isLoading: boolean = true;

  public hasError: boolean = false;

  /** Whether NST's xG came back, so the xGF% column is shown and NST is credited. */
  public hasExpectedGoals: boolean = false;

  /** Whether the season's games failed, so the rating and advanced columns are empty. */
  public hasRatingError: boolean = false;

  public readonly nstUrl: string = NstStatsUtils.teamTableUrl;

  /** The logo box's size in px, like the standings' logos. Phones shrink it in the stylesheet. */
  public readonly logoSize: number = 32;

  private teamStats: TeamSeasonStats[] = [];

  private ratings: TeamRating[] = [];

  private nstTeams: NstTeamSeasonStats[] = [];

  /**
   * Whether the app's phone menu is shown. It slides off the screen while the page scrolls down, and the sticky
   * scrollbar follows it down, so it doesn't float above an empty strip.
   */
  public isMobileMenuShown: boolean = true;

  /** The table's scroll container, which scrolls sideways with its own scrollbar hidden. */
  private tableScroll: HTMLElement;

  /** The scrollbar under the table that sticks to the bottom of the screen, kept in step with tableScroll. */
  private stickyScrollbar: HTMLElement;

  private resizeObserver: ResizeObserver;

  private scrollDirectionSubscription: Subscription;

  private readonly onTableScroll = () => TeamsComponent.syncScroll(this.tableScroll, this.stickyScrollbar);

  private readonly onScrollbarScroll = () => TeamsComponent.syncScroll(this.stickyScrollbar, this.tableScroll);

  constructor(private activatedRoute: ActivatedRoute,
              private location: Location,
              private ngZone: NgZone,
              private nhlStatsApiService: NhlStatsApiService,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService,
              private naturalStatTrickService: NaturalStatTrickService,
              private scrollDirectionService: ScrollDirectionService) {}

  @ViewChild("tableScroll")
  public set tableScrollRef(ref: ElementRef<HTMLElement>) {
    this.tableScroll = ref?.nativeElement;
    this.attachStickyScrollbar();
  }

  @ViewChild("stickyScrollbar")
  public set stickyScrollbarRef(ref: ElementRef<HTMLElement>) {
    this.stickyScrollbar = ref?.nativeElement;
    this.attachStickyScrollbar();
  }

  /** The season as shown, like "2026-2027". */
  public get seasonLabel(): string {
    return this.season ? DateTimeUtils.getNhlSeasonDisplayValue(String(this.season)) : "";
  }

  /** The columns shown: xGF% only once NST answers. */
  public get visibleColumns(): TeamTableColumn[] {
    return TeamsComponent.columns.filter(column => !column.needsExpectedGoals || this.hasExpectedGoals);
  }

  /** The header's top row: an empty cell over the team and rating columns, then each group over its columns. */
  public get headerGroups(): TeamTableHeaderGroup[] {
    const groups: TeamTableHeaderGroup[] = [];
    let lastGroup: TeamTableColumnGroup;
    this.visibleColumns.forEach(column => {
      if (column.group && column.group === lastGroup) {
        groups[groups.length - 1].span++;
      } else {
        groups.push({label: column.group ? TeamsComponent.getSection(column.group).label : "", span: 1});
      }
      lastGroup = column.group;
    });
    return groups;
  }

  /**
   * Reads the sort from the URL, and loads the standings' season and then the season's stats.
   */
  public ngOnInit(): void {
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      const column = TeamsComponent.getColumn(params.get("sort")) ?? TeamsComponent.getColumn(TeamsComponent.defaultSortId);
      const order = params.get("order");
      this.sortColumn = column;
      this.sortDirection = order === "asc" ? "ascending" : order === "desc" ? "descending"
          : TeamsComponent.getDefaultDirection(column);
      this.selectedSection = TeamsComponent.getSection(params.get("section"))?.id
          ?? TeamsComponent.getDefaultSectionId(column);
      this.sortRows();
    });
    this.scrollDirectionSubscription = this.scrollDirectionService.scrollingUp$
        .subscribe(scrollingUp => this.isMobileMenuShown = scrollingUp);
    this.retrieveSeason();
  }

  public ngOnDestroy(): void {
    this.scrollDirectionSubscription?.unsubscribe();
    this.detachStickyScrollbar();
  }

  /**
   * Sorts by a column and saves the sort in the URL. A second click on the sorted column reverses it; another column
   * starts with its best value first. Teams without a value stay at the bottom either way.
   */
  public sortBy(column: TeamTableColumn): void {
    if (this.sortColumn?.id === column.id) {
      this.sortDirection = this.sortDirection === "descending" ? "ascending" : "descending";
    } else {
      this.sortColumn = column;
      this.sortDirection = TeamsComponent.getDefaultDirection(column);
    }
    // On a wide screen every column shows, so the section follows the sort, for when the screen narrows
    this.selectedSection = column.group ?? this.selectedSection;
    this.sortRows();
    this.saveTableToUrl();
  }

  /**
   * Shows another section of stats on a narrower screen, and saves it in the URL. A sort by a column the section
   * doesn't show goes back to the power rating, so the order is never by a hidden column.
   */
  public selectSection(section: TeamTableSection): void {
    if (section.id === this.selectedSection) {
      return;
    }
    this.selectedSection = section.id;
    if (!this.isInSection(this.sortColumn)) {
      this.sortColumn = TeamsComponent.getColumn(TeamsComponent.defaultSortId);
      this.sortDirection = TeamsComponent.getDefaultDirection(this.sortColumn);
      this.sortRows();
    }
    this.saveTableToUrl();
  }

  /**
   * Whether a column shows on a narrower screen: the power rating always, and the selected section's columns. A wide
   * screen shows every column (the CSS only hides the others below $small-display-breakpoint).
   */
  public isInSection(column: TeamTableColumn): boolean {
    return !column.group || column.group === this.selectedSection;
  }

  /** The column's aria-sort, only on the sorted column. */
  public getAriaSort(column: TeamTableColumn): string {
    return this.sortColumn?.id === column.id ? this.sortDirection : null;
  }

  /** A cell's text, or a dash without a value. */
  public formatCell(column: TeamTableColumn, row: TeamTableRow): string {
    const value = column.value(row);
    return value === null || value === undefined || isNaN(value) ? "-" : column.format(value);
  }

  /** The power rating badge's color, at the team thresholds. */
  public getRatingColor(row: TeamTableRow): string {
    return TeamRatingUtils.getRatingColor(row.rating?.rating);
  }

  /** Whether a column starts a header group, so it gets a divider on its left. */
  public isGroupStart(column: TeamTableColumn): boolean {
    const columns = this.visibleColumns;
    const index = columns.indexOf(column);
    return index > 0 && column.group !== columns[index - 1].group;
  }

  public trackTeam(index: number, row: TeamTableRow): number {
    return row.teamId;
  }

  public trackColumn(index: number, column: TeamTableColumn): string {
    return column.id;
  }

  /**
   * Loads the season from the standings, then every team's stats, games and NST xG of that season at once. The table
   * shows when the stats and the games are both back, so it opens in the power rating's order; either one alone is
   * enough for a table.
   */
  private retrieveSeason(): void {
    this.isLoading = true;
    this.hasError = false;
    this.nhlStandingAndPlayoffService.getNhlStandings(NhlStandingsTypeEnum.BY_LEAGUE).then(standings => {
      const season = standings?.[0]?.teams?.[0]?.seasonId;
      if (!season) {
        this.isLoading = false;
        this.hasError = true;
        return;
      }
      this.season = season;
      this.retrieveSeasonStats(season);
    }).catch(() => {
      // The service logs the error. Without a season there's nothing to ask for
      this.isLoading = false;
      this.hasError = true;
    });
  }

  private retrieveSeasonStats(season: number): void {
    const teamStats = this.nhlStatsApiService.getTeamStats(season).then(stats => {
      this.teamStats = stats;
      return true;
    }).catch(() => {
      // The service logs the error. The rating's totals fill in the record and per game columns
      this.teamStats = [];
      return false;
    });
    const games = this.nhlStatsApiService.getTeamGames(season).then((seasonGames: TeamGameStats[]) => {
      this.ratings = TeamRatingUtils.getLeagueRatings(seasonGames);
      return true;
    }).catch(() => {
      // The service logs the error. The table goes without the rating and the advanced stats
      this.ratings = [];
      this.hasRatingError = true;
      return false;
    });
    Promise.all([teamStats, games]).then(([hasStats, hasGames]) => {
      this.isLoading = false;
      this.hasError = !hasStats && !hasGames;
      this.buildRows();
    });
    this.naturalStatTrickService.getTeamStats(season).then(teams => {
      this.nstTeams = teams;
      if (!this.isLoading) {
        this.buildRows();
      }
    }).catch(() => {
      // The service logs the error. The table goes without the xGF% column
    });
  }

  /**
   * Builds a row for every team in the stats or the ratings, with NST's xG when it's back, and sorts them.
   */
  private buildRows(): void {
    const expectedGoals = NstStatsUtils.getTeamExpectedGoalsShares(this.nstTeams);
    const teamIds = new Set<number>([
      ...this.teamStats.map(stats => stats.teamId),
      ...this.ratings.map(rating => rating.teamId)
    ]);
    this.rows = [...teamIds].map(teamId => {
      const team = NhlTeamUtils.getTeam(teamId);
      const stats = this.teamStats.find(item => item.teamId === teamId);
      return {
        teamId,
        name: team?.id === teamId ? team.name : stats?.teamFullName ?? "",
        triCode: team?.id === teamId ? team.triCode : "",
        stats,
        rating: this.ratings.find(rating => rating.teamId === teamId),
        expectedGoalsShare: expectedGoals.get(teamId)?.share
      };
    });
    this.hasExpectedGoals = this.rows.some(row => row.expectedGoalsShare !== undefined);
    this.sortRows();
  }

  /**
   * Sorts the rows by the sorted column and direction. Missing values go last, and ties go to the better power rating,
   * then points %, then the name, so the order doesn't jump around.
   */
  private sortRows(): void {
    const column = this.sortColumn;
    const sign = this.sortDirection === "ascending" ? 1 : -1;
    const isMissing = (value: number) => value === null || value === undefined || isNaN(value);
    const ratingColumn = TeamsComponent.getColumn("rating");
    const pointsColumn = TeamsComponent.getColumn("ptsPct");
    this.rows = [...this.rows].sort((rowA, rowB) => {
      const valueA = column.value(rowA);
      const valueB = column.value(rowB);
      if (isMissing(valueA) !== isMissing(valueB)) {
        return isMissing(valueA) ? 1 : -1;
      }
      if (!isMissing(valueA) && valueA !== valueB) {
        return (valueA - valueB) * sign;
      }
      return TeamsComponent.compareDescending(ratingColumn.value(rowA), ratingColumn.value(rowB))
          || TeamsComponent.compareDescending(pointsColumn.value(rowA), pointsColumn.value(rowB))
          || rowA.name.localeCompare(rowB.name);
    });
  }

  /**
   * Writes the sort and the section to the URL, leaving out the defaults. It doesn't go through the router, which would
   * scroll to the top and add a history entry per click, so the back button still leaves the page. The history state is
   * kept, since the back buttons and the scroll restoration need the router's page ID in it (like the team page's tabs).
   */
  private saveTableToUrl(): void {
    const [path, query] = this.location.path().split("?");
    const params = new URLSearchParams(query);
    const isDefaultColumn = this.sortColumn.id === TeamsComponent.defaultSortId;
    const isDefaultDirection = this.sortDirection === TeamsComponent.getDefaultDirection(this.sortColumn);
    const isDefaultSection = this.selectedSection === TeamsComponent.getDefaultSectionId(this.sortColumn);
    const values: {[name: string]: string} = {
      sort: isDefaultColumn ? null : this.sortColumn.id,
      order: isDefaultDirection ? null : this.sortDirection === "ascending" ? "asc" : "desc",
      section: isDefaultSection ? null : this.selectedSection
    };
    Object.entries(values).forEach(([name, value]) => {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
    });
    this.location.replaceState(path, params.toString(), this.location.getState());
  }

  /**
   * Keeps the sticky scrollbar in step with the table once both are on the page (they're shown together): each one's
   * scroll moves the other, and its content is as wide as the table, so both scroll the same distance. The listeners
   * run outside Angular's zone, so scrolling doesn't run change detection on every frame. Called again when either goes
   * away, which detaches it.
   */
  private attachStickyScrollbar(): void {
    this.detachStickyScrollbar();
    const table = this.tableScroll;
    const scrollbar = this.stickyScrollbar;
    if (!table || !scrollbar) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      table.addEventListener("scroll", this.onTableScroll, {passive: true});
      scrollbar.addEventListener("scroll", this.onScrollbarScroll, {passive: true});
      // The table widens when the xGF% column comes in, and the container with the window
      this.resizeObserver = new ResizeObserver(() => this.updateStickyScrollbar());
      this.resizeObserver.observe(table);
      if (table.firstElementChild) {
        this.resizeObserver.observe(table.firstElementChild);
      }
    });
    this.updateStickyScrollbar();
  }

  private detachStickyScrollbar(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.tableScroll?.removeEventListener("scroll", this.onTableScroll);
    this.stickyScrollbar?.removeEventListener("scroll", this.onScrollbarScroll);
  }

  /**
   * Sizes the sticky scrollbar's content to the table's width, and shows the scrollbar only while the table is wider
   * than the card. Writes the DOM directly, since it runs from the ResizeObserver, outside Angular's zone.
   */
  private updateStickyScrollbar(): void {
    const table = this.tableScroll;
    const scrollbar = this.stickyScrollbar;
    if (!table || !scrollbar) {
      return;
    }
    (scrollbar.firstElementChild as HTMLElement).style.width = table.scrollWidth + "px";
    scrollbar.classList.toggle("overflowing", table.scrollWidth > table.clientWidth + 1);
    TeamsComponent.syncScroll(table, scrollbar);
  }

  /**
   * Scrolls one element to another's sideways position. A position that's already the same is left alone, so the two
   * scroll listeners don't keep setting each other.
   */
  private static syncScroll(from: HTMLElement, to: HTMLElement): void {
    if (from && to && Math.abs(to.scrollLeft - from.scrollLeft) >= 1) {
      to.scrollLeft = from.scrollLeft;
    }
  }

  /** A section by ID, or undefined for an unknown one. */
  public static getSection(id: string): TeamTableSection {
    return TeamsComponent.sections.find(section => section.id === id);
  }

  /** The section shown without a section query parameter: the sorted column's, or Record for the power rating. */
  private static getDefaultSectionId(sortColumn: TeamTableColumn): TeamTableColumnGroup {
    return sortColumn?.group ?? TeamsComponent.defaultSectionId;
  }

  /** A column by ID, or undefined for an unknown one. */
  public static getColumn(id: string): TeamTableColumn {
    return TeamsComponent.columns.find(column => column.id === id);
  }

  /** The direction a column sorts in first: its best value first. */
  private static getDefaultDirection(column: TeamTableColumn): SortDirection {
    return column.lowerIsBetter ? "ascending" : "descending";
  }

  /** Higher first, with a missing value last. */
  private static compareDescending(valueA: number, valueB: number): number {
    return (valueB ?? -Infinity) - (valueA ?? -Infinity) || 0;
  }

  /** A count of the record, from the stats API row or else the rating's totals. */
  private static countColumn(id: string, label: string, title: string, field: keyof TeamSeasonStats,
                             totalsField: "gamesPlayed" | "wins" | "losses" | "otLosses" | "points",
                             lowerIsBetter: boolean = false): TeamTableColumn {
    return {
      id, label, title, group: "record", lowerIsBetter,
      value: row => (row.stats?.[field] as number) ?? row.rating?.totals[totalsField],
      format: value => value.toString()
    };
  }

  /** An advanced stat of the power rating (TeamRatingUtils.metrics). */
  private static metricColumn(id: TeamMetricId, label: string, group: TeamTableColumnGroup): TeamTableColumn {
    const metric = TeamRatingUtils.getMetric(id);
    return {
      id, label, title: metric.label + ": " + metric.description, group,
      value: row => row.rating?.values[id],
      format: value => metric.format(value)
    };
  }

  /** A total per game played, or undefined without games. */
  private static perGame(row: TeamTableRow, total: number): number {
    const gamesPlayed = row.rating?.gamesPlayed;
    return total === undefined || !gamesPlayed ? undefined : total / gamesPlayed;
  }

  /** A share from 0 to 1 like "48.7%". */
  private static formatPercent(value: number): string {
    return (value * 100).toFixed(1) + "%";
  }
}
