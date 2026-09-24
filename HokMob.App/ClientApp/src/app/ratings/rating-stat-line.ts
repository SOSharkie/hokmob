import {Params} from "@angular/router";
import {BoxscoreGoalie, BoxscoreSkater, GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {SkaterRatingContext} from "@shared/utils/stats-utils";

/**
 * Turns a player's game stats into the Ratings page's stat lines, so the game page can open the rating explorer on a
 * player's exact line (`/ratings?subject=skater&goals=1&...`).
 */
export class RatingStatLineUtils {

  /**
   * The query parameters that open the Ratings page on a player's stat line from a game: the formula, the player's name,
   * the rating the game page gave him and every stat of the line.
   *
   * @param player - The player, as the game page built him (StatsUtils.getGamePlayers).
   */
  public static getQueryParams(player: GamePlayer): Params {
    const line = player?.goalieStats
        ? RatingStatLineUtils.getGoalieLine(player.goalieStats)
        : RatingStatLineUtils.getSkaterLine(player?.skaterStats, player?.ratingContext);
    return {
      subject: player?.goalieStats ? "goalie" : "skater",
      name: player?.name,
      rating: player?.hokmobRating,
      ...line
    };
  }

  /**
   * A skater's boxscore stats as the Ratings page's skater line. Draws won come from the boxscore's win percentage and
   * the draws taken. Without an assist split every assist is read as primary, and without a draw count, power play
   * assists or penalties drawn those are 0.
   *
   * @param skater - The skater's boxscore stats.
   * @param context - What the game page rated him with beyond the boxscore.
   */
  public static getSkaterLine(skater: BoxscoreSkater, context?: SkaterRatingContext): { [stat: string]: number } {
    const assists = skater?.assists ?? 0;
    const hasAssistSplit = context?.primaryAssists != null && context?.secondaryAssists != null;
    const faceoffsTaken = context?.faceoffsTaken ?? 0;
    return {
      goals: skater?.goals ?? 0,
      powerPlayGoals: skater?.powerPlayGoals ?? 0,
      primaryAssists: hasAssistSplit ? context.primaryAssists : assists,
      secondaryAssists: hasAssistSplit ? context.secondaryAssists : 0,
      powerPlayAssists: context?.powerPlayAssists ?? 0,
      sog: skater?.sog ?? 0,
      hits: skater?.hits ?? 0,
      blockedShots: skater?.blockedShots ?? 0,
      takeaways: skater?.takeaways ?? 0,
      giveaways: skater?.giveaways ?? 0,
      pim: skater?.pim ?? 0,
      penaltiesDrawn: context?.penaltiesDrawn ?? 0,
      plusMinus: skater?.plusMinus ?? 0,
      faceoffsTaken,
      faceoffWins: Math.round((skater?.faceoffWinningPctg ?? 0) * faceoffsTaken)
    };
  }

  /**
   * A goalie's boxscore stats as the Ratings page's goalie line: shots and goals against at each strength. The boxscore's
   * power play split is the shots he faced on the penalty kill, and its shorthanded split the ones on the power play.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static getGoalieLine(goalie: BoxscoreGoalie): { [stat: string]: number } {
    const evenStrength = RatingStatLineUtils.parseShotsAgainst(goalie?.evenStrengthShotsAgainst);
    const penaltyKill = RatingStatLineUtils.parseShotsAgainst(goalie?.powerPlayShotsAgainst);
    const powerPlay = RatingStatLineUtils.parseShotsAgainst(goalie?.shorthandedShotsAgainst);
    return {
      evenStrengthShots: evenStrength.shots,
      evenStrengthGoals: evenStrength.shots - evenStrength.saves,
      penaltyKillShots: penaltyKill.shots,
      penaltyKillGoals: penaltyKill.shots - penaltyKill.saves,
      powerPlayShots: powerPlay.shots,
      powerPlayGoals: powerPlay.shots - powerPlay.saves
    };
  }

  /**
   * Reads a boxscore "saves/shots" split, like "28/30". A missing or unreadable split is no shots.
   */
  private static parseShotsAgainst(split: string): { saves: number, shots: number } {
    const [saves, shots] = (split ?? "").split("/").map(value => parseInt(value, 10));
    return Number.isFinite(saves) && Number.isFinite(shots) ? {saves, shots} : {saves: 0, shots: 0};
  }
}
