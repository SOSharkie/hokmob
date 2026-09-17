import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {PlayerHighlight} from "@shared/models/player-highlight.model";

export type TopPlayerLine = 'goalies' | 'defense' | 'forwards';

/**
 * A top player and their spot on the rink, in percent: along the rink from their own end boards, and across it.
 */
export interface TopPlayerSpot {
  player: GamePlayer;
  line: TopPlayerLine;
  length: number;
  across: number;
}

/**
 * A rink's markings in feet, for one rink width.
 */
export interface RinkDrawing {
  standing: boolean;
  width: number;
  middle: number;
  viewBox: string;
  /** The top of the 6ft wide goals. */
  goalY: number;
  creasePaths: string[];
  faceoffCircles: { x: number, y: number, hashMarks: string }[];
}

@Component({
  selector: 'app-game-top-players',
  templateUrl: './game-top-players.component.html',
  styleUrls: ['./game-top-players.component.scss']
})
export class GameTopPlayersComponent implements OnChanges {

  /**
   * The rink's length in feet. The markings in the template are drawn in feet too.
   */
  public static readonly rinkLength = 200.13;

  /**
   * The rink's width in feet: a real rink's 98.42ft when it stands up on phones, and 20% narrower when it lies across
   * the card, so it isn't as tall.
   */
  public static readonly standingRinkWidth = 98.42;
  public static readonly lyingRinkWidth = 78.74;

  /**
   * How far each line stands from its own end boards, in feet: the goalie in the crease, the defense between the
   * faceoff circles and the blue line, and the forwards in the middle of the neutral zone.
   */
  private static readonly lineLengths: Record<TopPlayerLine, number> = {goalies: 17, defense: 52, forwards: 85.6};

  /**
   * Where a line's players stand across the rink, in percent, by how many there are. Defensemen line up with the
   * faceoff dots, 22ft either side of the middle.
   */
  private static readonly lineAcross: Record<TopPlayerLine, number[][]> = {
    goalies: [[], [50]],
    defense: [[], [50], [27.6, 72.4]],
    forwards: [[], [50], [27.6, 72.4], [18, 50, 82]]
  };

  /**
   * The rink markings for each way the rink is shown. CSS shows the lying one on wider screens and the standing one on
   * phones.
   */
  public readonly rinkDrawings: RinkDrawing[] = [
    GameTopPlayersComponent.getRinkDrawing(GameTopPlayersComponent.lyingRinkWidth, false),
    GameTopPlayersComponent.getRinkDrawing(GameTopPlayersComponent.standingRinkWidth, true)
  ];

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

  public readonly numForwardsToShow = 3;

  public readonly numDefenseToShow = 2;

  public readonly maxGoalPucks = 3;

  public ngOnChanges(changes: SimpleChanges): void {
    this.homeSpots = this.getSpots(this.homePlayers);
    this.awaySpots = this.getSpots(this.awayPlayers);
    this.gameMvpPlayerId = this.getGameMvpPlayerId();
  }

  public get showBenches(): boolean {
    return !!this.homeCoach || !!this.awayCoach;
  }

  public getHokmobScoreColor(player: GamePlayer): string {
    return StatsUtils.getHokmobRatingColor(player.hokmobRating);
  }

  public showBlankHeadshot(event: Event): void {
    NhlPlayerHeadshotUtils.showBlankHeadshot(event);
  }

  /**
   * Returns the indexes of the player's goal pucks: one per goal, up to three.
   */
  public getGoalPuckIndexes(player: GamePlayer): number[] {
    const goals = Math.min(player.skaterStats?.goals ?? 0, this.maxGoalPucks);
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

  public clickPlayer(player: GamePlayer): void {
    this.playerClicked.emit(player.playerId);
  }

  /**
   * Returns a team's best rated goalie, two best rated defensemen and three best rated forwards, placed on the rink.
   * Goalies who didn't play are rated 0, so a tie goes to the goalie who played the most.
   */
  private getSpots(players: GamePlayer[]): TopPlayerSpot[] {
    const sortedPlayers = [...(players ?? [])].sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB));
    const skaters = sortedPlayers.filter(player => player.skaterStats);
    const goalies = sortedPlayers.filter(player => player.goalieStats)
        .sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB) ||
            StatsUtils.sortByGoalieTimeOnIce(playerA, playerB));
    return [
      ...GameTopPlayersComponent.placeLine('goalies', goalies.slice(0, 1)),
      ...GameTopPlayersComponent.placeLine('defense', skaters.filter(player => player.position === 'D').slice(0, this.numDefenseToShow)),
      ...GameTopPlayersComponent.placeLine('forwards', skaters.filter(player => player.position !== 'D').slice(0, this.numForwardsToShow))
    ];
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
   * Returns the markings of a rink that is the given width in feet. Things across the rink (the faceoff circles, the
   * creases and the goals) stay centered, and the faceoff dots stay 22ft either side of the middle on a full-width rink,
   * closer on a narrower one.
   */
  private static getRinkDrawing(width: number, standing: boolean): RinkDrawing {
    const round = (value: number) => Math.round(value * 100) / 100;
    const middle = round(width / 2);
    const dotOffset = 22 * width / GameTopPlayersComponent.standingRinkWidth;
    const dotYs = [round(middle - dotOffset), round(middle + dotOffset)];
    return {
      standing,
      width,
      middle,
      viewBox: `0 0 ${GameTopPlayersComponent.rinkLength} ${width}`,
      goalY: round(middle - 3),
      creasePaths: [
        `M13.1 ${round(middle - 6)} A6 6 0 0 1 13.1 ${round(middle + 6)} Z`,
        `M187.03 ${round(middle - 6)} A6 6 0 0 0 187.03 ${round(middle + 6)} Z`
      ],
      // The end zone faceoff circles are 29.5ft across, their dots 22ft out from the goal lines
      faceoffCircles: [35.1, 165.03].flatMap(x => dotYs.map(y => ({
        x, y, hashMarks: GameTopPlayersComponent.getHashMarksPath(x, y)
      })))
    };
  }

  /**
   * Returns the SVG path of a faceoff circle's hash marks: two 2ft marks, 3ft apart, above and below the circle.
   */
  private static getHashMarksPath(x: number, y: number): string {
    const radius = 14.75;
    const round = (value: number) => Math.round(value * 100) / 100;
    return [-1.5, 1.5].map(offset =>
        `M${round(x + offset)} ${round(y - radius)} v-2 M${round(x + offset)} ${round(y + radius)} v2`).join(' ');
  }

  private static placeLine(line: TopPlayerLine, players: GamePlayer[]): TopPlayerSpot[] {
    const across = GameTopPlayersComponent.lineAcross[line][players.length] ?? [];
    const length = GameTopPlayersComponent.lineLengths[line] / GameTopPlayersComponent.rinkLength * 100;
    return players.map((player, index) => ({player, line, length, across: across[index]}));
  }

  private static getBestPlayer(spots: TopPlayerSpot[]): GamePlayer {
    return spots.map(spot => spot.player).reduce<GamePlayer>((best, player) =>
        !best || player.hokmobRating > best.hokmobRating ? player : best, undefined);
  }

}
