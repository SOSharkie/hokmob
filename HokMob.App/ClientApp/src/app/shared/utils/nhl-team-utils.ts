import {NhlTeamCustomModel} from "@shared/models/nhl-team.model";

export class NhlTeamUtils {

  /**
   * All team IDs, including former teams (Arizona, 53) for historical games.
   */
  private static readonly teamIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 28, 29, 30, 52, 53, 54, 55, 68];

  /**
   * The ID of Arizona, which moved to Utah (68) after the 2023-24 season. Its games and stats are still in the API,
   * but it has no current roster, schedule or standings row.
   */
  private static readonly formerTeamIds = [53];

  private static teamIdsByAbbrev: Map<string, number>;

  /**
   * Gets the IDs of the 32 active teams, for the search results and for validating a team page's route.
   */
  public static getActiveTeamIds(): number[] {
    return NhlTeamUtils.teamIds.filter(id => !NhlTeamUtils.formerTeamIds.includes(id));
  }

  /**
   * Gets a team ID from its abbreviation, like "SJS". Returns undefined for an unknown abbreviation.
   * Needed because new NHL API standings rows have no team ID.
   *
   * @param abbrev - The team abbreviation.
   */
  public static getTeamIdByAbbrev(abbrev: string): number {
    if (!NhlTeamUtils.teamIdsByAbbrev) {
      NhlTeamUtils.teamIdsByAbbrev = new Map(NhlTeamUtils.teamIds.map(id => [NhlTeamUtils.getTeam(id).triCode, id]));
    }
    return NhlTeamUtils.teamIdsByAbbrev.get(abbrev?.toUpperCase());
  }

  public static getTeam(teamId: number): NhlTeamCustomModel {
    switch (teamId) {
      case 1:
        return {
          id: 1,
          name: "New Jersey Devils",
          shortName: "New Jersey",
          teamName: "Devils",
          triCode: "NJD"
        }
      case 2:
        return {
          id: 2,
          name: "New York Islanders",
          shortName: "NY Islanders",
          teamName: "Islanders",
          triCode: "NYI"
        }
      case 3:
        return {
          id: 3,
          name: "New York Rangers",
          shortName: "NY Rangers",
          teamName: "Rangers",
          triCode: "NYR"
        }
      case 4:
        return {
          id: 4,
          name: "Philadelphia Flyers",
          shortName: "Philadelphia",
          teamName: "Flyers",
          triCode: "PHI"
        }
      case 5:
        return {
          id: 5,
          name: "Pittsburgh Penguins",
          shortName: "Pittsburgh",
          teamName: "Penguins",
          triCode: "PIT"
        }
      case 6:
        return {
          id: 6,
          name: "Boston Bruins",
          shortName: "Boston",
          teamName: "Bruins",
          triCode: "BOS"
        }
      case 7:
        return {
          id: 7,
          name: "Buffalo Sabres",
          shortName: "Buffalo",
          teamName: "Sabres",
          triCode: "BUF"
        }
      case 8:
        return {
          id: 8,
          name: "Montréal Canadiens",
          shortName: "Montreal",
          teamName: "Canadiens",
          triCode: "MTL"
        }
      case 9:
        return {
          id: 9,
          name: "Ottawa Senators",
          shortName: "Ottawa",
          teamName: "Senators",
          triCode: "OTT"
        }
      case 10:
        return {
          id: 10,
          name: "Toronto Maple Leafs",
          shortName: "Toronto",
          teamName: "Maple Leafs",
          triCode: "TOR"
        }
      case 12:
        return {
          id: 12,
          name: "Carolina Hurricanes",
          shortName: "Carolina",
          teamName: "Hurricanes",
          triCode: "CAR"
        }
      case 13:
        return {
          id: 13,
          name: "Florida Panthers",
          shortName: "Florida",
          teamName: "Panthers",
          triCode: "FLA"
        }
      case 14:
        return {
          id: 14,
          name: "Tampa Bay Lightning",
          shortName: "Tampa Bay",
          teamName: "Lightning",
          triCode: "TBL"
        }
      case 15:
        return {
          id: 15,
          name: "Washington Capitals",
          shortName: "Washington",
          teamName: "Capitals",
          triCode: "WSH"
        }
      case 16:
        return {
          id: 16,
          name: "Chicago Blackhawks",
          shortName: "Chicago",
          teamName: "Blackhawks",
          triCode: "CHI"
        }
      case 17:
        return {
          id: 17,
          name: "Detroit Red Wings",
          shortName: "Detroit",
          teamName: "Red Wings",
          triCode: "DET"
        }
      case 18:
        return {
          id: 18,
          name: "Nashville Predators",
          shortName: "Nashville",
          teamName: "Predators",
          triCode: "NSH"
        }
      case 19:
        return {
          id: 19,
          name: "St. Louis Blues",
          shortName: "St. Louis",
          teamName: "Blues",
          triCode: "STL"
        }
      case 20:
        return {
          id: 20,
          name: "Calgary Flames",
          shortName: "Calgary",
          teamName: "Flames",
          triCode: "CGY"
        }
      case 21:
        return {
          id: 21,
          name: "Colorado Avalanche",
          shortName: "Colorado",
          teamName: "Avalanche",
          triCode: "COL"
        }
      case 22:
        return {
          id: 22,
          name: "Edmonton Oilers",
          shortName: "Edmonton",
          teamName: "Oilers",
          triCode: "EDM"
        }
      case 23:
        return {
          id: 23,
          name: "Vancouver Canucks",
          shortName: "Vancouver",
          teamName: "Canucks",
          triCode: "VAN"
        }
      case 24:
        return {
          id: 24,
          name: "Anaheim Ducks",
          shortName: "Anaheim",
          teamName: "Ducks",
          triCode: "ANA"
        }
      case 25:
        return {
          id: 25,
          name: "Dallas Stars",
          shortName: "Dallas",
          teamName: "Stars",
          triCode: "DAL"
        }
      case 26:
        return {
          id: 26,
          name: "Los Angeles Kings",
          shortName: "Los Angeles",
          teamName: "Kings",
          triCode: "LAK"
        }
      case 28:
        return {
          id: 28,
          name: "San Jose Sharks",
          shortName: "San Jose",
          teamName: "Sharks",
          triCode: "SJS"
        }
      case 29:
        return {
          id: 29,
          name: "Columbus Blue Jackets",
          shortName: "Columbus",
          teamName: "Blue Jackets",
          triCode: "CBJ"
        }
      case 30:
        return {
          id: 30,
          name: "Minnesota Wild",
          shortName: "Minnesota",
          teamName: "Wild",
          triCode: "MIN"
        }
      case 52:
        return {
          id: 52,
          name: "Winnipeg Jets",
          shortName: "Winnipeg",
          teamName: "Jets",
          triCode: "WPG"
        }
      case 53:
        return {
          id: 53,
          name: "Arizona Coyotes",
          shortName: "Arizon",
          teamName: "Coyotes",
          triCode: "ARI"
        }
      case 54:
        return {
          id: 54,
          name: "Vegas Golden Knights",
          shortName: "Vegas",
          teamName: "Golden Knights",
          triCode: "VGK"
        }
      case 55:
        return {
          id: 55,
          name: "Seattle Kraken",
          shortName: "Seattle",
          teamName: "Kraken",
          triCode: "SEA"
        }
      case 68:
        return {
          id: 68,
          name: "Utah Mammoth",
          shortName: "Utah",
          teamName: "Mammoth",
          triCode: "UTA"
        }
      default:
        return {
          id: 100,
          name: "Unknown",
          shortName: "Unknown",
          teamName: "Unknown",
          triCode: "-"
        }
    }
  }
}
