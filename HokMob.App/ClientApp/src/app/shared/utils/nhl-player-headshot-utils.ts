/**
 * Player headshot URLs. Headshots are plain image URLs now (the old cms.nhl.bamgrid.com host is gone), so they're
 * used directly as <img src>, with the blank headshot as the fallback.
 */
export class NhlPlayerHeadshotUtils {

  public static readonly blankHeadshot = "assets/blank_headshot.png";

  /**
   * Returns the headshot URL for a player's team and season, like
   * "https://assets.nhle.com/mugs/nhl/20252026/WPG/8476460.png". Prefer the headshot of a roster spot or player
   * landing when there is one.
   *
   * @param season - The season, like 20252026.
   * @param teamAbbrev - The team abbreviation, like "WPG".
   * @param playerId - The player ID.
   */
  public static getHeadshotUrl(season: number, teamAbbrev: string, playerId: number): string {
    if (!season || !teamAbbrev || !playerId) {
      return NhlPlayerHeadshotUtils.blankHeadshot;
    }
    return "https://assets.nhle.com/mugs/nhl/" + season + "/" + teamAbbrev + "/" + playerId + ".png";
  }

  /**
   * Replaces a headshot that failed to load with the blank headshot. Bind it to the image's (error) event.
   */
  public static showBlankHeadshot(event: Event): void {
    const image = event?.target as HTMLImageElement;
    if (image && !image.src.endsWith(NhlPlayerHeadshotUtils.blankHeadshot)) {
      image.src = NhlPlayerHeadshotUtils.blankHeadshot;
    }
  }
}
