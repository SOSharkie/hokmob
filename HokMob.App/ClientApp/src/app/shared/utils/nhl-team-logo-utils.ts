export class NhlTeamLogoUtils {

  public static getTeamPrimaryLogo(teamId: number): string {

    let imagePath = "assets/logos/";

    switch (teamId) {
      case 1:
        imagePath += "new_jersey";
        break;
      case 2:
        imagePath += "ny_islanders";
        break;
      case 3:
        imagePath += "ny_rangers";
        break;
      case 4:
        imagePath += "philadelphia";
        break;
      case 5:
        imagePath += "pittsburgh";
        break;
      case 6:
        imagePath += "boston";
        break;
      case 7:
        imagePath += "buffalo";
        break;
      case 8:
        imagePath += "montreal";
        break;
      case 9:
        imagePath += "ottawa";
        break;
      case 10:
        imagePath += "toronto";
        break;
      case 12:
        imagePath += "carolina";
        break;
      case 13:
        imagePath += "florida";
        break;
      case 14:
        imagePath += "tampa_bay";
        break;
      case 15:
        imagePath += "washington";
        break;
      case 16:
        imagePath += "chicago";
        break;
      case 17:
        imagePath += "detroit";
        break;
      case 18:
        imagePath += "nashville";
        break;
      case 19:
        imagePath += "stlouis";
        break;
      case 20:
        imagePath += "calgary";
        break;
      case 21:
        imagePath += "colorado";
        break;
      case 22:
        imagePath += "edmonton";
        break;
      case 23:
        imagePath += "vancouver";
        break;
      case 24:
        imagePath += "anaheim";
        break;
      case 25:
        imagePath += "dallas";
        break;
      case 26:
        imagePath += "los_angeles";
        break;
      case 28:
        imagePath += "san_jose";
        break;
      case 29:
        imagePath += "columbus";
        break;
      case 30:
        imagePath += "minnesota";
        break;
      case 52:
        imagePath += "winnipeg";
        break;
      case 53:
        imagePath += "arizona";
        break;
      case 54:
        imagePath += "vegas";
        break;
      case 55:
        imagePath += "vegas";
        break;
      default:
        imagePath += "team_fallback"
    }

    imagePath += ".png";
    return imagePath;
  }

}
