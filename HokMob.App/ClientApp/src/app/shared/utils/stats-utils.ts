import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";
import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {
  Boxscore,
  BoxscoreGoalie,
  BoxscoreSkater,
  GamePlayer
} from "@shared/models/nhl-web-api/boxscore.model";
import {RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";

export class StatsUtils {

  /**
   * Calculates the HokMob rating of a skater for a single live or past game, from 0 to 10.
   *
   * TODO: The new NHL API boxscore (gamecenter/{id}/boxscore) has no faceoff win/taken counts or powerPlayAssists.
   *  For now use the simple version: faceoff term from faceoffWinningPctg (centers only) and drop the powerPlayAssists
   *  correction from realPlusMinus. A new, exact version will be built later by deriving faceoff counts from
   *  play-by-play "faceoff" plays (winningPlayerId/losingPlayerId) and PP assists from "goal" plays' situationCode.
   *
   * @param skater - The skater's boxscore stats.
   */
  public static calculateSkaterHokmobRating(skater: BoxscoreSkater): number {
    const goals = skater.goals ?? 0;
    const assists = skater.assists ?? 0;
    const plusMinus = skater.plusMinus ?? 0;
    let hokmobRating = 5;
    hokmobRating += (goals * 1.1);
    hokmobRating += (assists * 0.5);
    hokmobRating += (((skater.sog ?? 0) - goals) * 0.3);
    hokmobRating += ((skater.hits ?? 0) * 0.2);
    hokmobRating += ((skater.blockedShots ?? 0) * 0.2);
    hokmobRating += ((skater.takeaways ?? 0) * 0.2);

    if (skater.pim) {
      let penaltyDeduction = skater.pim;
      if (skater.pim === 5 || skater.pim === 7 || skater.pim === 9 || skater.pim === 11) {
        penaltyDeduction -= 5;
      }
      hokmobRating -= Math.min(3, penaltyDeduction * 0.25);
    }

    let realPlusMinus = (plusMinus - goals + (skater.powerPlayGoals ?? 0) - assists);
    if (plusMinus > 0) {
      hokmobRating += (realPlusMinus * 0.3);
    } else {
      hokmobRating += (plusMinus * 0.5);
    }

    hokmobRating -= ((skater.giveaways ?? 0) * 0.2);

    if (skater.position === "C") {
      hokmobRating += (-0.5 + (skater.faceoffWinningPctg ?? 0));
    }

    return parseFloat(Math.min(10.0, hokmobRating).toFixed(1));
  }

  /**
   * Calculates hokmob rating for historical skater stats. Does not include takeaways or giveaways.
   */
  public static calculatePlayerHokmobRating(skaterStats: NhlPlayerStatsModel): number {
    let hokmobRating = 5;
    hokmobRating += (skaterStats.goals * 1.1);
    hokmobRating += (skaterStats.assists * 0.5);
    hokmobRating += ((skaterStats.shots - skaterStats.goals) * 0.3);
    hokmobRating += (skaterStats.hits * 0.2);
    hokmobRating += (skaterStats.blocked * 0.2);
    // hokmobRating += (skaterStats.takeaways * 0.2);

    if (skaterStats.pim) {
      let penaltyDeduction = skaterStats.pim;
      if (skaterStats.pim === 5 || skaterStats.pim === 7 || skaterStats.pim === 9 || skaterStats.pim === 11) {
        penaltyDeduction -= 5;
      }
      hokmobRating -= Math.min(3, penaltyDeduction * 0.25);
    }

    let realPlusMinus = (skaterStats.plusMinus - skaterStats.goals - skaterStats.assists + skaterStats.powerPlayPoints);
    if (skaterStats.plusMinus > 0) {
      hokmobRating += (realPlusMinus * 0.3);
    } else {
      hokmobRating += (skaterStats.plusMinus * 0.5);
    }

    // hokmobRating -= (skaterStats.giveaways * 0.2);

    if (skaterStats.faceOffPct) {
      hokmobRating += (-0.5 + (skaterStats.faceOffPct / 100));
    }

    return parseFloat(Math.min(10.0, hokmobRating).toFixed(1));
  }

  /**
   * Calculates the HokMob rating of a goalie for a single live or past game, from 0 to 10. A goalie who faced no
   * shots (no savePctg) gets 0.
   *
   * @param goalie - The goalie's boxscore stats.
   */
  public static calculateGoalieHokMobRating(goalie: BoxscoreGoalie): number {
    if (!goalie.savePctg) {
      return 0;
    }
    let hokmobRating = 5;
    hokmobRating += (StatsUtils.getSaves(goalie.evenStrengthShotsAgainst) / 6);
    hokmobRating += (StatsUtils.getSaves(goalie.powerPlayShotsAgainst) / 5);
    hokmobRating -= ((goalie.shotsAgainst ?? 0) - (goalie.saves ?? 0));

    return parseFloat(Math.max(0, Math.min(10.0, hokmobRating)).toFixed(1));
  }

  /**
   * Calculate hokmob rating for historical goalie stats.
   */
  public static calculatePlayerGoalieHokMobRating(goalieStats: NhlPlayerStatsModel): number {
    let hokmobRating = 5;
    if (goalieStats.savePercentage) {
      hokmobRating += (goalieStats.evenSaves / 6);
      hokmobRating += (goalieStats.powerPlaySaves / 5)
      hokmobRating -= (goalieStats.shotsAgainst - goalieStats.saves);

      return parseFloat(Math.max(0, Math.min(10.0, hokmobRating)).toFixed(1));
    } else {
      return 0;
    }
  }

  /**
   * Returns the saves from a boxscore saves/shots string, like 28 for "28/30", or 0 when it can't be read.
   */
  public static getSaves(savesAndShots: string): number {
    const saves = parseInt((savesAndShots ?? "").split("/")[0], 10);
    return isNaN(saves) ? 0 : saves;
  }

  /**
   * Converts a time on ice like "59:52" to seconds, or 0 when it can't be read.
   */
  public static getTimeOnIceSeconds(timeOnIce: string): number {
    const [minutes, seconds] = (timeOnIce ?? "").split(":").map(Number);
    return (minutes || 0) * 60 + (seconds || 0);
  }

  /**
   * Returns a team's dressed skaters and goalies with their HokMob ratings, best rated first. Full names and headshots
   * come from the play-by-play roster spots; without one, the boxscore's short name and the season's team headshot
   * are used. Returns an empty list when the boxscore has no player stats (a future game).
   *
   * @param boxscore - The game's boxscore.
   * @param isHome - Whether to return the home team's players.
   * @param rosterSpots - The play-by-play roster spots by player ID, if loaded.
   */
  public static getGamePlayers(boxscore: Boxscore, isHome: boolean, rosterSpots?: Map<number, RosterSpot>): GamePlayer[] {
    const team = isHome ? boxscore?.homeTeam : boxscore?.awayTeam;
    const players = isHome ? boxscore?.playerByGameStats?.homeTeam : boxscore?.playerByGameStats?.awayTeam;
    if (!team || !players) {
      return [];
    }
    const toGamePlayer = (stats: BoxscoreSkater | BoxscoreGoalie): GamePlayer => {
      const rosterSpot = rosterSpots?.get(stats.playerId);
      return {
        playerId: stats.playerId,
        teamId: team.id,
        isHome,
        name: PlayByPlayUtils.getFullName(rosterSpot) || stats.name?.default || "",
        position: stats.position,
        headshot: rosterSpot?.headshot || NhlPlayerHeadshotUtils.getHeadshotUrl(boxscore.season, team.abbrev, stats.playerId),
        hokmobRating: 0
      };
    };
    const skaters = [...(players.forwards ?? []), ...(players.defense ?? [])].map(skater => ({
      ...toGamePlayer(skater),
      skaterStats: skater,
      hokmobRating: StatsUtils.calculateSkaterHokmobRating(skater)
    }));
    const goalies = (players.goalies ?? []).map(goalie => ({
      ...toGamePlayer(goalie),
      goalieStats: goalie,
      hokmobRating: StatsUtils.calculateGoalieHokMobRating(goalie)
    }));
    return [...skaters, ...goalies].sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB));
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

  /**
   * Sorts goalies by time on ice, most first.
   */
  public static sortByGoalieTimeOnIce(playerA: GamePlayer, playerB: GamePlayer): number {
    return StatsUtils.getTimeOnIceSeconds(playerB.goalieStats?.toi) - StatsUtils.getTimeOnIceSeconds(playerA.goalieStats?.toi);
  }

  /**
   * Sorts players by HokMob rating, best first.
   */
  public static sortByHokMobRating(playerA: GamePlayer, playerB: GamePlayer): number {
    return (playerB.hokmobRating ?? 0) - (playerA.hokmobRating ?? 0);
  }
}
