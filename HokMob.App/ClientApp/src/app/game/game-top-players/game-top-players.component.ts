import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";

@Component({
  selector: 'app-game-top-players',
  templateUrl: './game-top-players.component.html',
  styleUrls: ['./game-top-players.component.scss']
})
export class GameTopPlayersComponent implements OnChanges {

  /**
   * The home team's players, best rated first (StatsUtils.getGamePlayers).
   */
  @Input()
  public homePlayers: GamePlayer[];

  /**
   * The away team's players, best rated first (StatsUtils.getGamePlayers).
   */
  @Input()
  public awayPlayers: GamePlayer[];

  @Output()
  public playerClicked = new EventEmitter<number>();

  public topHomePlayers: GamePlayer[] = [];

  public topAwayPlayers: GamePlayer[] = [];

  /**
   * The best rated player of the game, shown with a star. The home player wins a tie.
   */
  public gameMvpPlayerId: number;

  public readonly numPlayersToShow = 6;

  public ngOnChanges(changes: SimpleChanges): void {
    this.topHomePlayers = this.getTopPlayers(this.homePlayers);
    this.topAwayPlayers = this.getTopPlayers(this.awayPlayers);
    this.gameMvpPlayerId = this.getGameMvpPlayerId();
  }

  public getHokmobScoreColor(player: GamePlayer): string {
    return StatsUtils.getHokmobRatingColor(player.hokmobRating);
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  public trackByPlayerId(index: number, player: GamePlayer): number {
    return player.playerId;
  }

  public clickPlayer(player: GamePlayer): void {
    this.playerClicked.emit(player.playerId);
  }

  /**
   * Returns the best rated players. When none of them is a goalie, the last one is replaced by the goalie who played
   * the most.
   */
  private getTopPlayers(players: GamePlayer[]): GamePlayer[] {
    const sortedPlayers = [...(players ?? [])].sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB));
    const topPlayers = sortedPlayers.slice(0, this.numPlayersToShow);
    const goalie = sortedPlayers.filter(player => player.goalieStats)
        .sort((playerA, playerB) => StatsUtils.sortByGoalieTimeOnIce(playerA, playerB))[0];
    if (goalie && !topPlayers.some(player => player.goalieStats)) {
      topPlayers.splice(Math.min(topPlayers.length, this.numPlayersToShow - 1), 1, goalie);
    }
    return topPlayers;
  }

  private getGameMvpPlayerId(): number {
    const bestHomePlayer = this.topHomePlayers.reduce<GamePlayer>((best, player) =>
        !best || player.hokmobRating > best.hokmobRating ? player : best, undefined);
    const bestAwayPlayer = this.topAwayPlayers.reduce<GamePlayer>((best, player) =>
        !best || player.hokmobRating > best.hokmobRating ? player : best, undefined);
    if (!bestHomePlayer || !bestAwayPlayer) {
      return undefined;
    }
    return bestHomePlayer.hokmobRating >= bestAwayPlayer.hokmobRating ? bestHomePlayer.playerId : bestAwayPlayer.playerId;
  }

}
