import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";
import {NhlBoxscorePlayerSkaterStatsModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player-skater-stats.model";

export class StatsUtils {

  public static calculateSkaterHokmobRating(skaterStats: NhlBoxscorePlayerSkaterStatsModel): number {
    let hokmobRating = 5;
    hokmobRating += (skaterStats.goals * 1.1);
    hokmobRating += (skaterStats.assists * 0.5);
    hokmobRating += ((skaterStats.shots - skaterStats.goals) * 0.3);
    hokmobRating += (skaterStats.hits * 0.2);
    hokmobRating += (skaterStats.takeaways * 0.2);

    if (skaterStats.penaltyMinutes) {
      let penaltyDeduction = skaterStats.penaltyMinutes;
      if (skaterStats.penaltyMinutes === 5 || skaterStats.penaltyMinutes === 7 || skaterStats.penaltyMinutes === 9 || skaterStats.penaltyMinutes === 11) {
        penaltyDeduction -= 5;
      }
      hokmobRating -= Math.min(3, penaltyDeduction * 0.25);
    }

    hokmobRating -= (skaterStats.plusMinus > 0 ? 0 : skaterStats.plusMinus * 0.5);
    hokmobRating -= (skaterStats.giveaways * 0.2);

    hokmobRating += (skaterStats.faceoffTaken < 3 ? 0 : (-0.5 + (skaterStats.faceOffWins / skaterStats.faceoffTaken)));

    return parseFloat(Math.min(10.0, hokmobRating).toFixed(1));
  }

  public static getHokmobRatingColor(score: number): string {
    if (score >= 8.5) {
      return "#0e87e0";
    } else if (score >= 7) {
      return "#1ec854";
    } else if (score >= 6) {
      return "#e68122";
    } else {
      return "#e55b5b";
    }
  }

  public static getPlayerLastName(fullName: string): string {
    return fullName.substring(fullName.lastIndexOf(' '));
  }

  public static sortByField(playerA: NhlPlayerModel, playerB: NhlPlayerModel, field: string): number {
    return playerB.person.stats[0].splits[0].stat[field] - playerA.person.stats[0].splits[0].stat[field];
  }

  public static sortByTimeField(playerA: NhlPlayerModel, playerB: NhlPlayerModel, field: string): number {
    let fieldA: string = playerA.person.stats[0].splits[0].stat[field];
    let valueA = Number(fieldA.replace(":", "."));
    let fieldB: string = playerB.person.stats[0].splits[0].stat[field];
    let valueB = Number(fieldB.replace(":", "."));
    return valueB - valueA;
  }
}
