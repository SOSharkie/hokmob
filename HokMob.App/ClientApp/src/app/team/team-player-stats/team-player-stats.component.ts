import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {SeasonHistoryService} from "@shared/services/season-history.service";
import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {PlayerSeasonRating, PlayerSeasonRatingUtils} from "@shared/utils/player-season-rating-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

/** A skater's or goalie's row, before it's formatted for a column. */
export interface TeamPlayerRow {
  playerId: number;
  name: string;
  /** C, LW, RW, D or G. */
  position: string;
  headshot: string;
  stats: SkaterSeasonStats | GoalieSeasonStats;
  /** The player's rated games for this team, from the season's history file. Undefined without any. */
  rating?: PlayerSeasonRating;
}

/** A column of a player stats table. */
export interface TeamPlayerStatColumn {
  id: string;
  /** The header, like "G". */
  label: string;
  /** The header's tooltip, like "Goals". */
  title: string;
  /** The value the column sorts by. Null or undefined sorts last either way. */
  value: (row: TeamPlayerRow) => number;
  /** The shown value, like "48.7%". */
  format: (row: TeamPlayerRow) => string;
  /** For a stat where less is better (GAA), which then sorts ascending first. */
  lowerIsBetter?: boolean;
  /** For the HokMob rating, shown as a colored badge. */
  isRating?: boolean;
  /** Whether the column needs the season's history file (the rating columns). */
  needsHistory?: boolean;
}

export type SortDirection = "ascending" | "descending";

/** One of the tab's tables, skaters or goalies, with its own sort. */
export interface TeamPlayerStatsTable {
  id: "skaters" | "goalies";
  title: string;
  columns: TeamPlayerStatColumn[];
  rows: TeamPlayerRow[];
  sortColumn: TeamPlayerStatColumn;
  sortDirection: SortDirection;
}

/**
 * The team page's player stats tab: a sortable table of the team's skaters and one of its goalies, with the stats of
 * the player page's season card. Only a traded player's games for this team count. A season with a history file
 * (SeasonHistoryService) also gets the average HokMob rating and a skater's Corsi For % or a goalie's goals saved
 * above average, from the same games.
 */
@Component({
  selector: 'app-team-player-stats',
  templateUrl: './team-player-stats.component.html',
  styleUrls: ['./team-player-stats.component.scss']
})
export class TeamPlayerStatsComponent implements OnChanges {

  @Input()
  public teamId: number;

  /** The season ID, like 20262027. Nothing loads until it's set. */
  @Input()
  public season: number;

  public skaterTable: TeamPlayerStatsTable;

  public goalieTable: TeamPlayerStatsTable;

  public isLoading: boolean = false;

  public hasError: boolean = false;

  /** Whether the season has a history file, so the tables have the rating columns. */
  public hasHistory: boolean = false;

  /** The history file's date through which a season in progress is rated, like "2026-11-08". */
  public ratingThroughDate: string;

  /** The ratings of the team's players, by player ID, once the history file is rated. */
  private teamRatings: Map<number, PlayerSeasonRating>;

  public readonly skaterColumns: TeamPlayerStatColumn[] = [
    TeamPlayerStatsComponent.numberColumn("gp", "GP", "Games Played", row => row.stats.gamesPlayed),
    TeamPlayerStatsComponent.numberColumn("g", "G", "Goals", row => this.skater(row).goals),
    TeamPlayerStatsComponent.numberColumn("a", "A", "Assists", row => this.skater(row).assists),
    TeamPlayerStatsComponent.numberColumn("p", "P", "Points", row => this.skater(row).points),
    TeamPlayerStatsComponent.numberColumn("pm", "+/-", "Plus/Minus", row => this.skater(row).plusMinus),
    TeamPlayerStatsComponent.numberColumn("s", "S", "Shots", row => this.skater(row).shots),
    TeamPlayerStatsComponent.numberColumn("hits", "HIT", "Hits", row => this.skater(row).hits),
    {
      id: "fo", label: "FO%", title: "Faceoff Win Percentage",
      value: row => this.skater(row).faceoffWinPct,
      format: row => TeamPlayerStatsComponent.formatPercent(this.skater(row).faceoffWinPct)
    },
    ...this.ratingColumns(false)
  ];

  public readonly goalieColumns: TeamPlayerStatColumn[] = [
    TeamPlayerStatsComponent.numberColumn("gs", "GS", "Games Started", row => this.goalie(row).gamesStarted),
    TeamPlayerStatsComponent.numberColumn("w", "W", "Wins", row => this.goalie(row).wins),
    TeamPlayerStatsComponent.numberColumn("l", "L", "Losses", row => this.goalie(row).losses),
    TeamPlayerStatsComponent.numberColumn("otl", "OTL", "Overtime Losses", row => this.goalie(row).otLosses),
    {
      id: "svp", label: "SV%", title: "Save Percentage",
      value: row => this.goalie(row).savePct,
      format: row => TeamPlayerStatsComponent.formatSavePct(this.goalie(row).savePct)
    },
    {
      id: "gaa", label: "GAA", title: "Goals Against Average", lowerIsBetter: true,
      value: row => this.goalie(row).goalsAgainstAverage,
      format: row => this.goalie(row).goalsAgainstAverage?.toFixed(2) ?? "-"
    },
    TeamPlayerStatsComponent.numberColumn("so", "SO", "Shutouts", row => this.goalie(row).shutouts),
    TeamPlayerStatsComponent.numberColumn("sa", "SA", "Shots Against", row => this.goalie(row).shotsAgainst),
    ...this.ratingColumns(true)
  ];

  /** The season shown in the tables' titles, like "2026-27". */
  public get seasonLabel(): string {
    return this.season ? DateTimeUtils.getNhlSeasonDisplayValue(this.season.toString()) : "";
  }

  /** The tables that have players, skaters first. */
  public get tables(): TeamPlayerStatsTable[] {
    return [this.skaterTable, this.goalieTable].filter(table => table?.rows.length);
  }

  constructor(private nhlStatsApiService: NhlStatsApiService,
              private seasonHistoryService: SeasonHistoryService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if ((changes['teamId'] || changes['season']) && this.teamId && this.season) {
      this.retrievePlayerStats();
    }
  }

  /**
   * Sorts a table by a column. A second click on the sorted column reverses it; another column starts with its best
   * value first. Players without a value stay at the bottom either way.
   */
  public sortBy(table: TeamPlayerStatsTable, column: TeamPlayerStatColumn): void {
    if (table.sortColumn?.id === column.id) {
      table.sortDirection = table.sortDirection === "descending" ? "ascending" : "descending";
    } else {
      table.sortColumn = column;
      table.sortDirection = column.lowerIsBetter ? "ascending" : "descending";
    }
    TeamPlayerStatsComponent.sortRows(table);
  }

  /** The column's aria-sort, only on the sorted column. */
  public getAriaSort(table: TeamPlayerStatsTable, column: TeamPlayerStatColumn): string {
    return table.sortColumn?.id === column.id ? table.sortDirection : null;
  }

  /** A column header's tooltip. A season in progress is rated through the history file's last day. */
  public getColumnTitle(column: TeamPlayerStatColumn): string {
    if (!column.needsHistory || !this.ratingThroughDate) {
      return column.title;
    }
    const throughDate = new Date(this.ratingThroughDate + "T00:00:00")
        .toLocaleDateString("en-US", {month: "short", day: "numeric"});
    return column.title + ", through " + throughDate;
  }

  /** The columns a table shows: the rating columns only for a season with a history file. */
  public visibleColumns(table: TeamPlayerStatsTable): TeamPlayerStatColumn[] {
    return table.columns.filter(column => !column.needsHistory || this.hasHistory);
  }

  /** The rating badge's color, the same scale as the player page's. */
  public getRatingColor(row: TeamPlayerRow): string {
    return PlayerSeasonRatingUtils.getAverageRatingColor(row.rating?.averageRating);
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public trackPlayer(index: number, row: TeamPlayerRow): number {
    return row.playerId;
  }

  public trackColumn(index: number, column: TeamPlayerStatColumn): string {
    return column.id;
  }

  /**
   * Loads the team's player stats and, for a season with a history file, its ratings. The stats show as soon as they
   * come back; the rating columns show dashes until the file is rated, and go away if it fails.
   */
  private retrievePlayerStats(): void {
    const teamId = this.teamId;
    const season = this.season;
    const isCurrent = () => this.teamId === teamId && this.season === season;
    this.isLoading = true;
    this.hasError = false;
    this.skaterTable = undefined;
    this.goalieTable = undefined;
    this.hasHistory = SeasonHistoryService.seasons.some(option =>
        option.season === season && option.gameType === NhlGameTypeEnum.REGULAR_SEASON);
    this.ratingThroughDate = undefined;
    this.teamRatings = undefined;

    const ratingsPromise = this.hasHistory
        ? this.seasonHistoryService.getSeasonHistory(season, NhlGameTypeEnum.REGULAR_SEASON)
        : Promise.resolve(undefined);

    this.nhlStatsApiService.getTeamPlayerStats(teamId, season, NhlGameTypeEnum.REGULAR_SEASON).then(response => {
      if (!isCurrent()) {
        return;
      }
      const triCode = NhlTeamUtils.getTeam(teamId)?.triCode;
      this.skaterTable = this.createTable("skaters", "Skaters", this.skaterColumns,
          response.skaters.map(skater => TeamPlayerStatsComponent.toRow(skater, skater.skaterFullName,
              TeamPlayerStatsComponent.getPositionLabel(skater.positionCode), season, triCode)), "p");
      this.goalieTable = this.createTable("goalies", "Goalies", this.goalieColumns,
          response.goalies.map(goalie => TeamPlayerStatsComponent.toRow(goalie, goalie.goalieFullName, "G", season,
              triCode)), "gs");
      this.isLoading = false;
    }).catch(() => {
      // The service logs the error. Show the message rather than another team's players
      if (isCurrent()) {
        this.isLoading = false;
        this.hasError = true;
      }
    });

    ratingsPromise.then(ratedSeason => {
      if (!isCurrent() || !ratedSeason) {
        return;
      }
      this.ratingThroughDate = ratedSeason.throughDate;
      // The stats may come back after the file; createTable reads the ratings from here when they do
      this.teamRatings = PlayerSeasonRatingUtils.getTeamSeasonRatings(ratedSeason, teamId);
      this.applyRatings();
    }).catch(() => {
      // The service logs the error. The tables just go without the rating columns
      if (isCurrent()) {
        this.hasHistory = false;
      }
    });
  }

  private createTable(id: "skaters" | "goalies", title: string, columns: TeamPlayerStatColumn[],
                      rows: TeamPlayerRow[], defaultSortId: string): TeamPlayerStatsTable {
    const table: TeamPlayerStatsTable = {
      id,
      title,
      columns,
      rows,
      sortColumn: columns.find(column => column.id === defaultSortId),
      sortDirection: "descending"
    };
    this.applyRatingsTo(table);
    TeamPlayerStatsComponent.sortRows(table);
    return table;
  }

  private applyRatings(): void {
    [this.skaterTable, this.goalieTable].filter(table => table).forEach(table => {
      this.applyRatingsTo(table);
      TeamPlayerStatsComponent.sortRows(table);
    });
  }

  private applyRatingsTo(table: TeamPlayerStatsTable): void {
    if (this.teamRatings) {
      table.rows.forEach(row => row.rating = this.teamRatings.get(row.playerId));
    }
  }

  /** The HokMob rating column, and a skater's Corsi For % or a goalie's goals saved above average. */
  private ratingColumns(isGoalie: boolean): TeamPlayerStatColumn[] {
    const ratingColumn: TeamPlayerStatColumn = {
      id: "rating", label: "Rating", title: "Average HokMob rating", isRating: true, needsHistory: true,
      value: row => row.rating?.averageRating,
      format: row => PlayerSeasonRatingUtils.formatAverageRating(row.rating?.averageRating)
    };
    const secondColumn: TeamPlayerStatColumn = isGoalie ? {
      id: "gsaa", label: "GSAA", title: "Goals saved above an average goalie facing the same shots", needsHistory: true,
      value: row => row.rating?.goalsSavedAboveAverage,
      format: row => PlayerSeasonRatingUtils.formatGoalsSavedAboveAverage(row.rating?.goalsSavedAboveAverage)
    } : {
      id: "cf", label: "CF%", title: "5v5 shot attempts for, out of all shot attempts while on the ice",
      needsHistory: true,
      value: row => row.rating?.corsiForPct,
      format: row => PlayerSeasonRatingUtils.formatCorsiForPct(row.rating?.corsiForPct)
    };
    return [ratingColumn, secondColumn];
  }

  private skater(row: TeamPlayerRow): SkaterSeasonStats {
    return row.stats as SkaterSeasonStats;
  }

  private goalie(row: TeamPlayerRow): GoalieSeasonStats {
    return row.stats as GoalieSeasonStats;
  }

  private static toRow(stats: SkaterSeasonStats | GoalieSeasonStats, name: string, position: string, season: number,
                       triCode: string): TeamPlayerRow {
    return {
      playerId: stats.playerId,
      name,
      position,
      headshot: NhlPlayerHeadshotUtils.getHeadshotUrl(season, triCode, stats.playerId),
      stats
    };
  }

  /** A column of a whole number, shown as it is, or a dash when it's missing. */
  private static numberColumn(id: string, label: string, title: string,
                              value: (row: TeamPlayerRow) => number): TeamPlayerStatColumn {
    return {id, label, title, value, format: row => value(row)?.toString() ?? "-"};
  }

  /**
   * Sorts the rows by the table's column and direction. Missing values go last, and ties go to the player with more
   * games, then by name, so the order doesn't jump around.
   */
  private static sortRows(table: TeamPlayerStatsTable): void {
    const column = table.sortColumn;
    if (!column) {
      return;
    }
    const sign = table.sortDirection === "ascending" ? 1 : -1;
    table.rows.sort((rowA, rowB) => {
      const valueA = column.value(rowA);
      const valueB = column.value(rowB);
      const isMissingA = valueA === null || valueA === undefined;
      const isMissingB = valueB === null || valueB === undefined;
      if (isMissingA !== isMissingB) {
        return isMissingA ? 1 : -1;
      }
      if (!isMissingA && valueA !== valueB) {
        return (valueA - valueB) * sign;
      }
      return (rowB.stats.gamesPlayed - rowA.stats.gamesPlayed) || rowA.name.localeCompare(rowB.name);
    });
  }

  /** A stats API position code as shown: C, LW, RW or D. */
  private static getPositionLabel(positionCode: string): string {
    return positionCode === "L" ? "LW" : positionCode === "R" ? "RW" : positionCode ?? "";
  }

  /** A share from 0 to 1 like "48.7%", or a dash without one (a player who took no faceoffs). */
  private static formatPercent(value: number): string {
    return value === null || value === undefined ? "-" : (value * 100).toFixed(1) + "%";
  }

  /** A save percentage like ".912", or "1.000" for a perfect one, like the player page's. */
  private static formatSavePct(value: number): string {
    if (value === null || value === undefined) {
      return "-";
    }
    return value === 1 ? "1.000" : value.toFixed(3).replace(/^0/, "");
  }
}
