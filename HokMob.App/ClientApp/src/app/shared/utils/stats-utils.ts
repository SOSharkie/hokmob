import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";

export class StatsUtils {

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
