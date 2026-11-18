/**
 * A rating's tier, which picks its color: elite (blue), good (green), ordinary (orange) and poor (red). Each scale sets
 * its own cut points from how its ratings spread, so a tier means about the same share of ratings on every scale:
 * elite the top 3 to 5%, good the next 20% or so, ordinary the middle, and poor the bottom 20% or so.
 */
export type RatingTier = "elite" | "good" | "ordinary" | "poor";

/**
 * The rating scales the app colors: a player's game rating, a player's average rating over a season (which spreads
 * much less than a single game), and a team's power rating.
 */
export type RatingScale = "game" | "seasonAverage" | "team";

/** The lowest rating of each tier above poor. */
export interface RatingCutPoints {
  elite: number;
  good: number;
  ordinary: number;
}

/** The ratings of one tier on a scale, from `from` up to `to`. */
export interface RatingTierRange {
  tier: RatingTier;
  from: number;
  to: number;
}

/**
 * Turns ratings into their tier and color. The colors are the `--rating-{tier}` custom properties in `styles.scss`, so
 * stylesheets and style bindings share one value.
 */
export class RatingColorUtils {

  /** The tiers from best to worst. */
  public static readonly tiers: RatingTier[] = ["elite", "good", "ordinary", "poor"];

  /**
   * Each scale's cut points, set from the 2024-25 and 2025-26 regular seasons (the team scale from the power rating's
   * design, 5 at the league average and 1.5 points per standard deviation):
   * - game: the median skater game is about 5.8, so 8 / 6.5 / 5 colors about 3% blue, 20% green, 59% orange, 18% red.
   * - seasonAverage: skaters with 20+ games average 4.9 to 7.1, so 6.5 / 6 / 5.5 colors about 3%, 20%, 57%, 20%.
   * - team: 7.5 / 6 / 3.5 colors about 5%, 20%, 59%, 16%, with the league average in orange.
   */
  public static readonly cutPoints: Record<RatingScale, RatingCutPoints> = {
    game: {elite: 8, good: 6.5, ordinary: 5},
    seasonAverage: {elite: 6.5, good: 6, ordinary: 5.5},
    team: {elite: 7.5, good: 6, ordinary: 3.5}
  };

  /**
   * A rating's tier on a scale, or null without a rating.
   */
  public static getTier(rating: number, scale: RatingScale): RatingTier {
    if (rating == null || isNaN(rating)) {
      return null;
    }
    const cutPoints = RatingColorUtils.cutPoints[scale];
    if (rating >= cutPoints.elite) {
      return "elite";
    }
    if (rating >= cutPoints.good) {
      return "good";
    }
    return rating >= cutPoints.ordinary ? "ordinary" : "poor";
  }

  /**
   * A scale's tiers as ranges from `min` to `max`, worst first, like poor 0 to 5, ordinary 5 to 6.5, good 6.5 to 8 and
   * elite 8 to 10 on the game scale: for drawing the scale.
   */
  public static getTierRanges(scale: RatingScale, min: number, max: number): RatingTierRange[] {
    const cutPoints = RatingColorUtils.cutPoints[scale];
    return [
      {tier: "poor", from: min, to: cutPoints.ordinary},
      {tier: "ordinary", from: cutPoints.ordinary, to: cutPoints.good},
      {tier: "good", from: cutPoints.good, to: cutPoints.elite},
      {tier: "elite", from: cutPoints.elite, to: max}
    ];
  }

  /**
   * A tier's color, as a CSS custom property for a style binding, like "var(--rating-good)". Undefined without a tier.
   */
  public static getTierColor(tier: RatingTier): string {
    return tier ? `var(--rating-${tier})` : undefined;
  }

  /**
   * A rating's color on a scale, for a style binding. Undefined without a rating, so its badge has no color.
   */
  public static getColor(rating: number, scale: RatingScale): string {
    return RatingColorUtils.getTierColor(RatingColorUtils.getTier(rating, scale));
  }

  /**
   * A tier's color as the page's value of its custom property, like "#1ec854", for a canvas, which can't read a
   * `var()`. Empty if the page has no styles.
   */
  public static resolveTierColor(tier: RatingTier): string {
    return getComputedStyle(document.documentElement).getPropertyValue(`--rating-${tier}`).trim();
  }
}
