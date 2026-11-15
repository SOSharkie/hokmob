import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {StatsUtils} from "@shared/utils/stats-utils";

/**
 * A team's stats added up over some games: every count of TeamGameStats, and the games played.
 */
export type TeamStatTotals = {[field in TeamCountField]: number} & {gamesPlayed: number};

/** The fields of TeamGameStats that are counts, so they add up over games. */
export type TeamCountField = Exclude<keyof TeamGameStats, "gameId" | "gameDate" | "teamId" | "opponentTeamId" | "homeRoad">;

export type TeamMetricId = "pointPct" | "goalDiff" | "fenwick" | "specialTeams" | "corsi" | "shotShare" | "goalShare5v5"
    | "shooting5v5" | "save5v5" | "pdo";

/**
 * A team stat worked out from a team's totals: one of the power rating's parts when it has a weight, and a line the
 * rating chart can plot when it has a color. Every metric is better when it's higher.
 */
export interface TeamMetric {
  id: TeamMetricId;
  /** Like "5v5 Fenwick %". */
  label: string;
  /** A short label for the chart's toggles and tooltips, like "Fenwick %". */
  shortLabel: string;
  /** What the stat is, for a tooltip. */
  description: string;
  /** The metric's share of the power rating, from 0 to 1. 0 for a stat that isn't rated. */
  weight: number;
  /** The chart line's color. A metric without one isn't offered in the chart. */
  color?: string;
  /** The stat, or null when the totals can't give it (no shots yet). */
  getValue: (totals: TeamStatTotals) => number;
  /** The stat as shown, like "52.3%" or "+0.45". */
  format: (value: number) => string;
}

/**
 * A team's power rating and stats over some games, with how they compare to the league's.
 */
export interface TeamRating {
  teamId: number;
  gamesPlayed: number;
  totals: TeamStatTotals;
  /** Each metric's value, or null without one. */
  values: Record<TeamMetricId, number>;
  /**
   * Each metric on the rating's 0 to 10 scale: 5 is the league average, and each standard deviation between the teams
   * is TeamRatingUtils.pointsPerDeviation points. 5 without a value.
   */
  scores: Record<TeamMetricId, number>;
  /** Each metric's league rank, 1 for the best, or null without a value. Teams with the same value share a rank. */
  ranks: Record<TeamMetricId, number>;
  /** The power rating, 0 to 10 with 5 for an average team, like a HokMob player rating. */
  rating: number;
  /** The power rating's league rank. */
  rank: number;
}

/**
 * A team's power rating after one of its games, a point of the rating chart.
 */
export interface TeamRatingPoint extends TeamRating {
  /** The day of the game, like "2026-11-14". */
  date: string;
}

/**
 * Options for which games a rating counts.
 */
export interface TeamRatingOptions {
  /** Counts only the games up to this day, like "2026-11-14". */
  throughDate?: string;
  /** Counts only each team's last games, like its last 10. Every game of the season without it. */
  lastGames?: number;
}

/**
 * The HokMob team power rating, and the advanced team stats it's built from, worked out from every team's game by game
 * stats (/api/nhl-stats/team-games). Every stat is compared to the other teams' over the same games: a team's score for
 * a stat is 5 plus 1.5 points per standard deviation it's above the league average, and the rating is the weighted sum
 * of the rated stats' deviations, scaled the same way. So the rating is 0 to 10 like a HokMob player rating, 5 is an
 * average team, and about 2 in 3 teams are between 3.5 and 6.5.
 *
 * The weights were picked by how well a team's rating after 10, 20, 30, 41 and 55 games tracked its points % over the
 * rest of the season, for the 2022-23 to 2025-26 regular seasons: 30% points %, 20% goal differential, 30% 5v5 Corsi %
 * and 20% special teams goal differential correlated 0.52 to 0.67 with it, more than points % alone (0.43 to 0.64) or an
 * even split of five stats. Fenwick (unblocked shot attempts) in place of Corsi tracked the same within noise (0.006
 * better on average), so the rating uses Corsi, like the rest of the site. 5v5 save % and shooting % added nothing, so
 * they're shown but not rated. See "Team power rating" in docs/nhl-api.md.
 *
 * Nothing here is specific to one team, so a league page can rate every team the same way.
 */
export class TeamRatingUtils {

  /** The rating and score of a league average team. */
  public static readonly averageRating = 5;

  /** The highest rating and score, like a HokMob player rating's. The lowest is 0. */
  public static readonly maxRating = 10;

  /** The rating points per standard deviation from the league average. */
  public static readonly pointsPerDeviation = 1.5;

  /** The fewest games a team needs before the chart plots its rating, since a couple of games say little. */
  public static readonly minChartGames = 3;

  /** The fields summed into a team's totals. */
  private static readonly countFields: TeamCountField[] = [
    "wins", "losses", "otLosses", "points", "goalsFor", "goalsAgainst", "shotsFor", "shotsAgainst", "satFor",
    "satAgainst", "usatFor", "usatAgainst", "shots5v5For", "shots5v5Against", "ppGoalsFor", "ppOpportunities",
    "shGoalsAgainst", "ppGoalsAgainst", "timesShorthanded", "shGoalsFor", "goalsFor5v5", "goalsAgainst5v5"
  ];

  /**
   * Every metric, the rated ones first. The colors are the chart's categorical palette (dark mode), in a fixed order,
   * so a metric keeps its color whichever lines are shown.
   */
  public static readonly metrics: TeamMetric[] = [
    {
      id: "pointPct", label: "Points %", shortLabel: "Points %", weight: 0.3, color: "#3987e5",
      description: "The share of the possible standings points the team has earned",
      getValue: totals => TeamRatingUtils.ratio(totals.points, 2 * totals.gamesPlayed),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "goalDiff", label: "Goal Diff / Game", shortLabel: "Goal diff", weight: 0.2, color: "#d95926",
      description: "Goals for minus goals against, per game",
      getValue: totals => TeamRatingUtils.ratio(totals.goalsFor - totals.goalsAgainst, totals.gamesPlayed),
      format: value => TeamRatingUtils.formatSigned(value)
    },
    {
      id: "corsi", label: "5v5 Corsi %", shortLabel: "Corsi %", weight: 0.3, color: "#199e70",
      description: "The team's share of all shot attempts at 5 on 5, blocked ones included, a measure of who controls the play",
      getValue: totals => TeamRatingUtils.ratio(totals.satFor, totals.satFor + totals.satAgainst),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "specialTeams", label: "Special Teams Diff / Game", shortLabel: "Special teams", weight: 0.2, color: "#c98500",
      description: "Power play and short-handed goals for, minus those against, per game",
      getValue: totals => TeamRatingUtils.ratio(
          totals.ppGoalsFor + totals.shGoalsFor - totals.ppGoalsAgainst - totals.shGoalsAgainst, totals.gamesPlayed),
      format: value => TeamRatingUtils.formatSigned(value)
    },
    {
      id: "fenwick", label: "5v5 Fenwick %", shortLabel: "Fenwick %", weight: 0, color: "#d55181",
      description: "The team's share of the unblocked shot attempts at 5 on 5: Corsi without the blocked shots",
      getValue: totals => TeamRatingUtils.ratio(totals.usatFor, totals.usatFor + totals.usatAgainst),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "save5v5", label: "5v5 Save %", shortLabel: "Save %", weight: 0, color: "#0ca30c",
      description: "The share of the opponents' shots on goal saved at 5 on 5",
      getValue: totals => TeamRatingUtils.ratio(totals.shots5v5Against - totals.goalsAgainst5v5, totals.shots5v5Against),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "shooting5v5", label: "5v5 Shooting %", shortLabel: "Shooting %", weight: 0, color: "#9085e9",
      description: "The share of the team's shots on goal that went in at 5 on 5",
      getValue: totals => TeamRatingUtils.ratio(totals.goalsFor5v5, totals.shots5v5For),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "pdo", label: "PDO", shortLabel: "PDO", weight: 0, color: "#e66767",
      description: "5v5 shooting % plus save %. Around 100 is normal; far from it usually doesn't last",
      getValue: totals => {
        const shooting = TeamRatingUtils.ratio(totals.goalsFor5v5, totals.shots5v5For);
        const saves = TeamRatingUtils.ratio(totals.shots5v5Against - totals.goalsAgainst5v5, totals.shots5v5Against);
        return shooting == null || saves == null ? null : (shooting + saves) * 100;
      },
      format: value => value.toFixed(1)
    },
    {
      id: "shotShare", label: "Shots For %", shortLabel: "Shots %", weight: 0,
      description: "The team's share of the shots on goal, in all situations",
      getValue: totals => TeamRatingUtils.ratio(totals.shotsFor, totals.shotsFor + totals.shotsAgainst),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "goalShare5v5", label: "5v5 Goals For %", shortLabel: "Goals %", weight: 0,
      description: "The team's share of the goals scored at 5 on 5",
      getValue: totals => TeamRatingUtils.ratio(totals.goalsFor5v5, totals.goalsFor5v5 + totals.goalsAgainst5v5),
      format: value => TeamRatingUtils.formatPercentage(value)
    }
  ];

  /** The metrics that are part of the power rating. */
  public static get ratedMetrics(): TeamMetric[] {
    return TeamRatingUtils.metrics.filter(metric => metric.weight > 0);
  }

  /** The metrics the rating chart can plot. */
  public static get chartMetrics(): TeamMetric[] {
    return TeamRatingUtils.metrics.filter(metric => metric.color);
  }

  public static getMetric(id: TeamMetricId): TeamMetric {
    return TeamRatingUtils.metrics.find(metric => metric.id === id);
  }

  /**
   * Adds up games' stats. A missing count counts as 0.
   */
  public static getTotals(games: TeamGameStats[]): TeamStatTotals {
    const totals = {gamesPlayed: (games ?? []).length} as TeamStatTotals;
    TeamRatingUtils.countFields.forEach(field => totals[field] = 0);
    (games ?? []).forEach(game => TeamRatingUtils.countFields.forEach(field => totals[field] += game[field] ?? 0));
    return totals;
  }

  /**
   * Rates every team that has played, from its games of the season, or only some of them (see TeamRatingOptions).
   * Sorted best first.
   *
   * @param games - Every team's games of the season, from /api/nhl-stats/team-games.
   * @param options - Which games count.
   */
  public static getLeagueRatings(games: TeamGameStats[], options: TeamRatingOptions = {}): TeamRating[] {
    const gamesByTeam = TeamRatingUtils.groupByTeam((games ?? [])
        .filter(game => !options.throughDate || game.gameDate <= options.throughDate));
    const totals = [...gamesByTeam.entries()].map(([teamId, teamGames]) => ({
      teamId,
      totals: TeamRatingUtils.getTotals(options.lastGames ? teamGames.slice(-options.lastGames) : teamGames)
    }));
    return TeamRatingUtils.rateTeams(totals).sort((teamA, teamB) => teamA.rank - teamB.rank || teamB.rating - teamA.rating);
  }

  /**
   * Each team's power rating after each of its games, oldest first, from its 3rd game (minChartGames) on. Each point
   * rates every team on its games up to that day, so a point is where the team stood that night. With lastGames, each
   * point counts only every team's last games up to that day: the team's form rather than its season.
   *
   * @param games - Every team's games of the season, from /api/nhl-stats/team-games.
   * @param teamIds - The teams to chart.
   * @param options - lastGames, to rate each day on every team's last games only.
   */
  public static getTimeline(games: TeamGameStats[], teamIds: number[],
                            options: TeamRatingOptions = {}): Map<number, TeamRatingPoint[]> {
    const timeline = new Map<number, TeamRatingPoint[]>((teamIds ?? []).map(teamId => [teamId, []]));
    const sortedGames = [...(games ?? [])].sort((gameA, gameB) => gameA.gameDate.localeCompare(gameB.gameDate));
    // Running totals per team, so each day only adds its own games: prefix[n] is the totals of the first n games
    const prefixes = new Map<number, TeamStatTotals[]>();
    let index = 0;
    while (index < sortedGames.length) {
      const date = sortedGames[index].gameDate;
      const playedToday = new Set<number>();
      for (; index < sortedGames.length && sortedGames[index].gameDate === date; index++) {
        const game = sortedGames[index];
        const prefix = prefixes.get(game.teamId) ?? [TeamRatingUtils.getTotals([])];
        prefix.push(TeamRatingUtils.addGame(prefix[prefix.length - 1], game));
        prefixes.set(game.teamId, prefix);
        playedToday.add(game.teamId);
      }
      const chartedToday = [...timeline.keys()].filter(teamId => playedToday.has(teamId)
          && prefixes.get(teamId).length - 1 >= TeamRatingUtils.minChartGames);
      if (!chartedToday.length) {
        continue;
      }
      const ratings = TeamRatingUtils.rateTeams([...prefixes.entries()].map(([teamId, prefix]) => {
        const gamesPlayed = prefix.length - 1;
        const from = options.lastGames ? Math.max(0, gamesPlayed - options.lastGames) : 0;
        return {teamId, totals: TeamRatingUtils.subtractTotals(prefix[gamesPlayed], prefix[from])};
      }));
      chartedToday.forEach(teamId => {
        const rating = ratings.find(item => item.teamId === teamId);
        timeline.get(teamId).push({...rating, date});
      });
    }
    return timeline;
  }

  /**
   * A team's power rating color, in the HokMob rating colors: blue for 7 and up (about the top 10% of teams), green
   * for 5.5 and up, orange for 4 and up, and red below. The thresholds are lower than a player rating's (green from 7),
   * since a team's rating is spread around 5 by design, and most teams would be red on the player thresholds.
   */
  public static getRatingColor(rating: number): string {
    return StatsUtils.getHokmobRatingColor(rating >= 7 ? 8.5 : rating >= 5.5 ? 7 : rating >= 4 ? 6 : 0);
  }

  /**
   * A rating with one decimal, like "6.2", or "-" without one.
   */
  public static formatRating(rating: number): string {
    return rating == null || isNaN(rating) ? "-" : rating.toFixed(1);
  }

  /**
   * A rank with its suffix, like 1 to "1st", 2 to "2nd" and 11 to "11th". Empty without a rank.
   */
  public static getOrdinal(rank: number): string {
    if (rank == null) {
      return "";
    }
    const lastTwoDigits = rank % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return rank + "th";
    }
    switch (rank % 10) {
      case 1:
        return rank + "st";
      case 2:
        return rank + "nd";
      case 3:
        return rank + "rd";
      default:
        return rank + "th";
    }
  }

  /**
   * Rates teams against each other: each metric's score and rank, and the power rating and its rank.
   */
  private static rateTeams(teams: {teamId: number, totals: TeamStatTotals}[]): TeamRating[] {
    const rated = teams.filter(team => team.totals.gamesPlayed > 0).map(team => ({
      teamId: team.teamId,
      gamesPlayed: team.totals.gamesPlayed,
      totals: team.totals,
      values: {} as Record<TeamMetricId, number>,
      scores: {} as Record<TeamMetricId, number>,
      ranks: {} as Record<TeamMetricId, number>,
      rating: TeamRatingUtils.averageRating,
      rank: 1
    }));
    const composites = rated.map(() => 0);
    TeamRatingUtils.metrics.forEach(metric => {
      const values = rated.map(team => TeamRatingUtils.toNumber(metric.getValue(team.totals)));
      const deviations = TeamRatingUtils.getDeviations(values);
      rated.forEach((team, i) => {
        team.values[metric.id] = values[i];
        team.scores[metric.id] = TeamRatingUtils.toScore(deviations[i]);
        team.ranks[metric.id] = TeamRatingUtils.getRank(values[i], values);
        composites[i] += metric.weight * deviations[i];
      });
    });
    // The weighted sum is scaled back to one deviation, so the rating spreads like each stat's score
    const ratingDeviations = TeamRatingUtils.getDeviations(composites);
    rated.forEach((team, i) => team.rating = TeamRatingUtils.toScore(ratingDeviations[i]));
    const ratings = rated.map(team => team.rating);
    rated.forEach(team => team.rank = TeamRatingUtils.getRank(team.rating, ratings));
    return rated;
  }

  /**
   * How many standard deviations each value is from their mean. A missing value, or values that are all the same,
   * count as average (0).
   */
  private static getDeviations(values: number[]): number[] {
    const present = values.filter(value => value != null);
    if (!present.length) {
      return values.map(() => 0);
    }
    const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
    const deviation = Math.sqrt(present.reduce((sum, value) => sum + (value - mean) ** 2, 0) / present.length);
    return values.map(value => value == null || deviation < 1e-9 ? 0 : (value - mean) / deviation);
  }

  private static toScore(deviation: number): number {
    const score = TeamRatingUtils.averageRating + TeamRatingUtils.pointsPerDeviation * deviation;
    return Math.min(TeamRatingUtils.maxRating, Math.max(0, score));
  }

  /**
   * One more than the number of strictly higher values, so equal values share a rank. Null without a value.
   */
  private static getRank(value: number, values: number[]): number {
    if (value == null) {
      return null;
    }
    // Rounded, so float noise can't split a tie
    const rounded = Math.round(value * 1e6);
    return values.filter(other => other != null && Math.round(other * 1e6) > rounded).length + 1;
  }

  private static groupByTeam(games: TeamGameStats[]): Map<number, TeamGameStats[]> {
    const gamesByTeam = new Map<number, TeamGameStats[]>();
    [...games].sort((gameA, gameB) => gameA.gameDate.localeCompare(gameB.gameDate)).forEach(game => {
      const teamGames = gamesByTeam.get(game.teamId) ?? [];
      teamGames.push(game);
      gamesByTeam.set(game.teamId, teamGames);
    });
    return gamesByTeam;
  }

  private static addGame(totals: TeamStatTotals, game: TeamGameStats): TeamStatTotals {
    const sum = {...totals, gamesPlayed: totals.gamesPlayed + 1};
    TeamRatingUtils.countFields.forEach(field => sum[field] += game[field] ?? 0);
    return sum;
  }

  private static subtractTotals(totals: TeamStatTotals, earlier: TeamStatTotals): TeamStatTotals {
    const difference = {gamesPlayed: totals.gamesPlayed - earlier.gamesPlayed} as TeamStatTotals;
    TeamRatingUtils.countFields.forEach(field => difference[field] = totals[field] - earlier[field]);
    return difference;
  }

  /** A ratio, or null when there's nothing to divide by. */
  private static ratio(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : null;
  }

  private static toNumber(value: number): number {
    return value == null || !isFinite(value) ? null : value;
  }

  /** A 0 to 1 share as a percentage with one decimal, like "52.3%". */
  private static formatPercentage(value: number): string {
    return (value * 100).toFixed(1) + "%";
  }

  /** A per game difference with its sign, like "+0.45" or "-0.20". */
  private static formatSigned(value: number): string {
    const rounded = value.toFixed(2);
    return value > 0 && rounded !== "0.00" ? "+" + rounded : rounded === "-0.00" ? "0.00" : rounded;
  }
}
