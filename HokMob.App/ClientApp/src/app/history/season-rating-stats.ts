import {HistoryPlayer, PositionGroup, RatedGame} from "@shared/models/nhl-history/season-history.model";

/**
 * A choice of a position toggle. A null value is every position.
 */
export interface PositionOption {
  value: PositionGroup;
  label: string;
}

/**
 * One bar of the rating histogram: the games rated from `from` up to, but not including, `to`. The first bin also
 * holds the few skater ratings below 0, and the last one the 10s.
 */
export interface RatingBin {
  from: number;
  to: number;
  count: number;
}

/**
 * How a season's game ratings are spread.
 */
export interface RatingDistribution {
  bins: RatingBin[];
  /** The games rated. */
  total: number;
  mean: number;
  median: number;
  /** The share of games rated 7 and up (green or blue), 0 to 1. */
  greenShare: number;
  /** The share of games rated 8.5 and up (blue), 0 to 1. */
  blueShare: number;
}

/**
 * A player's average rating over the season, or over their games for one team.
 */
export interface AverageRatingLeader {
  player: HistoryPlayer;
  /** The team of their last game counted. */
  teamId: number;
  gamesPlayed: number;
  averageRating: number;
}

/**
 * Which games the average rating leaderboard counts, and how many players it lists.
 */
export interface AverageRatingFilter {
  /** Only this position group, or every player. */
  position?: PositionGroup;
  /** Only games played for this team, or every game. */
  teamId?: number;
  /** The fewest games a player needs to be listed. */
  minGames: number;
  limit: number;
}

/**
 * The season-wide numbers of the history page's cards, from a season's rated games (SeasonHistoryService).
 */
export class SeasonRatingStatsUtils {

  /** The position groups, for the rating distribution's toggle. */
  public static readonly positionOptions: PositionOption[] = [
    {value: "F", label: "Forwards"},
    {value: "D", label: "Defense"},
    {value: "G", label: "Goalies"}
  ];

  /** Every position, then each group, for the lists' toggles. */
  public static readonly positionFilterOptions: PositionOption[] = [
    {value: null, label: "All"},
    {value: "F", label: "F"},
    {value: "D", label: "D"},
    {value: "G", label: "G"}
  ];

  /** The histogram's bin width. */
  public static readonly binSize = 0.5;

  /** The top of the rating scale. */
  public static readonly maxRating = 10;

  /** The rating a game needs to be green, and blue (StatsUtils.getHokmobRatingColor). */
  public static readonly greenRating = 7;

  public static readonly blueRating = 8.5;

  /**
   * Bins the ratings of one position group into a 0 to 10 histogram, and works out their mean, median and the share
   * of green and blue games. An empty list gives empty bins and 0s.
   *
   * @param ratedGames - Every rated game of the season.
   * @param position - The position group to count.
   */
  public static getDistribution(ratedGames: RatedGame[], position: PositionGroup): RatingDistribution {
    const binCount = SeasonRatingStatsUtils.maxRating / SeasonRatingStatsUtils.binSize;
    const bins: RatingBin[] = Array.from({length: binCount}, (_, index) => ({
      from: index * SeasonRatingStatsUtils.binSize,
      to: (index + 1) * SeasonRatingStatsUtils.binSize,
      count: 0
    }));
    const ratings = (ratedGames ?? []).filter(game => game.position === position).map(game => game.rating);
    let sum = 0;
    let greenCount = 0;
    let blueCount = 0;
    ratings.forEach(rating => {
      bins[SeasonRatingStatsUtils.getBinIndex(rating, binCount)].count++;
      sum += rating;
      greenCount += rating >= SeasonRatingStatsUtils.greenRating ? 1 : 0;
      blueCount += rating >= SeasonRatingStatsUtils.blueRating ? 1 : 0;
    });
    const total = ratings.length;
    return {
      bins,
      total,
      mean: total ? sum / total : 0,
      median: SeasonRatingStatsUtils.getMedian(ratings),
      greenShare: total ? greenCount / total : 0,
      blueShare: total ? blueCount / total : 0
    };
  }

  /**
   * Lists the players with the best average rating, best first, among those with at least the minimum games. Ties go
   * to the player with more games, then by name.
   *
   * @param ratedGames - Every rated game of the season, in game order.
   * @param filter - The position group, team, minimum games and number of players.
   */
  public static getAverageLeaders(ratedGames: RatedGame[], filter: AverageRatingFilter): AverageRatingLeader[] {
    const totals = new Map<number, {player: HistoryPlayer, teamId: number, games: number, sum: number}>();
    (ratedGames ?? []).forEach(game => {
      if ((filter.position && game.position !== filter.position) || (filter.teamId && game.teamId !== filter.teamId)) {
        return;
      }
      const total = totals.get(game.player.id) ?? {player: game.player, teamId: game.teamId, games: 0, sum: 0};
      total.teamId = game.teamId;
      total.games++;
      total.sum += game.rating;
      totals.set(game.player.id, total);
    });
    return [...totals.values()]
        .filter(total => total.games >= filter.minGames)
        .map(total => ({
          player: total.player,
          teamId: total.teamId,
          gamesPlayed: total.games,
          averageRating: total.sum / total.games
        }))
        .sort((leaderA, leaderB) => leaderB.averageRating - leaderA.averageRating ||
            leaderB.gamesPlayed - leaderA.gamesPlayed || leaderA.player.name.localeCompare(leaderB.player.name))
        .slice(0, filter.limit);
  }

  /**
   * Lists the best rated single games, best first. The games capped at 10 are ranked by their uncapped rating, and
   * other ties go to the earlier game, then by name.
   *
   * @param ratedGames - Every rated game of the season.
   * @param position - Only this position group, or null for every player.
   * @param limit - How many games to list.
   */
  public static getBestGames(ratedGames: RatedGame[], position: PositionGroup, limit: number): RatedGame[] {
    return (ratedGames ?? [])
        .filter(game => !position || game.position === position)
        .sort((gameA, gameB) => gameB.rating - gameA.rating ||
            (gameB.uncappedRating ?? gameB.rating) - (gameA.uncappedRating ?? gameA.rating) ||
            gameA.game.id - gameB.game.id ||
            gameA.player.name.localeCompare(gameB.player.name))
        .slice(0, limit);
  }

  /**
   * The bin of a rating. Ratings have one decimal, so the rating is rounded to tenths before it's divided, which keeps
   * 7.0 in the 7 to 7.5 bin however it was computed. Below 0 goes in the first bin and 10 in the last.
   */
  private static getBinIndex(rating: number, binCount: number): number {
    const tenthsPerBin = SeasonRatingStatsUtils.binSize * 10;
    const index = Math.floor(Math.round(rating * 10) / tenthsPerBin);
    return Math.max(0, Math.min(binCount - 1, index));
  }

  private static getMedian(ratings: number[]): number {
    if (ratings.length === 0) {
      return 0;
    }
    const sorted = [...ratings].sort((ratingA, ratingB) => ratingA - ratingB);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
}
