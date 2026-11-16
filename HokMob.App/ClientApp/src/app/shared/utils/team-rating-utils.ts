import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {NstTeamGameStats} from "@shared/models/natural-stat-trick/nst-team-games.model";
import {StatsUtils} from "@shared/utils/stats-utils";

/**
 * A team's stats added up over some games: every count of TeamGameStats, and the games played. The expected goals
 * counts only add up the games that have them.
 */
export type TeamStatTotals = {[field in TeamCountField]-?: number} & {gamesPlayed: number};

/** The fields of TeamGameStats that are counts, so they add up over games. */
export type TeamCountField = Exclude<keyof TeamGameStats, "gameId" | "gameDate" | "teamId" | "opponentTeamId" | "homeRoad">;

export type TeamMetricId = "corsi" | "expectedGoals" | "shooting5v5" | "save5v5" | "powerPlay" | "penaltyDiff"
    | "pointPct" | "goalDiff" | "specialTeams" | "fenwick" | "shotShare" | "goalShare5v5" | "pdo";

/** Each rated metric's share of the power rating, from 0 to 1. A metric that isn't in it isn't rated. */
export type TeamRatingWeights = Partial<Record<TeamMetricId, number>>;

/**
 * A team stat worked out from a team's totals: one of the power rating's parts when the rating's weights have it, and a
 * line the rating chart can plot when it has a color. Every metric is better when it's higher.
 */
export interface TeamMetric {
  id: TeamMetricId;
  /** Like "5v5 Fenwick %". */
  label: string;
  /** A short label for the chart's toggles and tooltips, like "Fenwick %". */
  shortLabel: string;
  /** What the stat is, for a tooltip. */
  description: string;
  /** The chart line's color. A metric without one isn't offered in the chart. */
  color?: string;
  /** The stat, or null when the totals can't give it (no shots yet, or no expected goals). */
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
  /**
   * The weights the rating was worked out with: TeamRatingUtils.expectedGoalsWeights, or TeamRatingUtils.nhlWeights
   * when a team has no expected goals over these games.
   */
  weights: TeamRatingWeights;
  /** Whether the rating counts Natural Stat Trick's expected goals (expectedGoalsWeights). */
  hasExpectedGoals: boolean;
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
 * stats (/api/nhl-stats/team-games), with Natural Stat Trick's expected goals merged in (withExpectedGoals). Every stat
 * is compared to the other teams' over the same games: a team's score for a stat is 5 plus 1.5 points per standard
 * deviation it's above the league average, and the rating is the weighted sum of the rated stats' deviations,
 * scaled the same way. So the rating is 0 to 10 like a HokMob player rating, 5 is an average team, and about 2 in 3
 * teams are between 3.5 and 6.5.
 *
 * The rating is a statistical look at how a team plays, so nothing in it comes from the standings: no points, wins or
 * goal differential. Its weights (expectedGoalsWeights) are 30% 5v5 Corsi %, 15% 5v5 xGF%, 15% 5v5 shooting %, 10% 5v5
 * save %, 20% net power play % and 10% penalty differential. Over games where a team has no expected goals (NST can't
 * be asked, or hasn't got its games yet), every team is rated on the NHL's stats alone (nhlWeights): Corsi takes
 * xGF%'s share. The penalty kill isn't rated: neither its net % nor its expected goals against added anything.
 *
 * The weights were picked by how well a team's rating after 10, 20, 30, 41, 55 and 70 games tracked its strength over
 * every game it played afterwards, the playoffs included and counted double, adjusted for its opponents, for the
 * 2021-22 to 2025-26 seasons. See "Team power rating" in docs/nhl-api.md.
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

  /** The rating's weights when every team has Natural Stat Trick's expected goals. */
  public static readonly expectedGoalsWeights: TeamRatingWeights = {
    corsi: 0.30, expectedGoals: 0.15, shooting5v5: 0.15, save5v5: 0.10, powerPlay: 0.20, penaltyDiff: 0.10
  };

  /** The rating's weights from the NHL's stats alone, the fallback without expected goals. */
  public static readonly nhlWeights: TeamRatingWeights = {
    corsi: 0.45, shooting5v5: 0.15, save5v5: 0.10, powerPlay: 0.20, penaltyDiff: 0.10
  };

  /** The fields summed into a team's totals. */
  private static readonly countFields: TeamCountField[] = [
    "wins", "losses", "otLosses", "points", "goalsFor", "goalsAgainst", "shotsFor", "shotsAgainst", "satFor",
    "satAgainst", "usatFor", "usatAgainst", "shots5v5For", "shots5v5Against", "ppGoalsFor", "ppOpportunities",
    "shGoalsAgainst", "ppGoalsAgainst", "timesShorthanded", "shGoalsFor", "goalsFor5v5", "goalsAgainst5v5",
    "expectedGoalsFor5v5", "expectedGoalsAgainst5v5"
  ];

  /**
   * Every metric: the ones a rating can count first, in the power rating card's order, then the rest. The colors are
   * the chart's categorical palette (dark mode), in a fixed order, so a metric keeps its color whichever lines are shown.
   */
  public static readonly metrics: TeamMetric[] = [
    {
      id: "corsi", label: "5v5 Corsi %", shortLabel: "Corsi %", color: "#199e70",
      description: "The team's share of all shot attempts at 5 on 5, blocked ones included, a measure of who controls the play",
      getValue: totals => TeamRatingUtils.ratio(totals.satFor, totals.satFor + totals.satAgainst),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "expectedGoals", label: "5v5 xGF%", shortLabel: "xGF%", color: "#d55181",
      description: "The team's share of the expected goals at 5 on 5, from Natural Stat Trick: like Fenwick, but each " +
          "unblocked shot attempt counts by how likely it was to score",
      getValue: totals => TeamRatingUtils.ratio(totals.expectedGoalsFor5v5,
          totals.expectedGoalsFor5v5 + totals.expectedGoalsAgainst5v5),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "shooting5v5", label: "5v5 Shooting %", shortLabel: "Shooting %", color: "#9085e9",
      description: "The share of the team's shots on goal that went in at 5 on 5",
      getValue: totals => TeamRatingUtils.ratio(totals.goalsFor5v5, totals.shots5v5For),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "save5v5", label: "5v5 Save %", shortLabel: "Save %", color: "#0ca30c",
      description: "The share of the opponents' shots on goal saved at 5 on 5",
      getValue: totals => TeamRatingUtils.ratio(totals.shots5v5Against - totals.goalsAgainst5v5, totals.shots5v5Against),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "powerPlay", label: "Net Power Play %", shortLabel: "Power play", color: "#c98500",
      description: "Power play goals minus the short-handed goals given up, per power play",
      getValue: totals => TeamRatingUtils.ratio(totals.ppGoalsFor - totals.shGoalsAgainst, totals.ppOpportunities),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "penaltyDiff", label: "Penalty Diff / Game", shortLabel: "Penalties", color: "#e66767",
      description: "Power plays drawn minus times short-handed, per game",
      getValue: totals => TeamRatingUtils.ratio(totals.ppOpportunities - totals.timesShorthanded, totals.gamesPlayed),
      format: value => TeamRatingUtils.formatSigned(value)
    },
    {
      id: "pointPct", label: "Points %", shortLabel: "Points %", color: "#3987e5",
      description: "The share of the possible standings points the team has earned",
      getValue: totals => TeamRatingUtils.ratio(totals.points, 2 * totals.gamesPlayed),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "goalDiff", label: "Goal Diff / Game", shortLabel: "Goal diff", color: "#d95926",
      description: "Goals for minus goals against, per game",
      getValue: totals => TeamRatingUtils.ratio(totals.goalsFor - totals.goalsAgainst, totals.gamesPlayed),
      format: value => TeamRatingUtils.formatSigned(value)
    },
    {
      id: "specialTeams", label: "Special Teams Diff / Game", shortLabel: "Special teams",
      description: "Power play and short-handed goals for, minus those against, per game",
      getValue: totals => TeamRatingUtils.ratio(
          totals.ppGoalsFor + totals.shGoalsFor - totals.ppGoalsAgainst - totals.shGoalsAgainst, totals.gamesPlayed),
      format: value => TeamRatingUtils.formatSigned(value)
    },
    {
      id: "fenwick", label: "5v5 Fenwick %", shortLabel: "Fenwick %",
      description: "The team's share of the unblocked shot attempts at 5 on 5: Corsi without the blocked shots",
      getValue: totals => TeamRatingUtils.ratio(totals.usatFor, totals.usatFor + totals.usatAgainst),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "pdo", label: "PDO", shortLabel: "PDO",
      description: "5v5 shooting % plus save %. Around 100 is normal; far from it usually doesn't last",
      getValue: totals => {
        const shooting = TeamRatingUtils.ratio(totals.goalsFor5v5, totals.shots5v5For);
        const saves = TeamRatingUtils.ratio(totals.shots5v5Against - totals.goalsAgainst5v5, totals.shots5v5Against);
        return shooting == null || saves == null ? null : (shooting + saves) * 100;
      },
      format: value => value.toFixed(1)
    },
    {
      id: "shotShare", label: "Shots For %", shortLabel: "Shots %",
      description: "The team's share of the shots on goal, in all situations",
      getValue: totals => TeamRatingUtils.ratio(totals.shotsFor, totals.shotsFor + totals.shotsAgainst),
      format: value => TeamRatingUtils.formatPercentage(value)
    },
    {
      id: "goalShare5v5", label: "5v5 Goals For %", shortLabel: "Goals %",
      description: "The team's share of the goals scored at 5 on 5",
      getValue: totals => TeamRatingUtils.ratio(totals.goalsFor5v5, totals.goalsFor5v5 + totals.goalsAgainst5v5),
      format: value => TeamRatingUtils.formatPercentage(value)
    }
  ];

  /**
   * The metrics that are part of a power rating, in the card's order.
   *
   * @param weights - The rating's weights (TeamRating.weights). The expected goals weights without them.
   */
  public static getRatedMetrics(weights: TeamRatingWeights = TeamRatingUtils.expectedGoalsWeights): TeamMetric[] {
    return TeamRatingUtils.metrics.filter(metric => weights?.[metric.id] > 0);
  }

  /** The metrics the rating chart can plot. */
  public static get chartMetrics(): TeamMetric[] {
    return TeamRatingUtils.metrics.filter(metric => metric.color);
  }

  public static getMetric(id: TeamMetricId): TeamMetric {
    return TeamRatingUtils.metrics.find(metric => metric.id === id);
  }

  /**
   * Adds Natural Stat Trick's 5v5 expected goals to the games that have them, matched by game and team. A game NST doesn't
   * have is returned as it is, without them.
   *
   * @param games - Every team's games of the season, from /api/nhl-stats/team-games.
   * @param expectedGoals - Every team's expected goals per game (NaturalStatTrickService.getTeamGames).
   */
  public static withExpectedGoals(games: TeamGameStats[], expectedGoals: NstTeamGameStats[]): TeamGameStats[] {
    if (!expectedGoals?.length) {
      return games ?? [];
    }
    const byTeamGame = new Map(expectedGoals.map(game => [game.gameId + ":" + game.teamId, game]));
    return (games ?? []).map(game => {
      const nstGame = byTeamGame.get(game.gameId + ":" + game.teamId);
      return nstGame ? {
        ...game,
        expectedGoalsFor5v5: nstGame.expectedGoalsFor,
        expectedGoalsAgainst5v5: nstGame.expectedGoalsAgainst
      } : game;
    });
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
   * @param games - Every team's games of the season, from /api/nhl-stats/team-games, with NST's expected goals merged
   * in when there are any (withExpectedGoals).
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
   * @param games - Every team's games of the season, from /api/nhl-stats/team-games, with NST's expected goals merged
   * in when there are any (withExpectedGoals).
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
   * Rates teams against each other: each metric's score and rank, and the power rating and its rank. The rating counts
   * expected goals only when every team has some over these games, so the teams are always rated on the same stats.
   */
  private static rateTeams(teams: {teamId: number, totals: TeamStatTotals}[]): TeamRating[] {
    const played = teams.filter(team => team.totals.gamesPlayed > 0);
    const hasExpectedGoals = played.length > 0
        && played.every(team => team.totals.expectedGoalsFor5v5 + team.totals.expectedGoalsAgainst5v5 > 0);
    const weights = hasExpectedGoals ? TeamRatingUtils.expectedGoalsWeights : TeamRatingUtils.nhlWeights;
    const rated: TeamRating[] = played.map(team => ({
      teamId: team.teamId,
      gamesPlayed: team.totals.gamesPlayed,
      totals: team.totals,
      values: {} as Record<TeamMetricId, number>,
      scores: {} as Record<TeamMetricId, number>,
      ranks: {} as Record<TeamMetricId, number>,
      rating: TeamRatingUtils.averageRating,
      rank: 1,
      weights,
      hasExpectedGoals
    }));
    const composites = rated.map(() => 0);
    TeamRatingUtils.metrics.forEach(metric => {
      const values = rated.map(team => TeamRatingUtils.toNumber(metric.getValue(team.totals)));
      const deviations = TeamRatingUtils.getDeviations(values);
      const weight = weights[metric.id] ?? 0;
      rated.forEach((team, i) => {
        team.values[metric.id] = values[i];
        team.scores[metric.id] = TeamRatingUtils.toScore(deviations[i]);
        team.ranks[metric.id] = TeamRatingUtils.getRank(values[i], values);
        composites[i] += weight * deviations[i];
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
