import {GoalieStatsLeaders, SkaterStatsLeaders, StatsLeader} from "@shared/models/nhl-web-api/stats-leaders.model";
import {GoalieSeasonStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {HitsAndShotsLeaders} from "@shared/models/nhl-stats-api/leaders.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {StatsUtils} from "@shared/utils/stats-utils";
import {SavePercentagePipe} from "@shared/pipes/save-percentage.pipe";
import {GoalsAgainstAveragePipe} from "@shared/pipes/goals-against-average.pipe";

/**
 * How a stat is shown: a whole number ("138"), a plus/minus ("+43"), a decimal ("1.71"), a percentage from 0 to 1
 * ("19.0"), a save percentage (".921"), a goals against average ("2.02"), a time on ice in seconds ("27:44") or text
 * as is ("C").
 */
export type StatFormat = "number" | "plusMinus" | "decimal" | "percentage" | "savePctg" | "gaa" | "toi" | "text";

/**
 * Where a category's leaders come from: the NHL web API's skater or goalie leaders, which carry the NHL's own
 * qualification rules, or the stats API's hits and shots leaders (NhlStatsApiService.getHitsAndShotsLeaders), since
 * the web API has no such categories.
 */
export type StatLeadersSource = "skaterLeaders" | "goalieLeaders" | "hitsAndShots";

/**
 * A field of a stats API season row, skater or goalie.
 */
export type SeasonStatsField = keyof (SkaterSeasonStats & GoalieSeasonStats);

/**
 * One column of a category's top 25 table.
 */
export interface StatColumn {
  /** The header, like "P". */
  label: string;
  /** What the header stands for, like "Points". */
  title: string;
  /** The stats API field the values come from. */
  field: SeasonStatsField;
  format: StatFormat;
  /** Whether the column is shown on a phone. The category's own stat always is. */
  showOnPhone: boolean;
}

/**
 * One stat of the stats page: a top 5 card there, and a top 25 table of its own at /stats/{id}.
 */
export interface StatCategory {
  /** The route of its table, like "save-percentage". */
  id: string;
  title: string;
  source: StatLeadersSource;
  /** The category the leaders are asked for and read from: the web API's ("savePctg") or "hits" / "shots". */
  leaderCategory: string;
  format: StatFormat;
  isGoalie: boolean;
  /** The column of the category's own stat, which the table is sorted by. */
  field: SeasonStatsField;
  /** The table's columns, the category's own stat among them. The table shows it last (getTableColumns). */
  columns: StatColumn[];
}

/**
 * One leader of a category, from either source. The team name, logo and color come from the team ID, so both
 * sources only need the team the player leads for.
 */
export interface LeaderboardEntry {
  playerId: number;
  /** The full name, like "Connor McDavid". */
  name: string;
  /** The NHL team ID, or undefined for an abbreviation NhlTeamUtils doesn't know. */
  teamId: number;
  headshot: string;
  value: number;
}

/**
 * The stats page's categories: their leaders, how their values are shown, and the columns of their top 25 tables.
 */
export class StatCategoryUtils {

  /** The number of leaders in a category's table, the most either source gives. */
  public static readonly tableLeaderCount = 25;

  private static readonly gamesPlayed: StatColumn =
      {label: "GP", title: "Games played", field: "gamesPlayed", format: "number", showOnPhone: true};

  private static readonly goals: StatColumn =
      {label: "G", title: "Goals", field: "goals", format: "number", showOnPhone: true};

  private static readonly assists: StatColumn =
      {label: "A", title: "Assists", field: "assists", format: "number", showOnPhone: true};

  private static readonly points: StatColumn =
      {label: "P", title: "Points", field: "points", format: "number", showOnPhone: true};

  private static readonly plusMinus: StatColumn =
      {label: "+/-", title: "Plus/minus", field: "plusMinus", format: "plusMinus", showOnPhone: false};

  private static readonly pointsPerGame: StatColumn =
      {label: "P/GP", title: "Points per game", field: "pointsPerGame", format: "decimal", showOnPhone: false};

  private static readonly shots: StatColumn =
      {label: "SOG", title: "Shots on goal", field: "shots", format: "number", showOnPhone: true};

  private static readonly shootingPct: StatColumn =
      {label: "S%", title: "Shooting percentage", field: "shootingPct", format: "percentage", showOnPhone: true};

  private static readonly gamesStarted: StatColumn =
      {label: "GS", title: "Games started", field: "gamesStarted", format: "number", showOnPhone: false};

  private static readonly wins: StatColumn =
      {label: "W", title: "Wins", field: "wins", format: "number", showOnPhone: true};

  private static readonly savePct: StatColumn =
      {label: "SV%", title: "Save percentage", field: "savePct", format: "savePctg", showOnPhone: true};

  private static readonly goalsAgainstAverage: StatColumn =
      {label: "GAA", title: "Goals against average", field: "goalsAgainstAverage", format: "gaa", showOnPhone: true};

  private static readonly shutouts: StatColumn =
      {label: "SO", title: "Shutouts", field: "shutouts", format: "number", showOnPhone: false};

  /**
   * The categories in the stats page's order.
   */
  public static readonly categories: StatCategory[] = [
    {
      id: "points", title: "Points", source: "skaterLeaders", leaderCategory: "points", format: "number",
      isGoalie: false, field: "points",
      columns: [StatCategoryUtils.gamesPlayed, StatCategoryUtils.goals, StatCategoryUtils.assists,
        StatCategoryUtils.points, StatCategoryUtils.plusMinus, StatCategoryUtils.pointsPerGame]
    },
    {
      id: "goals", title: "Goals", source: "skaterLeaders", leaderCategory: "goals", format: "number",
      isGoalie: false, field: "goals",
      columns: [StatCategoryUtils.gamesPlayed, StatCategoryUtils.goals, StatCategoryUtils.shots,
        StatCategoryUtils.shootingPct,
        {label: "PPG", title: "Power play goals", field: "ppGoals", format: "number", showOnPhone: false},
        {label: "GWG", title: "Game-winning goals", field: "gameWinningGoals", format: "number", showOnPhone: false}]
    },
    {
      id: "assists", title: "Assists", source: "skaterLeaders", leaderCategory: "assists", format: "number",
      isGoalie: false, field: "assists",
      columns: [StatCategoryUtils.gamesPlayed, StatCategoryUtils.assists, StatCategoryUtils.goals,
        StatCategoryUtils.points, StatCategoryUtils.pointsPerGame]
    },
    {
      id: "save-percentage", title: "Save Percentage", source: "goalieLeaders", leaderCategory: "savePctg",
      format: "savePctg", isGoalie: true, field: "savePct",
      columns: [StatCategoryUtils.gamesPlayed, StatCategoryUtils.gamesStarted, StatCategoryUtils.wins,
        StatCategoryUtils.savePct, StatCategoryUtils.goalsAgainstAverage,
        {label: "SA", title: "Shots against", field: "shotsAgainst", format: "number", showOnPhone: false},
        StatCategoryUtils.shutouts]
    },
    {
      id: "goals-against-average", title: "Goals Against Average", source: "goalieLeaders",
      leaderCategory: "goalsAgainstAverage", format: "gaa", isGoalie: true, field: "goalsAgainstAverage",
      columns: [StatCategoryUtils.gamesPlayed, StatCategoryUtils.gamesStarted, StatCategoryUtils.wins,
        StatCategoryUtils.goalsAgainstAverage, StatCategoryUtils.savePct, StatCategoryUtils.shutouts]
    },
    {
      id: "wins", title: "Wins", source: "goalieLeaders", leaderCategory: "wins", format: "number", isGoalie: true,
      field: "wins",
      columns: [StatCategoryUtils.gamesPlayed, StatCategoryUtils.gamesStarted, StatCategoryUtils.wins,
        {label: "L", title: "Losses", field: "losses", format: "number", showOnPhone: true},
        {label: "OTL", title: "Overtime losses", field: "otLosses", format: "number", showOnPhone: true},
        {...StatCategoryUtils.savePct, showOnPhone: false},
        {...StatCategoryUtils.goalsAgainstAverage, showOnPhone: false}]
    },
    {
      id: "shots", title: "Shots", source: "hitsAndShots", leaderCategory: "shots", format: "number", isGoalie: false,
      field: "shots",
      columns: [StatCategoryUtils.gamesPlayed, StatCategoryUtils.shots, StatCategoryUtils.goals,
        StatCategoryUtils.shootingPct]
    },
    {
      id: "hits", title: "Hits", source: "hitsAndShots", leaderCategory: "hits", format: "number", isGoalie: false,
      field: "hits",
      columns: [StatCategoryUtils.gamesPlayed,
        {label: "Hits", title: "Hits", field: "hits", format: "number", showOnPhone: true},
        {label: "BLK", title: "Blocked shots", field: "blockedShots", format: "number", showOnPhone: true},
        {label: "TK", title: "Takeaways", field: "takeaways", format: "number", showOnPhone: true},
        {label: "GV", title: "Giveaways", field: "giveaways", format: "number", showOnPhone: false}]
    },
    {
      id: "time-on-ice", title: "Time On Ice Per Game", source: "skaterLeaders", leaderCategory: "toi",
      format: "toi", isGoalie: false, field: "timeOnIcePerGame",
      columns: [{label: "Pos", title: "Position", field: "positionCode", format: "text", showOnPhone: true},
        StatCategoryUtils.gamesPlayed,
        {label: "TOI/GP", title: "Time on ice per game", field: "timeOnIcePerGame", format: "toi", showOnPhone: true},
        StatCategoryUtils.points, StatCategoryUtils.plusMinus]
    }
  ];

  private static readonly savePercentagePipe = new SavePercentagePipe();

  private static readonly goalsAgainstAveragePipe = new GoalsAgainstAveragePipe();

  /**
   * Gets a category by the id in its route, like "save-percentage". Undefined for an unknown one.
   */
  public static getCategory(id: string): StatCategory {
    return StatCategoryUtils.categories.find(category => category.id === id);
  }

  /**
   * Gets a category's table columns in the order they're shown: the related stats in their order, then the category's
   * own stat as the far right column.
   */
  public static getTableColumns(category: StatCategory): StatColumn[] {
    const columns = category?.columns ?? [];
    return [
      ...columns.filter(column => column.field !== category.field),
      ...columns.filter(column => column.field === category.field)
    ];
  }

  /**
   * Formats a stat for display. Save percentages and goals against averages use the same pipes as the rest of the
   * site, and a time on ice comes in seconds (1664.2568 for 27:44). A missing value is "-".
   *
   * @param value - The value, like 1.71052 for a decimal or 0.19047 for a percentage.
   * @param format - How the stat is shown.
   */
  public static formatValue(value: number | string, format: StatFormat): string {
    if (value == null || value === "") {
      return "-";
    }
    if (typeof value === "string") {
      return value;
    }
    switch (format) {
      case "plusMinus":
        return value > 0 ? "+" + value : String(value);
      case "decimal":
        return value.toFixed(2);
      case "percentage":
        return (value * 100).toFixed(1);
      case "savePctg":
        return StatCategoryUtils.savePercentagePipe.transform(value);
      case "gaa":
        return StatCategoryUtils.goalsAgainstAveragePipe.transform(value);
      case "toi":
        return StatsUtils.formatSeconds(value);
      default:
        return String(value);
    }
  }

  /**
   * Gets the rank of each value of a sorted leaderboard, like ["1", "2", "T-3", "T-3", "5"]. Equal values share the
   * rank of the first of them, with a "T-" for the tie. A missing value has its own rank.
   *
   * @param values - The leaders' values, best first.
   */
  public static getRankLabels(values: number[]): string[] {
    return (values ?? []).map((value, index) => {
      if (value == null) {
        return String(index + 1);
      }
      const firstIndex = values.indexOf(value);
      const isTied = firstIndex !== index || values.indexOf(value, index + 1) !== -1;
      return (isTied ? "T-" : "") + (firstIndex + 1);
    });
  }

  /**
   * The web API categories of one source, in the stats page's order, like ["points", "goals", "assists", "toi"].
   */
  public static getLeaderCategories(source: "skaterLeaders" | "goalieLeaders"): string[] {
    return StatCategoryUtils.categories.filter(category => category.source === source)
        .map(category => category.leaderCategory);
  }

  /**
   * Gets a category's leaders, best first, from the response of its source. A source that failed (null), or a
   * category it has no leaders for, gives an empty list.
   *
   * @param category - The category.
   * @param skaters - The NHL web API's skater leaders.
   * @param goalies - The NHL web API's goalie leaders.
   * @param hitsAndShots - The stats API's hits and shots leaders.
   * @param season - The season ID, for the headshots of the stats API's rows.
   */
  public static getEntries(category: StatCategory, skaters: SkaterStatsLeaders, goalies: GoalieStatsLeaders,
                           hitsAndShots: HitsAndShotsLeaders, season: number): LeaderboardEntry[] {
    switch (category.source) {
      case "skaterLeaders":
        return StatCategoryUtils.toLeaderEntries(skaters?.[category.leaderCategory as keyof SkaterStatsLeaders]);
      case "goalieLeaders":
        return StatCategoryUtils.toLeaderEntries(goalies?.[category.leaderCategory as keyof GoalieStatsLeaders]);
      default: {
        const field = category.leaderCategory as "hits" | "shots";
        return StatCategoryUtils.toStatsApiEntries(hitsAndShots?.[field], field, season);
      }
    }
  }

  /**
   * Converts NHL web API leaders, which bring their own headshot and a team abbreviation.
   */
  public static toLeaderEntries(leaders: StatsLeader[]): LeaderboardEntry[] {
    return (leaders ?? []).map(leader => ({
      playerId: leader.id,
      name: (leader.firstName?.default ?? "") + " " + (leader.lastName?.default ?? ""),
      teamId: NhlTeamUtils.getTeamIdByAbbrev(leader.teamAbbrev),
      headshot: leader.headshot,
      value: leader.value
    }));
  }

  /**
   * Converts stats API rows, which have no headshot and list every team of the season ("CGY,VAN"). The headshot is
   * built from the player's last team of that season.
   *
   * @param rows - The hits or shots leaders.
   * @param field - The field the rows are the leaders of.
   * @param season - The season ID, for a row without one.
   */
  public static toStatsApiEntries(rows: SkaterSeasonStats[], field: "hits" | "shots",
                                  season: number): LeaderboardEntry[] {
    return (rows ?? []).map(row => {
      const teamAbbrev = row.teamAbbrevs?.split(",").pop()?.trim();
      return {
        playerId: row.playerId,
        name: row.skaterFullName,
        teamId: NhlTeamUtils.getTeamIdByAbbrev(teamAbbrev),
        headshot: NhlPlayerHeadshotUtils.getHeadshotUrl(row.seasonId ?? season, teamAbbrev, row.playerId),
        value: row[field]
      };
    });
  }
}
