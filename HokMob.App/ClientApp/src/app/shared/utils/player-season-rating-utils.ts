import {RatedGame, RatedSeason} from "@shared/models/nhl-history/season-history.model";
import {StatsUtils} from "@shared/utils/stats-utils";

/**
 * A player's season in the history file (SeasonHistoryService): their average HokMob rating, and the stat shown
 * below it on the player page's season card.
 */
export interface PlayerSeasonRating {
  /** The games rated: a goalie's games without a shot faced are left out. */
  gamesRated: number;
  averageRating: number;
  /** Only for a skater: 5v5 shot attempts for over all of them while on the ice (Corsi For %), 0 to 1. */
  corsiForPct?: number;
  /** Only for a goalie: the season's goals saved above average. */
  goalsSavedAboveAverage?: number;
  /** Only in a season in progress: the day of the file's last game, like "2026-11-08". */
  throughDate?: string;
}

/**
 * The player page's season rating column, from a season's rated games.
 */
export class PlayerSeasonRatingUtils {

  /**
   * Sums a player's rated games of a season. Undefined when the player has no rated game in it, like a player who
   * hasn't played since the file was generated. A skater without a 5v5 shot attempt has no Corsi For %.
   *
   * @param ratedSeason - The season's rated games.
   * @param playerId - The player.
   */
  public static getPlayerSeasonRating(ratedSeason: RatedSeason, playerId: number): PlayerSeasonRating {
    const games = (ratedSeason?.ratedGames ?? []).filter(game => game.player.id === playerId);
    return PlayerSeasonRatingUtils.summarizeGames(ratedSeason, games);
  }

  /**
   * Sums the rated games of every player of a team, by player ID. Only their games for this team count, so a traded
   * player's rating matches their stats with the team. A player without a rated game for the team isn't in the map.
   *
   * @param ratedSeason - The season's rated games.
   * @param teamId - The team.
   */
  public static getTeamSeasonRatings(ratedSeason: RatedSeason, teamId: number): Map<number, PlayerSeasonRating> {
    const gamesByPlayer = new Map<number, RatedGame[]>();
    (ratedSeason?.ratedGames ?? []).filter(game => game.teamId === teamId).forEach(game => {
      const games = gamesByPlayer.get(game.player.id) ?? [];
      games.push(game);
      gamesByPlayer.set(game.player.id, games);
    });
    const ratings = new Map<number, PlayerSeasonRating>();
    gamesByPlayer.forEach((games, playerId) =>
        ratings.set(playerId, PlayerSeasonRatingUtils.summarizeGames(ratedSeason, games)));
    return ratings;
  }

  /**
   * Averages one player's rated games, and sums a skater's Corsi or a goalie's goals saved above average. Undefined
   * without games.
   */
  private static summarizeGames(ratedSeason: RatedSeason, games: RatedGame[]): PlayerSeasonRating {
    if (games.length === 0) {
      return undefined;
    }
    const ratingSum = games.reduce((sum, game) => sum + game.rating, 0);
    const seasonRating: PlayerSeasonRating = {
      gamesRated: games.length,
      averageRating: ratingSum / games.length,
      throughDate: ratedSeason.throughDate
    };
    if (games[0].position === "G") {
      seasonRating.goalsSavedAboveAverage = games.reduce((sum, game) => sum + (game.goalsSavedAboveAverage ?? 0), 0);
    } else {
      const corsiFor = games.reduce((sum, game) => sum + (game.satFor ?? 0), 0);
      const corsiAgainst = games.reduce((sum, game) => sum + (game.satAgainst ?? 0), 0);
      seasonRating.corsiForPct = corsiFor + corsiAgainst > 0 ? corsiFor / (corsiFor + corsiAgainst) : undefined;
    }
    return seasonRating;
  }

  /**
   * An average rating as shown on the card, like "7.12", the same two decimals as the history page's leaderboard.
   * A dash without one.
   */
  public static formatAverageRating(averageRating: number): string {
    return averageRating == null ? "-" : averageRating.toFixed(2);
  }

  /**
   * The badge color of an average rating, from its shown value, so 6.996 shown as "7.00" is green.
   */
  public static getAverageRatingColor(averageRating: number): string {
    return averageRating == null ? undefined :
        StatsUtils.getHokmobRatingColor(Number(PlayerSeasonRatingUtils.formatAverageRating(averageRating)));
  }

  /**
   * A Corsi For % (0 to 1) like "52.3%", or a dash without one.
   */
  public static formatCorsiForPct(corsiForPct: number): string {
    return corsiForPct == null ? "-" : (corsiForPct * 100).toFixed(1) + "%";
  }

  /**
   * Goals saved above average with a sign and one decimal, like "+4.2" or "-1.6". A dash without them.
   */
  public static formatGoalsSavedAboveAverage(goalsSavedAboveAverage: number): string {
    if (goalsSavedAboveAverage == null) {
      return "-";
    }
    const rounded = Number(goalsSavedAboveAverage.toFixed(1));
    // -0.04 rounds to "-0.0", shown as "0.0"
    return rounded > 0 ? "+" + rounded.toFixed(1) : rounded < 0 ? rounded.toFixed(1) : "0.0";
  }
}
