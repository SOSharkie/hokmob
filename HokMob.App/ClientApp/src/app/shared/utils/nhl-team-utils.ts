import {NhlTeamCustomModel} from "@shared/models/nhl-general/nhl-team-custom.model";

export class NhlTeamUtils {

  public static getTeam(teamId: number): NhlTeamCustomModel {
    switch (teamId) {
      case 1:
        return {
          id: 1,
          name: "New Jersey Devils",
          shortName: "New Jersey",
          teamName: "Devils",
          triCode: "NJD",
          link: "/api/v1/teams/1"
        }
      case 2:
        return {
          id: 2,
          name: "New York Islanders",
          shortName: "NY Islanders",
          teamName: "Islanders",
          triCode: "NYI",
          link: "/api/v1/teams/2"
        }
      case 3:
        return {
          id: 3,
          name: "New York Rangers",
          shortName: "NY Rangers",
          teamName: "Rangers",
          triCode: "NYR",
          link: "/api/v1/teams/3"
        }
      case 4:
        return {
          id: 4,
          name: "Philadelphia Flyers",
          shortName: "Philadelphia",
          teamName: "Flyers",
          triCode: "PHI",
          link: "/api/v1/teams/4"
        }
      case 5:
        return {
          id: 5,
          name: "Pittsburgh Penguins",
          shortName: "Pittsburgh",
          teamName: "Penguins",
          triCode: "PIT",
          link: "/api/v1/teams/5"
        }
      case 6:
        return {
          id: 6,
          name: "Boston Bruins",
          shortName: "Boston",
          teamName: "Bruins",
          triCode: "BOS",
          link: "/api/v1/teams/6"
        }
      case 7:
        return {
          id: 7,
          name: "Buffalo Sabres",
          shortName: "Buffalo",
          teamName: "Sabres",
          triCode: "BUF",
          link: "/api/v1/teams/7"
        }
      case 8:
        return {
          id: 8,
          name: "Montréal Canadiens",
          shortName: "Montreal",
          teamName: "Canadiens",
          triCode: "MTL",
          link: "/api/v1/teams/8"
        }
      case 9:
        return {
          id: 9,
          name: "Ottawa Senators",
          shortName: "Ottawa",
          teamName: "Senators",
          triCode: "OTT",
          link: "/api/v1/teams/9"
        }
      case 10:
        return {
          id: 10,
          name: "Toronto Maple Leafs",
          shortName: "Toronto",
          teamName: "Maple Leafs",
          triCode: "TOR",
          link: "/api/v1/teams/10"
        }
      case 12:
        return {
          id: 12,
          name: "Carolina Hurricanes",
          shortName: "Carolina",
          teamName: "Hurricanes",
          triCode: "CAR",
          link: "/api/v1/teams/12"
        }
      case 13:
        return {
          id: 13,
          name: "Florida Panthers",
          shortName: "Florida",
          teamName: "Panthers",
          triCode: "FLA",
          link: "/api/v1/teams/13"
        }
      case 14:
        return {
          id: 14,
          name: "Tampa Bay Lightning",
          shortName: "Tampa Bay",
          teamName: "Lightning",
          triCode: "TBL",
          link: "/api/v1/teams/14"
        }
      case 15:
        return {
          id: 15,
          name: "Washington Capitals",
          shortName: "Washington",
          teamName: "Capitals",
          triCode: "WSH",
          link: "/api/v1/teams/15"
        }
      case 16:
        return {
          id: 16,
          name: "Chicago Blackhawks",
          shortName: "Chicago",
          teamName: "Blackhawks",
          triCode: "CHI",
          link: "/api/v1/teams/16"
        }
      case 17:
        return {
          id: 17,
          name: "Detroit Red Wings",
          shortName: "Detroit",
          teamName: "Red Wings",
          triCode: "DET",
          link: "/api/v1/teams/17"
        }
      case 18:
        return {
          id: 18,
          name: "Nashville Predators",
          shortName: "Nashville",
          teamName: "Predators",
          triCode: "NSH",
          link: "/api/v1/teams/18"
        }
      case 19:
        return {
          id: 19,
          name: "St. Louis Blues",
          shortName: "St. Louis",
          teamName: "Blues",
          triCode: "STL",
          link: "/api/v1/teams/19"
        }
      case 20:
        return {
          id: 20,
          name: "Calgary Flames",
          shortName: "Calgary",
          teamName: "Flames",
          triCode: "CGY",
          link: "/api/v1/teams/20"
        }
      case 21:
        return {
          id: 21,
          name: "Colorado Avalanche",
          shortName: "Colorado",
          teamName: "Avalanche",
          triCode: "COL",
          link: "/api/v1/teams/21"
        }
      case 22:
        return {
          id: 22,
          name: "Edmonton Oilers",
          shortName: "Edmonton",
          teamName: "Oilers",
          triCode: "EDM",
          link: "/api/v1/teams/22"
        }
      case 23:
        return {
          id: 23,
          name: "Vancouver Canucks",
          shortName: "Vancouver",
          teamName: "Canucks",
          triCode: "VAN",
          link: "/api/v1/teams/23"
        }
      case 24:
        return {
          id: 24,
          name: "Anaheim Ducks",
          shortName: "Anaheim",
          teamName: "Ducks",
          triCode: "ANA",
          link: "/api/v1/teams/24"
        }
      case 25:
        return {
          id: 25,
          name: "Dallas Stars",
          shortName: "Dallas",
          teamName: "Stars",
          triCode: "DAL",
          link: "/api/v1/teams/25"
        }
      case 26:
        return {
          id: 26,
          name: "Los Angeles Kings",
          shortName: "Los Angeles",
          teamName: "Kings",
          triCode: "LAK",
          link: "/api/v1/teams/26"
        }
      case 28:
        return {
          id: 28,
          name: "San Jose Sharks",
          shortName: "San Jose",
          teamName: "Sharks",
          triCode: "SJS",
          link: "/api/v1/teams/28"
        }
      case 29:
        return {
          id: 29,
          name: "Columbus Blue Jackets",
          shortName: "Columbus",
          teamName: "Blue Jackets",
          triCode: "CBJ",
          link: "/api/v1/teams/29"
        }
      case 30:
        return {
          id: 30,
          name: "Minnesota Wild",
          shortName: "Minnesota",
          teamName: "Wild",
          triCode: "MIN",
          link: "/api/v1/teams/30"
        }
      case 53:
        return {
          id: 53,
          name: "Arizona Coyotes",
          shortName: "Arizon",
          teamName: "Coyotes",
          triCode: "ARI",
          link: "/api/v1/teams/53"
        }
      case 54:
        return {
          id: 54,
          name: "Vegas Golden Knights",
          shortName: "Vegas",
          teamName: "Golden Knights",
          triCode: "VGK",
          link: "/api/v1/teams/54"
        }
      case 55:
        return {
          id: 55,
          name: "Seattle Kraken",
          shortName: "Seattle",
          teamName: "Kraken",
          triCode: "SEA",
          link: "/api/v1/teams/55"
        }
      default:
        return {
          id: 100,
          name: "Unknown",
          shortName: "Unknown",
          teamName: "Unknown",
          triCode: "-",
          link: ""
        }
    }
  }
}
