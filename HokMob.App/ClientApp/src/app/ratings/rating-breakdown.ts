import {BoxscoreGoalie, BoxscoreSkater} from "@shared/models/nhl-web-api/boxscore.model";
import {SkaterRatingContext, StatsUtils} from "@shared/utils/stats-utils";

/**
 * One term of a HokMob rating: what a stat contributed, and where the rating stood after it.
 */
export interface RatingTerm {
  /** The stat the term comes from, like "Goals". */
  label: string;
  /** The arithmetic behind it, like "2 x 1.1". */
  detail: string;
  /** What the term added to the rating, or took off it. */
  value: number;
  /** The running rating after the term. */
  total: number;
}

/**
 * The breakdown of one rating: every term in the order the formula applies them, the raw total they add up to, and
 * the rating that is shown after the clamps.
 */
export interface RatingBreakdown {
  terms: RatingTerm[];
  /** The total of every term, before the clamps. */
  rawTotal: number;
  /** The rating StatsUtils returns: the raw total clamped and rounded to one decimal. */
  rating: number;
  /** Set when a clamp or a special case moved the rating off the raw total, like "Capped at 10". */
  clampNote?: string;
}

/**
 * Takes the HokMob rating formulas in {@link StatsUtils} apart, term by term, for the Ratings page's visualization. The
 * breakdowns follow `calculateSkaterHokmobRating` and `calculateGoalieHokMobRating` step for step, and the spec
 * checks every breakdown against the rating those two return.
 */
export class RatingBreakdownUtils {

  /** Where a rating starts, for both skaters and goalies: an average game. */
  public static readonly baseRating = 5;

  /** The most a rating can reach. Skaters have no floor; goalies stop at 0. */
  public static readonly maxRating = 10;

  /** The most penalty minutes can take off a skater's rating. */
  public static readonly maxPenaltyDeduction = 3;

  /**
   * Breaks a skater's rating into its terms, in the order `StatsUtils.calculateSkaterHokmobRating` applies them.
   *
   * @param skater - The skater's boxscore stats.
   * @param context - The faceoffs taken, the assist split and the power play assists, whichever are known.
   */
  public static getSkaterBreakdown(skater: BoxscoreSkater, context?: SkaterRatingContext): RatingBreakdown {
    const goals = skater.goals ?? 0;
    const assists = skater.assists ?? 0;
    const plusMinus = skater.plusMinus ?? 0;
    const powerPlayGoals = skater.powerPlayGoals ?? 0;
    const shotsOnGoal = skater.sog ?? 0;
    const terms: RatingTerm[] = [];
    let total = RatingBreakdownUtils.baseRating;

    const addTerm = (label: string, detail: string, value: number): void => {
      total += value;
      terms.push({label, detail, value, total});
    };

    terms.push({label: "Base", detail: "An average game", value: RatingBreakdownUtils.baseRating, total});
    addTerm("Goals", goals + " x 1.2", goals * 1.2);
    addTerm("Assists", RatingBreakdownUtils.getAssistDetail(assists, context),
        RatingBreakdownUtils.getAssistValue(assists, context));
    addTerm("Shots on goal", "(" + shotsOnGoal + " - " + goals + " scored) x 0.3", (shotsOnGoal - goals) * 0.3);
    addTerm("Hits", (skater.hits ?? 0) + " x 0.2", (skater.hits ?? 0) * 0.2);
    addTerm("Blocked shots", (skater.blockedShots ?? 0) + " x 0.2", (skater.blockedShots ?? 0) * 0.2);
    addTerm("Takeaways", (skater.takeaways ?? 0) + " x 0.2", (skater.takeaways ?? 0) * 0.2);
    addTerm("Penalty minutes", RatingBreakdownUtils.getPenaltyDetail(skater.pim ?? 0),
        RatingBreakdownUtils.getPenaltyValue(skater.pim ?? 0));

    // Goals and assists have already paid off above, so a plus the skater earned himself doesn't pay twice. His power
    // play points are added back, since plus/minus doesn't count a power play goal in the first place.
    const powerPlayAssists = Math.min(assists, Math.max(0, context?.powerPlayAssists ?? 0));
    if (plusMinus > 0) {
      addTerm("Plus/minus", "(" + plusMinus + " - " + goals + " G + " + powerPlayGoals + " PPG - " + assists +
          " A + " + powerPlayAssists + " PPA) x 0.3",
          (plusMinus - goals + powerPlayGoals - assists + powerPlayAssists) * 0.3);
    } else {
      addTerm("Plus/minus", plusMinus + " x 0.5", plusMinus * 0.5);
    }

    addTerm("Giveaways", (skater.giveaways ?? 0) + " x -0.2", (skater.giveaways ?? 0) * -0.2);

    const faceoffPct = skater.faceoffWinningPctg ?? 0;
    const faceoffTerm = faceoffPct - 0.5;
    const percentText = Math.round(faceoffPct * 100) + "%";
    const faceoffsTaken = context?.faceoffsTaken;
    if (faceoffsTaken != null) {
      const weight = Math.min(1, faceoffsTaken / StatsUtils.fullWeightFaceoffCount);
      const share = weight < 1
          ? " x " + RatingBreakdownUtils.round(weight) + ", for " + faceoffsTaken + " of " +
              StatsUtils.fullWeightFaceoffCount + " draws"
          : ", at full weight for " + faceoffsTaken + " draws";
      addTerm("Faceoffs", "(" + percentText + " - 50%)" + share, faceoffTerm * weight);
    } else if (skater.position === "C") {
      addTerm("Faceoffs", percentText + " - 50%, at full weight (a center, no draw count)", faceoffTerm);
    } else {
      addTerm("Faceoffs", "Not counted (no draw count, and not a center)", 0);
    }

    return RatingBreakdownUtils.toBreakdown(terms, total,
        StatsUtils.calculateSkaterHokmobRating(skater, context),
        total > RatingBreakdownUtils.maxRating ? "Capped at 10" : undefined);
  }

  /**
   * Whether the assist split can be used: both halves are known and they add up to the assists the boxscore credits
   * the skater with. Anything else is rated at the flat weight, the way `StatsUtils.getAssistRating` does it.
   */
  private static hasAssistSplit(assists: number, context?: SkaterRatingContext): boolean {
    return context?.primaryAssists != null && context?.secondaryAssists != null &&
        context.primaryAssists + context.secondaryAssists === assists;
  }

  /**
   * What a skater's assists are worth: the primary and secondary weights when the split is known, and the flat
   * weight otherwise.
   */
  private static getAssistValue(assists: number, context?: SkaterRatingContext): number {
    if (!RatingBreakdownUtils.hasAssistSplit(assists, context)) {
      return assists * StatsUtils.unknownAssistWeight;
    }
    return (context.primaryAssists * StatsUtils.primaryAssistWeight) +
        (context.secondaryAssists * StatsUtils.secondaryAssistWeight);
  }

  /**
   * The arithmetic behind the assist term, which says when the split was used and when it fell back to the flat
   * weight.
   */
  private static getAssistDetail(assists: number, context?: SkaterRatingContext): string {
    if (!RatingBreakdownUtils.hasAssistSplit(assists, context)) {
      return assists + " x " + StatsUtils.unknownAssistWeight + ", the split unknown";
    }
    return context.primaryAssists + " primary x " + StatsUtils.primaryAssistWeight + " + " +
        context.secondaryAssists + " secondary x " + StatsUtils.secondaryAssistWeight;
  }

  /**
   * Breaks a goalie's rating into its terms, in the order `StatsUtils.calculateGoalieHokMobRating` applies them. A
   * goalie who faced no shots is rated 0 outright, which the note says.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static getGoalieBreakdown(goalie: BoxscoreGoalie): RatingBreakdown {
    const terms: RatingTerm[] = [];
    let total = RatingBreakdownUtils.baseRating;

    const addTerm = (label: string, detail: string, value: number): void => {
      total += value;
      terms.push({label, detail, value, total});
    };

    terms.push({label: "Base", detail: "An average game", value: RatingBreakdownUtils.baseRating, total});

    const evenStrengthSaves = StatsUtils.getSaves(goalie.evenStrengthShotsAgainst);
    const shorthandedSaves = StatsUtils.getSaves(goalie.powerPlayShotsAgainst);
    const goalsAgainst = (goalie.shotsAgainst ?? 0) - (goalie.saves ?? 0);
    addTerm("Even strength saves", evenStrengthSaves + " / 6", evenStrengthSaves / 6);
    addTerm("Penalty kill saves", shorthandedSaves + " / 5, the boxscore's power play split",
        shorthandedSaves / 5);
    addTerm("Goals against", goalsAgainst + " x -1", -goalsAgainst);

    let clampNote: string;
    if (!goalie.savePctg) {
      clampNote = "Faced no shots, so the rating is 0";
    } else if (total > RatingBreakdownUtils.maxRating) {
      clampNote = "Capped at 10";
    } else if (total < 0) {
      clampNote = "Floored at 0";
    }
    return RatingBreakdownUtils.toBreakdown(terms, total, StatsUtils.calculateGoalieHokMobRating(goalie), clampNote);
  }

  /**
   * Rounds to a number of decimal places, so a term reads as "0.33" instead of "0.3333333333333333".
   *
   * @param value - The number to round.
   * @param decimals - The decimal places to keep, two by default.
   */
  public static round(value: number, decimals: number = 2): number {
    return parseFloat((value ?? 0).toFixed(decimals));
  }

  /**
   * What penalty minutes take off the rating, negated: 0.25 a minute, at most 3, with the five minutes of a fighting
   * major forgiven (5, 7, 9 and 11 penalty minutes each hold one).
   */
  private static getPenaltyValue(penaltyMinutes: number): number {
    if (!penaltyMinutes) {
      return 0;
    }
    const chargedMinutes = RatingBreakdownUtils.isFightingMajor(penaltyMinutes) ? penaltyMinutes - 5 : penaltyMinutes;
    return -Math.min(RatingBreakdownUtils.maxPenaltyDeduction, chargedMinutes * 0.25);
  }

  /**
   * The arithmetic behind the penalty term, which says when a fighting major was forgiven.
   */
  private static getPenaltyDetail(penaltyMinutes: number): string {
    if (!penaltyMinutes) {
      return "No penalties";
    }
    const cap = ", at most " + RatingBreakdownUtils.maxPenaltyDeduction;
    return RatingBreakdownUtils.isFightingMajor(penaltyMinutes)
        ? "(" + penaltyMinutes + " - 5 for fighting) x 0.25" + cap
        : penaltyMinutes + " x 0.25" + cap;
  }

  /**
   * Whether the penalty minutes hold a fighting major, whose five minutes the formula forgives.
   */
  private static isFightingMajor(penaltyMinutes: number): boolean {
    return penaltyMinutes === 5 || penaltyMinutes === 7 || penaltyMinutes === 9 || penaltyMinutes === 11;
  }

  /**
   * Builds the breakdown, rounding every term so the running totals in the visualization read cleanly.
   */
  private static toBreakdown(terms: RatingTerm[], rawTotal: number, rating: number,
                             clampNote?: string): RatingBreakdown {
    return {
      terms: terms.map(term => ({
        ...term,
        value: RatingBreakdownUtils.round(term.value),
        total: RatingBreakdownUtils.round(term.total)
      })),
      rawTotal: RatingBreakdownUtils.round(rawTotal),
      rating,
      clampNote
    };
  }
}
