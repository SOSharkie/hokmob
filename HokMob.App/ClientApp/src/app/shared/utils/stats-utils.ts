import {
  Boxscore,
  BoxscoreGoalie,
  BoxscoreSkater,
  GamePlayer
} from "@shared/models/nhl-web-api/boxscore.model";
import {RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {GoalieGameStats, SkaterGameStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {GameLanding} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {NhlStarPlayerUtils} from "@shared/utils/nhl-star-player-utils";

/**
 * The assists a player was credited with in a game, split by where they came: the primary (first) and secondary
 * (second) assist of each goal, and how many of them were on a power play (StatsUtils.getAssistCounts).
 */
export interface AssistCounts {
  primary: number;
  secondary: number;
  powerPlay: number;
}

/**
 * The stats the HokMob skater rating needs that the boxscore alone doesn't give: the faceoffs a skater took, his
 * primary/secondary assist split, his power play assists and the penalties he drew. Every field is optional, and the rating falls back to a
 * flat weighting without one, so a rating never changes just because a second request hasn't come back yet.
 */
export interface SkaterRatingContext {
  /** The faceoffs the skater took, won or lost (PlayByPlayUtils.getFaceoffCounts, or the stats API's totalFaceoffs). */
  faceoffsTaken?: number;

  /** The skater's primary (first) assists. Only counted together with secondaryAssists. */
  primaryAssists?: number;

  /** The skater's secondary (second) assists. Only counted together with primaryAssists. */
  secondaryAssists?: number;

  /**
   * The skater's power play assists (StatsUtils.getAssistCounts, or the stats API's ppAssists). Plus/minus doesn't
   * count a power play goal, so these are added back to realPlusMinus. Without them the correction is skipped.
   */
  powerPlayAssists?: number;

  /**
   * The penalties the skater drew (PlayByPlayUtils.getPenaltiesDrawnCounts, or the stats API's penaltiesDrawn), each
   * worth penaltyDrawnWeight. Without them the term is skipped.
   */
  penaltiesDrawn?: number;
}

/**
 * A goalie's goals and assists, which his rating adds the way a skater's does (StatsUtils.getGoalieRawRating). The
 * boxscore has neither for a goalie, so the game page counts them from the landing's scoring summary
 * (StatsUtils.getGoalieRatingContext), with the primary/secondary split. The stats API's goalie rows have the goals
 * and assists but no split, so their assists count at the flat weight. Without a context a goalie has no points.
 */
export interface GoalieRatingContext {
  goals?: number;

  assists?: number;

  /** The goalie's primary (first) assists. Only counted together with secondaryAssists. */
  primaryAssists?: number;

  /** The goalie's secondary (second) assists. Only counted together with primaryAssists. */
  secondaryAssists?: number;
}

export class StatsUtils {

  /**
   * The HokMob rating colors: blue for 8.5 and up, green for 7 and up.
   */
  public static readonly hokmobRatingBlue = "#0e87e0";

  public static readonly hokmobRatingGreen = "#1ec854";

  /**
   * The number of faceoffs a skater takes before his faceoff percentage counts fully in his rating.
   */
  public static readonly fullWeightFaceoffCount = 10;

  /** The rating weight of a goal, a skater's or a goalie's. */
  public static readonly goalWeight = 1.2;

  /**
   * The rating weight of an assist, a skater's or a goalie's: more for a primary (first) assist than for a secondary
   * one, and a flat weight in between when the split isn't known.
   */
  public static readonly primaryAssistWeight = 0.6;

  public static readonly secondaryAssistWeight = 0.4;

  public static readonly unknownAssistWeight = 0.5;

  /**
   * The rating weight of a penalty drawn. It's less than a minor penalty taken costs (0.5), since not every penalty
   * drawn gives a power play.
   */
  public static readonly penaltyDrawnWeight = 0.3;

  /** The landing's goal strength for a power play goal; the others are "ev" and "sh". */
  public static readonly powerPlayStrength = "pp";

  /**
   * Where a goalie's rating starts. It's under 6 so that, with the win and shutout bonuses, goalie games average about
   * 6.0, a little over forwards' 5.9 (2025-26).
   */
  public static readonly goalieBaseRating = 5.75;

  /**
   * What each goal a goalie saves above average is worth (getGoalsSavedAboveAverage): more on a night above average
   * than below it, since one goalie swings a game more than any skater, so a great night is rated up to it.
   */
  public static readonly goalieAboveAverageWeight = 0.7;

  public static readonly goalieBelowAverageWeight = 0.6;

  /**
   * The league's save percentage at each strength, the average a goalie's saves are measured against: at even
   * strength, on the penalty kill (the boxscore's power play split) and on his own team's power play (its shorthanded
   * split). From the 2025-26 regular season.
   */
  public static readonly leagueEvenStrengthSavePctg = 0.903;

  public static readonly leaguePenaltyKillSavePctg = 0.853;

  public static readonly leaguePowerPlaySavePctg = 0.910;

  /**
   * The shots a goalie faced in an average full game of the 2025-26 regular season, where the workload term is 0. A
   * goalie who played less is measured against his share of it (getGoalieExpectedShotsAgainst).
   */
  public static readonly goalieAverageShotsAgainst = 26;

  /** The length of a regulation game, in seconds, that a goalie's time on ice is measured against. */
  public static readonly fullGameSeconds = 3600;

  /** What each shot faced over getGoalieExpectedShotsAgainst adds, or each one under takes off. */
  public static readonly goalieWorkloadWeight = 0.02;

  /** What a goalie's win adds. */
  public static readonly goalieWinBonus = 0.3;

  /** What a shutout win adds on top of the win, for every shot faced (getGoalieShutoutBonus). */
  public static readonly goalieShutoutBonusPerShot = 0.065;

  /** A boxscore goalie's decision for a win; the others are "L" and "O" (an overtime or shootout loss). */
  public static readonly winDecision = "W";

  /**
   * Calculates the HokMob rating of a skater for a single live or past game, from 0 to 10.
   *
   * The faceoff term, (win percentage - 0.5), is scaled by the faceoffs taken up to fullWeightFaceoffCount, so losing
   * 2 draws costs less than losing 20. Without a count, it falls back to the full term for centers only.
   *
   * An assist is weighted by whether it was primary or secondary (getAssistRating), when the context says which.
   *
   * Each penalty drawn adds penaltyDrawnWeight, when the context has the count. It's the NHL's count, so a fight
   * credits each fighter with the other's major, and that major's 5 minutes aren't deducted.
   *
   * realPlusMinus takes out the skater's own points, so what is left is the goals he was on the ice for. Plus/minus
   * doesn't count power play goals at all, so his power play goals and assists are added back in; the boxscore has
   * powerPlayGoals but no powerPlayAssists, so those come from the context.
   *
   * @param skater - The skater's boxscore stats.
   * @param context - The faceoffs the skater took, his assist split, his power play assists and the penalties he drew,
   * whichever are known.
   */
  public static calculateSkaterHokmobRating(skater: BoxscoreSkater, context?: SkaterRatingContext): number {
    return parseFloat(Math.min(10.0, StatsUtils.getSkaterRawRating(skater, context)).toFixed(1));
  }

  /**
   * The total of a skater's rating terms (calculateSkaterHokmobRating) before it's capped at 10 and rounded. The
   * history page ranks the games capped at 10 by it.
   *
   * @param skater - The skater's boxscore stats.
   * @param context - The faceoffs the skater took, his assist split, his power play assists and the penalties he drew,
   * whichever are known.
   */
  public static getSkaterRawRating(skater: BoxscoreSkater, context?: SkaterRatingContext): number {
    const goals = skater.goals ?? 0;
    const assists = skater.assists ?? 0;
    const plusMinus = skater.plusMinus ?? 0;
    let hokmobRating = 5;
    hokmobRating += (goals * StatsUtils.goalWeight);
    hokmobRating += StatsUtils.getAssistRating(assists, context);
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
    hokmobRating += (Math.max(0, context?.penaltiesDrawn ?? 0) * StatsUtils.penaltyDrawnWeight);

    const powerPlayAssists = Math.min(assists, Math.max(0, context?.powerPlayAssists ?? 0));
    let realPlusMinus = (plusMinus - goals + (skater.powerPlayGoals ?? 0) - assists + powerPlayAssists);
    if (plusMinus > 0) {
      hokmobRating += (realPlusMinus * 0.3);
    } else {
      hokmobRating += (plusMinus * 0.5);
    }

    hokmobRating -= ((skater.giveaways ?? 0) * 0.2);

    const faceoffTerm = -0.5 + (skater.faceoffWinningPctg ?? 0);
    const faceoffsTaken = context?.faceoffsTaken;
    if (faceoffsTaken != null) {
      hokmobRating += faceoffTerm * Math.min(1, faceoffsTaken / StatsUtils.fullWeightFaceoffCount);
    } else if (skater.position === "C") {
      hokmobRating += faceoffTerm;
    }

    return hokmobRating;
  }

  /**
   * The rating a skater's assists are worth. A primary assist counts for primaryAssistWeight and a secondary one for
   * secondaryAssistWeight, but only when both are known and they add up to the assists the boxscore credits him with.
   * Anything else — a source without the split, or a live game whose landing and boxscore disagree for a moment —
   * counts every assist at the flat unknownAssistWeight, rather than rating the same game two different ways. A
   * goalie's assists are weighted the same way.
   *
   * @param assists - The skater's or goalie's assists.
   * @param context - The rating context, which may carry the split.
   */
  public static getAssistRating(assists: number,
                                context?: { primaryAssists?: number, secondaryAssists?: number }): number {
    const primaryAssists = context?.primaryAssists;
    const secondaryAssists = context?.secondaryAssists;
    if (primaryAssists != null && secondaryAssists != null && primaryAssists + secondaryAssists === assists) {
      return (primaryAssists * StatsUtils.primaryAssistWeight) +
          (secondaryAssists * StatsUtils.secondaryAssistWeight);
    }
    return assists * StatsUtils.unknownAssistWeight;
  }

  /**
   * Counts the assists each player was credited with in a game, by player ID: how many were primary (first) and
   * secondary (second), and how many came on a power play.
   *
   * These come from the landing's scoring summary rather than play-by-play, because only it labels a goal's
   * strength. A goal's skater counts alone can't: a team that pulls its goalie on a delayed penalty scores 6 on 5 at
   * even strength, and a team already on a power play can pull its goalie too, so the situationCode is the same
   * either way. Shootout goals have no assists, so they count for nothing.
   *
   * @param landing - The game's landing response.
   */
  public static getAssistCounts(landing: GameLanding): Map<number, AssistCounts> {
    const assistCounts = new Map<number, AssistCounts>();
    const goals = (landing?.summary?.scoring ?? []).flatMap(period => period?.goals ?? []);
    goals.forEach(goal => {
      const isPowerPlay = goal?.strength === StatsUtils.powerPlayStrength;
      (goal?.assists ?? []).forEach((assist, index) => {
        if (assist?.playerId == null) {
          return;
        }
        const counts = assistCounts.get(assist.playerId) ?? {primary: 0, secondary: 0, powerPlay: 0};
        if (index === 0) {
          counts.primary++;
        } else {
          counts.secondary++;
        }
        if (isPowerPlay) {
          counts.powerPlay++;
        }
        assistCounts.set(assist.playerId, counts);
      });
    });
    return assistCounts;
  }

  /**
   * Counts a goalie's goals and assists from the landing's scoring summary, which the boxscore doesn't have for a
   * goalie: his goals, usually into an empty net, and his primary and secondary assists. Shootout goals aren't in the
   * scoring summary, so they don't count, the same as for a skater.
   *
   * @param landing - The game's landing response.
   * @param goalieId - The goalie's player ID.
   * @param assistCounts - The game's assists by player ID (getAssistCounts), when they're already counted.
   */
  public static getGoalieRatingContext(landing: GameLanding, goalieId: number,
                                       assistCounts?: Map<number, AssistCounts>): GoalieRatingContext {
    const goals = (landing?.summary?.scoring ?? []).flatMap(period => period?.goals ?? [])
        .filter(goal => goal?.playerId === goalieId).length;
    const assists = (assistCounts ?? StatsUtils.getAssistCounts(landing)).get(goalieId);
    const primaryAssists = assists?.primary ?? 0;
    const secondaryAssists = assists?.secondary ?? 0;
    return {goals, assists: primaryAssists + secondaryAssists, primaryAssists, secondaryAssists};
  }

  /**
   * Calculates the HokMob rating of a goalie for a single live or past game, from 0 to 10. A goalie who faced no
   * shots (no savePctg) gets 0. The terms are in getGoalieRawRating.
   *
   * @param goalie - The goalie's boxscore stats.
   * @param context - The goalie's goals and assists, which the boxscore doesn't have.
   */
  public static calculateGoalieHokMobRating(goalie: BoxscoreGoalie, context?: GoalieRatingContext): number {
    if (!goalie.savePctg) {
      return 0;
    }
    return parseFloat(Math.max(0, Math.min(10.0, StatsUtils.getGoalieRawRating(goalie, context))).toFixed(1));
  }

  /**
   * The total of a goalie's rating terms (calculateGoalieHokMobRating) before it's kept between 0 and 10 and rounded.
   * The history page ranks the games capped at 10 by it.
   *
   * It starts from goalieBaseRating and adds:
   * - The goals he saved above an average goalie (getGoalsSavedAboveAverage), times getGoalsSavedAboveAverageWeight:
   *   more for a night above average than below it. An average save percentage rates the same on 20 shots as on 45.
   * - goalieWorkloadWeight for every shot faced over the ones an average goalie faces in his time on ice
   *   (getGoalieExpectedShotsAgainst), or takes it off for every shot under, so a live game's goalie isn't marked down
   *   for the shots he hasn't had time to face yet.
   * - goalieWinBonus for a win, and goalieShutoutBonusPerShot for every shot he faced on top when he started it and no
   *   shot he faced went in (isShutoutWin). A live game has no decision yet, so both only count once it's over.
   * - goalWeight for each goal he scored and getAssistRating for his assists, the same as a skater gets.
   *
   * @param goalie - The goalie's boxscore stats.
   * @param context - The goalie's goals and assists, which the boxscore doesn't have.
   */
  public static getGoalieRawRating(goalie: BoxscoreGoalie, context?: GoalieRatingContext): number {
    const goalsSavedAboveAverage = StatsUtils.getGoalsSavedAboveAverage(goalie);
    let hokmobRating = StatsUtils.goalieBaseRating;
    hokmobRating += goalsSavedAboveAverage * StatsUtils.getGoalsSavedAboveAverageWeight(goalsSavedAboveAverage);
    hokmobRating += ((goalie.shotsAgainst ?? 0) - StatsUtils.getGoalieExpectedShotsAgainst(goalie)) *
        StatsUtils.goalieWorkloadWeight;
    if (goalie.decision === StatsUtils.winDecision) {
      hokmobRating += StatsUtils.goalieWinBonus;
    }
    hokmobRating += StatsUtils.getGoalieShutoutBonus(goalie);
    hokmobRating += Math.max(0, context?.goals ?? 0) * StatsUtils.goalWeight;
    hokmobRating += StatsUtils.getAssistRating(Math.max(0, context?.assists ?? 0), context);
    return hokmobRating;
  }

  /**
   * What each goal saved above average is worth: goalieAboveAverageWeight when the goalie saved more than an average
   * goalie would have, and goalieBelowAverageWeight when he saved fewer.
   *
   * @param goalsSavedAboveAverage - The goalie's goals saved above average (getGoalsSavedAboveAverage).
   */
  public static getGoalsSavedAboveAverageWeight(goalsSavedAboveAverage: number): number {
    return goalsSavedAboveAverage > 0 ? StatsUtils.goalieAboveAverageWeight : StatsUtils.goalieBelowAverageWeight;
  }

  /**
   * The shutout bonus: goalieShutoutBonusPerShot for every shot faced in a shutout win (isShutoutWin), so a busy
   * shutout is worth more than a quiet one, and 0 otherwise. A shutout of more than 30 shots reaches 10.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static getGoalieShutoutBonus(goalie: BoxscoreGoalie): number {
    return StatsUtils.isShutoutWin(goalie) ? (goalie.shotsAgainst ?? 0) * StatsUtils.goalieShutoutBonusPerShot : 0;
  }

  /**
   * The goals a goalie saved above an average goalie facing the same shots: at each strength, his saves minus the
   * saves the league's save percentage at that strength would have made. Negative when he let in more than average.
   * The boxscore's power play split is the shots he faced on the penalty kill, and its shorthanded split the ones
   * faced on his own team's power play.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static getGoalsSavedAboveAverage(goalie: BoxscoreGoalie): number {
    return StatsUtils.getSavesAboveAverage(goalie?.evenStrengthShotsAgainst, StatsUtils.leagueEvenStrengthSavePctg) +
        StatsUtils.getSavesAboveAverage(goalie?.powerPlayShotsAgainst, StatsUtils.leaguePenaltyKillSavePctg) +
        StatsUtils.getSavesAboveAverage(goalie?.shorthandedShotsAgainst, StatsUtils.leaguePowerPlaySavePctg);
  }

  /**
   * The shots an average goalie faces in the time a goalie played, the workload term's baseline:
   * goalieAverageShotsAgainst, scaled by his time on ice out of a full game (fullGameSeconds). It's the whole average
   * once he's played 60 minutes, overtime or not, and for a time on ice that can't be read, so a missing time never
   * reads as no time played.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static getGoalieExpectedShotsAgainst(goalie: BoxscoreGoalie): number {
    const seconds = StatsUtils.getTimeOnIceSeconds(goalie?.toi);
    const share = seconds > 0 ? Math.min(1, seconds / StatsUtils.fullGameSeconds) : 1;
    return StatsUtils.goalieAverageShotsAgainst * share;
  }

  /**
   * The saves a boxscore "saves/shots" split has over the ones a league average save percentage would make on the
   * same shots, like 28 - 0.903 x 30 = 0.91 for "28/30" at even strength.
   *
   * @param savesAndShots - The split, like "28/30".
   * @param leagueSavePctg - The league's save percentage at that strength, 0 to 1.
   */
  public static getSavesAboveAverage(savesAndShots: string, leagueSavePctg: number): number {
    return StatsUtils.getSaves(savesAndShots) - leagueSavePctg * StatsUtils.getShots(savesAndShots);
  }

  /**
   * Whether a goalie gets the shutout bonus: he started, won, and none of the shots he faced went in. It's close to
   * the NHL's shutout credit but not the same, since the boxscore doesn't carry that: it counts a win in which his
   * team gave up a goal that wasn't on him (an empty net on a delayed penalty), and leaves out a 0-0 shootout loss.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static isShutoutWin(goalie: BoxscoreGoalie): boolean {
    return !!goalie?.starter && goalie.decision === StatsUtils.winDecision &&
        (goalie.shotsAgainst ?? 0) > 0 && (goalie.saves ?? 0) === goalie.shotsAgainst;
  }

  /**
   * The goalie rating before goals saved above average (getGoalieRawRating), from 5: 1/5 a save on the penalty kill,
   * 1/6 a save at even strength and on the power play, and -1 a goal against. Unused, but kept to go back to.
   *
   * It paid for volume: it broke even at a .857 save percentage, well under the league's, so an average goalie rated
   * higher the more shots he faced, and a goal costing a whole point spread goalies twice as wide as skaters (2025-26:
   * 38.6% of goalie games green and 14.6% blue, against 15.1% and 1.8% for forwards).
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static getLegacyGoalieRawRating(goalie: BoxscoreGoalie): number {
    let hokmobRating = 5;
    hokmobRating += (StatsUtils.getSaves(goalie.evenStrengthShotsAgainst) / 6);
    hokmobRating += (StatsUtils.getSaves(goalie.powerPlayShotsAgainst) / 5);
    hokmobRating += (StatsUtils.getSaves(goalie.shorthandedShotsAgainst) / 6);
    hokmobRating -= ((goalie.shotsAgainst ?? 0) - (goalie.saves ?? 0));
    return hokmobRating;
  }

  /**
   * Returns the saves from a boxscore saves/shots string, like 28 for "28/30", or 0 when it can't be read.
   */
  public static getSaves(savesAndShots: string): number {
    const saves = parseInt((savesAndShots ?? "").split("/")[0], 10);
    return isNaN(saves) ? 0 : saves;
  }

  /**
   * Returns the shots from a boxscore saves/shots string, like 30 for "28/30", or 0 when it can't be read.
   */
  public static getShots(savesAndShots: string): number {
    const shots = parseInt((savesAndShots ?? "").split("/")[1], 10);
    return isNaN(shots) ? 0 : shots;
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
   * Rates a stats API skater game row: toBoxscoreSkater, with the row's faceoffs taken, assist split, power play
   * assists and penalties drawn as the rating context. The player page's recent games and the history page both rate
   * rows through it, so the two always agree.
   *
   * @param game - The skater's stats for one game.
   */
  public static calculateSkaterGameRating(game: SkaterGameStats): number {
    return StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(game), StatsUtils.toRatingContext(game));
  }

  /**
   * A stats API skater game row's rating before it's capped at 10 (getSkaterRawRating).
   *
   * @param game - The skater's stats for one game.
   */
  public static getSkaterGameRawRating(game: SkaterGameStats): number {
    return StatsUtils.getSkaterRawRating(StatsUtils.toBoxscoreSkater(game), StatsUtils.toRatingContext(game));
  }

  /**
   * Rates a stats API goalie game row, through toBoxscoreGoalie. A goalie who faced no shots gets 0.
   *
   * @param game - The goalie's stats for one game.
   */
  public static calculateGoalieGameRating(game: GoalieGameStats): number {
    return StatsUtils.calculateGoalieHokMobRating(StatsUtils.toBoxscoreGoalie(game),
        StatsUtils.toGoalieRatingContext(game));
  }

  /**
   * A stats API goalie game row's rating before it's kept between 0 and 10 (getGoalieRawRating).
   *
   * @param game - The goalie's stats for one game.
   */
  public static getGoalieGameRawRating(game: GoalieGameStats): number {
    return StatsUtils.getGoalieRawRating(StatsUtils.toBoxscoreGoalie(game), StatsUtils.toGoalieRatingContext(game));
  }

  /**
   * The rating context of a stats API skater game row: its faceoffs taken, assist split, power play assists and
   * penalties drawn.
   */
  private static toRatingContext(game: SkaterGameStats): SkaterRatingContext {
    return {
      faceoffsTaken: game?.totalFaceoffs,
      primaryAssists: game?.totalPrimaryAssists,
      secondaryAssists: game?.totalSecondaryAssists,
      powerPlayAssists: game?.ppAssists,
      penaltiesDrawn: game?.penaltiesDrawn
    };
  }

  /**
   * The rating context of a stats API goalie game row: its goals and assists. The stats API has no assist split for
   * a goalie, so his assists count at the flat weight.
   */
  public static toGoalieRatingContext(game: GoalieGameStats): GoalieRatingContext {
    return {goals: game?.goals ?? 0, assists: game?.assists ?? 0};
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
   * @param assistCounts - The assists by player ID (StatsUtils.getAssistCounts), if the landing is loaded.
   * @param penaltiesDrawnCounts - The penalties drawn by player ID (PlayByPlayUtils.getPenaltiesDrawnCounts), if
   * loaded.
   * @param landing - The game's landing, if loaded, for the goalies' goals and assists (getGoalieRatingContext).
   */
  public static getGamePlayers(boxscore: Boxscore, isHome: boolean, rosterSpots?: Map<number, RosterSpot>,
                               faceoffCounts?: Map<number, number>,
                               assistCounts?: Map<number, AssistCounts>,
                               penaltiesDrawnCounts?: Map<number, number>,
                               landing?: GameLanding): GamePlayer[] {
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
    const skaters = [...(players.forwards ?? []), ...(players.defense ?? [])].map(skater => {
      const assists = assistCounts?.get(skater.playerId);
      const ratingContext: SkaterRatingContext = {
        faceoffsTaken: faceoffCounts ? (faceoffCounts.get(skater.playerId) ?? 0) : undefined,
        primaryAssists: assistCounts ? (assists?.primary ?? 0) : undefined,
        secondaryAssists: assistCounts ? (assists?.secondary ?? 0) : undefined,
        powerPlayAssists: assistCounts ? (assists?.powerPlay ?? 0) : undefined,
        penaltiesDrawn: penaltiesDrawnCounts ? (penaltiesDrawnCounts.get(skater.playerId) ?? 0) : undefined
      };
      return {
        ...toGamePlayer(skater),
        skaterStats: skater,
        ratingContext,
        hokmobRating: StatsUtils.calculateSkaterHokmobRating(skater, ratingContext)
      };
    });
    const goalies = (players.goalies ?? []).map(goalie => {
      const goalieRatingContext = landing
          ? StatsUtils.getGoalieRatingContext(landing, goalie.playerId, assistCounts)
          : undefined;
      return {
        ...toGamePlayer(goalie),
        goalieStats: goalie,
        goalieRatingContext,
        hokmobRating: StatsUtils.calculateGoalieHokMobRating(goalie, goalieRatingContext)
      };
    });
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
   * Sorts a team's star players ahead of the rest, the bigger star first (NhlStarPlayerUtils). Only used to break a
   * tie in HokMob ratings, so a star is never shown ahead of a better rated teammate.
   */
  public static sortByStarPlayer(playerA: GamePlayer, playerB: GamePlayer): number {
    const rank = (player: GamePlayer) => NhlStarPlayerUtils.getStarRank(player?.playerId) ?? Number.MAX_SAFE_INTEGER;
    return rank(playerA) - rank(playerB);
  }
}
