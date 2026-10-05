import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {PlayerHighlight} from "@shared/models/player-highlight.model";
import {NhlStarPlayerUtils} from "@shared/utils/nhl-star-player-utils";
import {RinkComponent, RinkSpot} from "@app/game/rink/rink.component";

/** A top player and their spot on the rink. */
export type TopPlayerSpot = RinkSpot<GamePlayer>;

@Component({
  selector: 'app-game-top-players',
  templateUrl: './game-top-players.component.html',
  styleUrls: ['./game-top-players.component.scss']
})
export class GameTopPlayersComponent implements OnChanges {

  /** The small logo beside each bench's head coach. */
  public readonly logoSize: number = 22;

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

  /**
   * The head coaches' names, shown on the team benches.
   */
  @Input()
  public homeCoach: string;

  @Input()
  public awayCoach: string;

  /**
   * The team logos, shown next to the coaches.
   */
  @Input()
  public homeTeamLogo: string;

  @Input()
  public awayTeamLogo: string;

  /**
   * The player hovered elsewhere on the game page. Their spot is highlighted, and so is the puck of the hovered goal.
   */
  @Input()
  public highlightedPlayer: PlayerHighlight;

  @Output()
  public playerClicked = new EventEmitter<number>();

  public homeSpots: TopPlayerSpot[] = [];

  public awaySpots: TopPlayerSpot[] = [];

  /**
   * The best rated player on the rink, shown with a star. The home player wins a tie.
   */
  public gameMvpPlayerId: number;

  /**
   * Whether the card shows each team's star players (NhlStarPlayerUtils) instead of its best rated ones. The header
   * toggle switches between the two lineups.
   */
  public showStarLineup = false;

  public readonly numForwardsToShow = 3;

  public readonly numDefenseToShow = 2;

  /** How many of each team's next best rated players sit on its bench when the benches are open. */
  public readonly numBenchPlayersToShow = 4;

  public readonly maxGoalPucks = 3;

  /**
   * Each team's best rated players left off the rink, best first, for its bench.
   */
  public homeBenchPlayers: GamePlayer[] = [];

  public awayBenchPlayers: GamePlayer[] = [];

  /**
   * Whether the benches are open, showing each team's bench players above its coach. The toggle between the benches
   * opens and closes them, on screens wide enough to show the benches.
   */
  public showBenchPlayers = false;

  public ngOnChanges(changes: SimpleChanges): void {
    this.buildSpots();
  }

  /**
   * Switches between the best rated players and each team's stars, and fills the rink again.
   */
  public toggleStarLineup(): void {
    this.showStarLineup = !this.showStarLineup;
    this.buildSpots();
  }

  /**
   * The card's title, naming the lineup it is showing.
   */
  public get cardTitle(): string {
    return this.showStarLineup ? 'Star Players' : 'Top Players';
  }

  /**
   * Opens or closes the benches.
   */
  public toggleBenchPlayers(): void {
    this.showBenchPlayers = !this.showBenchPlayers;
  }

  public get showBenches(): boolean {
    return !!this.homeCoach || !!this.awayCoach;
  }

  /**
   * Whether either team has a player left off the rink, so the benches have someone to show.
   */
  public get hasBenchPlayers(): boolean {
    return this.homeBenchPlayers.length > 0 || this.awayBenchPlayers.length > 0;
  }

  public getHokmobScoreColor(player: GamePlayer): string {
    return StatsUtils.getHokmobRatingColor(player.hokmobRating);
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  /**
   * Returns the player's goals. A goalie's come from the landing, since the boxscore doesn't have them.
   */
  public getGoals(player: GamePlayer): number {
    return player.skaterStats?.goals ?? player.goalieRatingContext?.goals ?? 0;
  }

  /**
   * Returns the indexes of the player's goal pucks: one per goal, up to three.
   */
  public getGoalPuckIndexes(player: GamePlayer): number[] {
    const goals = Math.min(this.getGoals(player), this.maxGoalPucks);
    return Array.from({length: Math.max(goals, 0)}, (_, index) => index);
  }

  public isHighlighted(player: GamePlayer): boolean {
    return !!this.highlightedPlayer && this.highlightedPlayer.playerId === player.playerId;
  }

  /**
   * The hovered player's highlight color, for their ring and the hovered goal's puck: the rating blue for the starred
   * player, and the rating green for everyone else.
   */
  public getHighlightColor(player: GamePlayer): string {
    return player.playerId === this.gameMvpPlayerId ? StatsUtils.hokmobRatingBlue : StatsUtils.hokmobRatingGreen;
  }

  /**
   * Whether the puck at the given index is the hovered goal's.
   */
  public isHighlightedGoal(player: GamePlayer, puckIndex: number): boolean {
    return this.isHighlighted(player) && this.highlightedPlayer.goalIndex === puckIndex;
  }

  public trackBySpot(index: number, spot: TopPlayerSpot): number {
    return spot.player.playerId;
  }

  public trackByPlayer(index: number, player: GamePlayer): number {
    return player.playerId;
  }

  public clickPlayer(player: GamePlayer): void {
    this.playerClicked.emit(player.playerId);
  }

  /**
   * Fills both rinks and their benches, and stars the best rated player on the rink, for the lineup the card is
   * showing.
   */
  private buildSpots(): void {
    this.homeSpots = this.getSpots(this.homePlayers);
    this.awaySpots = this.getSpots(this.awayPlayers);
    this.homeBenchPlayers = this.getBenchPlayers(this.homePlayers, this.homeSpots);
    this.awayBenchPlayers = this.getBenchPlayers(this.awayPlayers, this.awaySpots);
    this.gameMvpPlayerId = this.getGameMvpPlayerId();
  }

  /**
   * Returns a team's best rated players who aren't on the rink, skaters and goalies alike, best first. Ties are split
   * the same way as on the rink (GameTopPlayersComponent.sortPlayers).
   */
  private getBenchPlayers(players: GamePlayer[], spots: TopPlayerSpot[]): GamePlayer[] {
    const rinkPlayerIds = new Set(spots.map(spot => spot.player.playerId));
    return GameTopPlayersComponent.sortPlayers(players)
        .filter(player => !rinkPlayerIds.has(player.playerId))
        .slice(0, this.numBenchPlayersToShow);
  }

  /**
   * Returns a team's goalie, two defensemen and three forwards, placed on the rink: the best rated ones, or its star
   * players in the star lineup (NhlStarPlayerUtils). Two skaters with the same rating are split by how big a star
   * they are (StatsUtils.sortByStarPlayer), so the player fans came to see takes the spot.
   *
   * The goalie who played keeps the crease in both lineups, since no goalie is a star. Goalies who didn't play are
   * rated 0, so a tie there goes to the goalie who played the most.
   */
  private getSpots(players: GamePlayer[]): TopPlayerSpot[] {
    const sortedPlayers = GameTopPlayersComponent.sortPlayers(players);
    const skaters = sortedPlayers.filter(player => player.skaterStats);
    const goalies = sortedPlayers.filter(player => player.goalieStats)
        .sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB) ||
            StatsUtils.sortByGoalieTimeOnIce(playerA, playerB));
    const teamId = sortedPlayers[0]?.teamId;
    return [
      ...RinkComponent.placeLine('goalies', goalies.slice(0, 1)),
      ...RinkComponent.placeLine('defense', this.pickLine(skaters.filter(player => player.position === 'D'),
          NhlStarPlayerUtils.getStarDefenseIds(teamId), this.numDefenseToShow)),
      ...RinkComponent.placeLine('forwards', this.pickLine(skaters.filter(player => player.position !== 'D'),
          NhlStarPlayerUtils.getStarForwardIds(teamId), this.numForwardsToShow))
    ];
  }

  /**
   * Returns the players of one line: the best rated ones, or in the star lineup the team's stars who dressed, topped
   * up with the best rated of the rest when a star sat out.
   *
   * @param skaters - The team's skaters at that position, best rated first.
   * @param starPlayerIds - The IDs of its star players at that position, the bigger star first.
   * @param count - How many players the line holds.
   */
  private pickLine(skaters: GamePlayer[], starPlayerIds: number[], count: number): GamePlayer[] {
    return this.showStarLineup ? NhlStarPlayerUtils.pickStarLine(skaters, starPlayerIds, count) : skaters.slice(0, count);
  }

  private getGameMvpPlayerId(): number {
    const bestHomePlayer = GameTopPlayersComponent.getBestPlayer(this.homeSpots);
    const bestAwayPlayer = GameTopPlayersComponent.getBestPlayer(this.awaySpots);
    if (!bestHomePlayer || !bestAwayPlayer) {
      return undefined;
    }
    return bestHomePlayer.hokmobRating >= bestAwayPlayer.hokmobRating ? bestHomePlayer.playerId : bestAwayPlayer.playerId;
  }

  /**
   * Returns a copy of the players, best rated first, with the bigger star first in a tie (StatsUtils.sortByStarPlayer).
   */
  private static sortPlayers(players: GamePlayer[]): GamePlayer[] {
    return [...(players ?? [])].sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB) ||
        StatsUtils.sortByStarPlayer(playerA, playerB));
  }

  private static getBestPlayer(spots: TopPlayerSpot[]): GamePlayer {
    return spots.map(spot => spot.player).reduce<GamePlayer>((best, player) =>
        !best || player.hokmobRating > best.hokmobRating ? player : best, undefined);
  }

}
