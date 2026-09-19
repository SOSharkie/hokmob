import {
  Boxscore,
  BoxscoreGoalie,
  BoxscoreSkater,
  GamePlayer
} from "@shared/models/nhl-web-api/boxscore.model";
import {RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {GoalieGameStats, SkaterGameStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {NhlStarPlayerUtils} from "@shared/utils/nhl-star-player-utils";

export class StatsUtils {

  /**
   * The HokMob rating colors: blue for 8.5 and up, green for 7 and up.
   */
  public static readonly hokmobRatingBlue = "#0e87e0";

  public static readonly hokmobRatingGreen = "#1ec854";

  /**
   * How much of a rating a star player is sorted with on top of his own (StatsUtils.getSortRating), so a game's top
   * players lean towards the players fans came to watch. It never changes the rating shown.
   */
  public static readonly starRatingBoost = 0.5;

  /**
   * The number of faceoffs a skater takes before his faceoff percentage counts fully in his rating.
   */
  public static readonly fullWeightFaceoffCount = 10;

  /**
   * Calculates the HokMob rating of a skater for a single live or past game, from 0 to 10.
   *
   * The faceoff term, (win percentage - 0.5), is scaled by the faceoffs taken up to fullWeightFaceoffCount, so losing
   * 2 draws costs less than losing 20. Without a count, it falls back to the full term for centers only.
   *
   * TODO: The new NHL API boxscore (gamecenter/{id}/boxscore) has no powerPlayAssists, so the powerPlayAssists
   *  correction from realPlusMinus is dropped. It can be derived from play-by-play "goal" plays' situationCode.
   *
   * @param skater - The skater's boxscore stats.
   * @param faceoffsTaken - The faceoffs the skater took, from play-by-play or the stats API, if known.
   */
  public static calculateSkaterHokmobRating(skater: BoxscoreSkater, faceoffsTaken?: number): number {
    const goals = skater.goals ?? 0;
    const assists = skater.assists ?? 0;
    const plusMinus = skater.plusMinus ?? 0;
    let hokmobRating = 5;
    hokmobRating += (goals * 1.1);
    hokmobRating += (assists * 0.5);
    hokmobRating += (((skater.sog ?? 0) - goals) * 0.3);
    hokmobRating += ((skater.hits ?? 0) * 0.2);
    hokmobRating += ((skater.blockedShots ?? 0) * 0.2);
    hokmobRating += ((skater.takeaways ?? 0) * 0.2);

    if (skater.pim) {
      let penaltyDeduction = skater.pim;
      if (skater.pim === 5 || skater.pim === 7 || skater.pim === 9 || skater.pim === 11) {
        penaltyDeduction -= 5;
      }
      hokmobRating -= Math.min(3, penaltyDeduction * 0.25);
    }

    let realPlusMinus = (plusMinus - goals + (skater.powerPlayGoals ?? 0) - assists);
    if (plusMinus > 0) {
      hokmobRating += (realPlusMinus * 0.3);
    } else {
      hokmobRating += (plusMinus * 0.5);
    }

    hokmobRating -= ((skater.giveaways ?? 0) * 0.2);

    const faceoffTerm = -0.5 + (skater.faceoffWinningPctg ?? 0);
    if (faceoffsTaken != null) {
      hokmobRating += faceoffTerm * Math.min(1, faceoffsTaken / StatsUtils.fullWeightFaceoffCount);
    } else if (skater.position === "C") {
      hokmobRating += faceoffTerm;
    }

    return parseFloat(Math.min(10.0, hokmobRating).toFixed(1));
  }

  /**
   * Calculates the HokMob rating of a goalie for a single live or past game, from 0 to 10. A goalie who faced no
   * shots (no savePctg) gets 0.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static calculateGoalieHokMobRating(goalie: BoxscoreGoalie): number {
    if (!goalie.savePctg) {
      return 0;
    }
    let hokmobRating = 5;
    hokmobRating += (StatsUtils.getSaves(goalie.evenStrengthShotsAgainst) / 6);
    hokmobRating += (StatsUtils.getSaves(goalie.powerPlayShotsAgainst) / 5);
    hokmobRating -= ((goalie.shotsAgainst ?? 0) - (goalie.saves ?? 0));

    return parseFloat(Math.max(0, Math.min(10.0, hokmobRating)).toFixed(1));
  }

  /**
   * Returns the saves from a boxscore saves/shots string, like 28 for "28/30", or 0 when it can't be read.
   */
  public static getSaves(savesAndShots: string): number {
    const saves = parseInt((savesAndShots ?? "").split("/")[0], 10);
    return isNaN(saves) ? 0 : saves;
  }

  /**
   * Formats seconds as "m:ss" (or "mm:ss"), like 1181.6133 to "19:42". The stats API gives every time in seconds, and
   * so does the NHL web API's time on ice leaderboard. Returns "-" without a time.
   *
   * @param seconds - The time in seconds.
   */
  public static formatSeconds(seconds: number): string {
    if (seconds == null || isNaN(seconds) || seconds < 0) {
      return "-";
    }
    const wholeSeconds = Math.round(seconds);
    return Math.floor(wholeSeconds / 60) + ":" + String(wholeSeconds % 60).padStart(2, "0");
  }

  /**
   * Maps a stats API skater game row to a boxscore skater, so a past game gets its HokMob rating from the same
   * formula as a live one (calculateSkaterHokmobRating). The stats API names several fields differently.
   *
   * @param game - The skater's stats for one game.
   */
  public static toBoxscoreSkater(game: SkaterGameStats): BoxscoreSkater {
    return {
      playerId: game?.playerId,
      sweaterNumber: undefined,
      name: {default: game?.skaterFullName},
      position: game?.positionCode,
      goals: game?.goals ?? 0,
      assists: game?.assists ?? 0,
      points: game?.points ?? 0,
      plusMinus: game?.plusMinus ?? 0,
      pim: game?.penaltyMinutes ?? 0,
      hits: game?.hits ?? 0,
      powerPlayGoals: game?.ppGoals ?? 0,
      sog: game?.shots ?? 0,
      faceoffWinningPctg: game?.faceoffWinPct ?? 0,
      toi: StatsUtils.formatSeconds(game?.timeOnIcePerGame),
      blockedShots: game?.blockedShots ?? 0,
      shifts: undefined,
      giveaways: game?.giveaways ?? 0,
      takeaways: game?.takeaways ?? 0
    };
  }

  /**
   * Maps a stats API goalie game row to a boxscore goalie, for calculateGoalieHokMobRating. The saves by strength
   * come as counts, and the boxscore's "saves/shots" strings are built from them.
   *
   * @param game - The goalie's stats for one game.
   */
  public static toBoxscoreGoalie(game: GoalieGameStats): BoxscoreGoalie {
    return {
      playerId: game?.playerId,
      sweaterNumber: undefined,
      name: {default: game?.goalieFullName},
      position: "G",
      evenStrengthShotsAgainst: StatsUtils.getSavesAndShots(game?.evSaves, game?.evShotsAgainst),
      powerPlayShotsAgainst: StatsUtils.getSavesAndShots(game?.ppSaves, game?.ppShotsAgainst),
      shorthandedShotsAgainst: StatsUtils.getSavesAndShots(game?.shSaves, game?.shShotsAgainst),
      saveShotsAgainst: StatsUtils.getSavesAndShots(game?.saves, game?.shotsAgainst),
      savePctg: game?.savePct,
      evenStrengthGoalsAgainst: StatsUtils.getGoalsAgainst(game?.evSaves, game?.evShotsAgainst),
      powerPlayGoalsAgainst: StatsUtils.getGoalsAgainst(game?.ppSaves, game?.ppShotsAgainst),
      shorthandedGoalsAgainst: StatsUtils.getGoalsAgainst(game?.shSaves, game?.shShotsAgainst),
      pim: 0,
      goalsAgainst: game?.goalsAgainst ?? 0,
      toi: StatsUtils.formatSeconds(game?.timeOnIce),
      starter: !!game?.gamesStarted,
      decision: StatsUtils.getGoalieDecision(game),
      shotsAgainst: game?.shotsAgainst ?? 0,
      saves: game?.saves ?? 0
    };
  }

  /**
   * Returns a boxscore "saves/shots" string, like "28/30", or undefined when the counts are missing.
   */
  private static getSavesAndShots(saves: number, shots: number): string {
    return saves == null || shots == null ? undefined : saves + "/" + shots;
  }

  /**
   * Returns the goals against of one strength, or undefined when the counts are missing.
   */
  private static getGoalsAgainst(saves: number, shots: number): number {
    return saves == null || shots == null ? undefined : shots - saves;
  }

  /**
   * Returns a goalie's decision for a game: "W", "O" (an overtime or shootout loss), "L", or undefined when the
   * goalie didn't get one.
   */
  private static getGoalieDecision(game: GoalieGameStats): string {
    if (game?.wins) {
      return "W";
    } else if (game?.otLosses) {
      return "O";
    } else if (game?.losses) {
      return "L";
    }
    return undefined;
  }

  /**
   * Converts a time on ice like "59:52" to seconds, or 0 when it can't be read.
   */
  public static getTimeOnIceSeconds(timeOnIce: string): number {
    const [minutes, seconds] = (timeOnIce ?? "").split(":").map(Number);
    return (minutes || 0) * 60 + (seconds || 0);
  }

  /**
   * Returns a team's dressed skaters and goalies with their HokMob ratings, best rated first, and star players ahead
   * of equally rated teammates. Full names and headshots come from the play-by-play roster spots; without one, the
   * boxscore's short name and the season's team headshot are used. Returns an empty list when the boxscore has no
   * player stats (a future game).
   *
   * @param boxscore - The game's boxscore.
   * @param isHome - Whether to return the home team's players.
   * @param rosterSpots - The play-by-play roster spots by player ID, if loaded.
   * @param faceoffCounts - The faceoffs taken by player ID (PlayByPlayUtils.getFaceoffCounts), if loaded.
   */
  public static getGamePlayers(boxscore: Boxscore, isHome: boolean, rosterSpots?: Map<number, RosterSpot>,
                               faceoffCounts?: Map<number, number>): GamePlayer[] {
    const team = isHome ? boxscore?.homeTeam : boxscore?.awayTeam;
    const players = isHome ? boxscore?.playerByGameStats?.homeTeam : boxscore?.playerByGameStats?.awayTeam;
    if (!team || !players) {
      return [];
    }
    const toGamePlayer = (stats: BoxscoreSkater | BoxscoreGoalie): GamePlayer => {
      const rosterSpot = rosterSpots?.get(stats.playerId);
      return {
        playerId: stats.playerId,
        teamId: team.id,
        isHome,
        name: PlayByPlayUtils.getFullName(rosterSpot) || stats.name?.default || "",
        position: stats.position,
        headshot: rosterSpot?.headshot || NhlPlayerHeadshotUtils.getHeadshotUrl(boxscore.season, team.abbrev, stats.playerId),
        hokmobRating: 0
      };
    };
    const skaters = [...(players.forwards ?? []), ...(players.defense ?? [])].map(skater => ({
      ...toGamePlayer(skater),
      skaterStats: skater,
      hokmobRating: StatsUtils.calculateSkaterHokmobRating(skater,
          faceoffCounts ? (faceoffCounts.get(skater.playerId) ?? 0) : undefined)
    }));
    const goalies = (players.goalies ?? []).map(goalie => ({
      ...toGamePlayer(goalie),
      goalieStats: goalie,
      hokmobRating: StatsUtils.calculateGoalieHokMobRating(goalie)
    }));
    return [...skaters, ...goalies].sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB) ||
        StatsUtils.sortByStarPlayer(playerA, playerB));
  }

  public static getHokmobRatingColor(score: number): string {
    if (score >= 8.5) {
      return StatsUtils.hokmobRatingBlue;
    } else if (score >= 7) {
      return StatsUtils.hokmobRatingGreen;
    } else if (score >= 6) {
      return "#e68122";
    } else {
      return "#e55b5b";
    }
  }

  /**
   * Sorts goalies by time on ice, most first.
   */
  public static sortByGoalieTimeOnIce(playerA: GamePlayer, playerB: GamePlayer): number {
    return StatsUtils.getTimeOnIceSeconds(playerB.goalieStats?.toi) - StatsUtils.getTimeOnIceSeconds(playerA.goalieStats?.toi);
  }

  /**
   * Sorts players by HokMob rating, best first.
   */
  public static sortByHokMobRating(playerA: GamePlayer, playerB: GamePlayer): number {
    return (playerB.hokmobRating ?? 0) - (playerA.hokmobRating ?? 0);
  }

  /**
   * The rating a player is sorted by: his own HokMob rating, plus the star boost for one of his team's star players
   * (NhlStarPlayerUtils). Never shown anywhere; the rating on a player's card is always his own.
   */
  public static getSortRating(player: GamePlayer): number {
    const boost = NhlStarPlayerUtils.isStarPlayer(player?.playerId) ? StatsUtils.starRatingBoost : 0;
    return Math.round(((player?.hokmobRating ?? 0) + boost) * 10) / 10;
  }

  /**
   * Sorts players by rating with the star boost, best first, so a star is shown over a teammate rated up to the
   * boost better than him.
   */
  public static sortByBoostedRating(playerA: GamePlayer, playerB: GamePlayer): number {
    return StatsUtils.getSortRating(playerB) - StatsUtils.getSortRating(playerA);
  }

  /**
   * Sorts a team's star players ahead of the rest, the bigger star first (NhlStarPlayerUtils). Used to break a tie
   * in boosted ratings, where two stars, or a star and the teammate his boost caught up with, sort the same.
   */
  public static sortByStarPlayer(playerA: GamePlayer, playerB: GamePlayer): number {
    const rank = (player: GamePlayer) => NhlStarPlayerUtils.getStarRank(player?.playerId) ?? Number.MAX_SAFE_INTEGER;
    return rank(playerA) - rank(playerB);
  }
}
