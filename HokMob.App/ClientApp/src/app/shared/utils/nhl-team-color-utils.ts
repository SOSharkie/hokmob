
export class NhlTeamColorUtils {

  private static redTeams = [1, 4, 8, 9, 12, 13, 15, 16, 17, 20, 53];

  private static blueTeams = [2, 3, 7, 10, 14, 19, 22, 23, 29, 52];

  public static getTeamPrimaryColor(teamId: number): string {
    switch (teamId) {
      case 1:
        return "#CE1126";
      case 2:
        return "#00539B";
      case 3:
        return "#0038A8";
      case 4:
        return "#F74902";
      case 5:
        return "#FCB514";
      case 6:
        return "#FFB81C";
      case 7:
        return "#003087";
      case 8:
        return "#AF1E2D";
      case 9:
        return "#DA1A32";
      case 10:
        return "#00205B";
      case 12:
        return "#CE1126";
      case 13:
        return "#C8102E";
      case 14:
        return "#002868";
      case 15:
        return "#C8102E";
      case 16:
        return "#CF0A2C";
      case 17:
        return "#CE1126";
      case 18:
        return "#FFB81C";
      case 19:
        return "#002F87";
      case 20:
        return "#D2001C";
      case 21:
        return "#6F263D";
      case 22:
        return "#041E42";
      case 23:
        return "#00205B";
      case 24:
        return "#B9975B";
      case 25:
        return "#006847";
      case 26:
        return "#A2AAAD";
      case 28:
        return "#006D75";
      case 29:
        return "#002654";
      case 30:
        return "#154734";
      case 52:
        return "#041E42";
      case 53:
        return "#8C2633";
      case 54:
        return "#B4975A";
      case 55:
        return "#99D9D9";
      case 59:
      case 68:
        return "#6CACE4";
      default:
        return "#000000"
    }
  }

  /**
   * The text color for a label on the team's primary color: white, or near-black on the light primaries (Bruins,
   * Penguins and Predators gold, Flyers orange, Kings, Golden Knights, Sharks, Kraken and Utah), whichever reads with
   * more contrast. Either way it's at least 4.5:1 for every team.
   */
  public static getTeamTextColor(teamId: number): string {
    return NhlTeamColorUtils.getTextColorOn(NhlTeamColorUtils.getTeamPrimaryColor(teamId));
  }

  /**
   * White or near-black, whichever has more contrast against the given "#RRGGBB" background, by the WCAG contrast
   * ratio. A translucent "#RRGGBBAA" (like the light secondary color, "#FFFFFFB1") is judged as it shows on the cards'
   * dark background. White for anything else, like a missing color.
   */
  public static getTextColorOn(backgroundColor: string): string {
    const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(backgroundColor ?? "");
    if (!match) {
      return "#FFFFFF";
    }
    const color = match[2] ? NhlTeamColorUtils.blendOverCard(match[1], parseInt(match[2], 16) / 255) : "#" + match[1];
    const luminance = NhlTeamColorUtils.getRelativeLuminance(color);
    const darkLuminance = NhlTeamColorUtils.getRelativeLuminance(NhlTeamColorUtils.darkTextColor);
    const whiteContrast = 1.05 / (luminance + 0.05);
    const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
    return darkContrast > whiteContrast ? NhlTeamColorUtils.darkTextColor : "#FFFFFF";
  }

  /**
   * The team's primary color, lightened toward white until it stands out from the dark cards, for a shape drawn in the
   * team's color, like the player traits chart. The light primaries (gold, orange) stay as they are, and the dark
   * ones (navy, black, deep red) come out as a lighter shade of themselves.
   *
   * @param teamId - The team ID.
   */
  public static getTeamColorOnCard(teamId: number): string {
    return NhlTeamColorUtils.lightenForCard(NhlTeamColorUtils.getTeamPrimaryColor(teamId));
  }

  /**
   * A "#RRGGBB" color mixed with white in steps of 5% until it has at least minContrast against the cards' background
   * (3:1, the WCAG contrast for graphics), or the color itself when it already has. A color that can't be read comes
   * back unchanged.
   *
   * @param color - The color, like "#041E42".
   * @param minContrast - The contrast it needs with the cards.
   */
  public static lightenForCard(color: string, minContrast: number = 3): string {
    const match = /^#([0-9a-f]{6})$/i.exec(color ?? "");
    if (!match) {
      return color;
    }
    const cardLuminance = NhlTeamColorUtils.getRelativeLuminance(NhlTeamColorUtils.cardColor);
    for (let step = 0; step <= 20; step++) {
      const mixed = "#" + [0, 2, 4].map(start => {
        const channel = parseInt(match[1].substring(start, start + 2), 16);
        return Math.round(channel + (255 - channel) * step / 20).toString(16).padStart(2, "0");
      }).join("").toUpperCase();
      if ((NhlTeamColorUtils.getRelativeLuminance(mixed) + 0.05) / (cardLuminance + 0.05) >= minContrast) {
        return mixed;
      }
    }
    return "#FFFFFF";
  }

  private static readonly darkTextColor = "#1B1B1B";

  /** The cards' background ($black-02), which a translucent color is seen over. */
  private static readonly cardColor = "#1B1B1B";

  /**
   * A "#RRGGBB" color at the given opacity over the cards' background, as the "#RRGGBB" it shows as.
   */
  private static blendOverCard(rgb: string, alpha: number): string {
    return "#" + [0, 2, 4].map(start => {
      const channel = parseInt(rgb.substring(start, start + 2), 16);
      const card = parseInt(NhlTeamColorUtils.cardColor.substring(start + 1, start + 3), 16);
      return Math.round(alpha * channel + (1 - alpha) * card).toString(16).padStart(2, "0");
    }).join("");
  }

  /**
   * The WCAG relative luminance of a "#RRGGBB" color, from 0 for black to 1 for white.
   */
  private static getRelativeLuminance(color: string): number {
    const [red, green, blue] = [1, 3, 5].map(start => {
      const channel = parseInt(color.substring(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  public static getTeamSecondaryColor(primaryTeamId: number, secondaryTeamId: number): string {
    if (NhlTeamColorUtils.blueTeams.includes(primaryTeamId) && NhlTeamColorUtils.blueTeams.includes(secondaryTeamId)) {
      return "#FFFFFFB1";
    } else if (NhlTeamColorUtils.redTeams.includes(primaryTeamId) && NhlTeamColorUtils.redTeams.includes(secondaryTeamId)) {
      return "#FFFFFFB1";
    } else {
      return NhlTeamColorUtils.getTeamPrimaryColor(secondaryTeamId);
    }
  }
}
