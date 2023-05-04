
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
      default:
        return "#000000"
    }
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
