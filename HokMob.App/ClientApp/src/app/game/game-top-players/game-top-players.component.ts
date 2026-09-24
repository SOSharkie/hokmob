import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {PlayerHighlight} from "@shared/models/player-highlight.model";
import {NhlStarPlayerUtils} from "@shared/utils/nhl-star-player-utils";

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
 * A rink's markings in feet, for one rink width and length. Positions along the rink come from the drawing, since the
 * standing rink is drawn shorter than a real one (GameTopPlayersComponent.standingRinkLength).
 */
export interface RinkDrawing {
  standing: boolean;
  width: number;
  length: number;
  middle: number;
  viewBox: string;
  /** Across the rink: the middle of the 29.5ft faceoff circles' hash marks and the top of the 6ft wide goals. */
  goalY: number;
  /** Along the rink: the goal lines, the two blue lines and the center line. */
  goalLineXs: number[];
  blueLineXs: number[];
  centerX: number;
  /** Where each 3.3ft deep goal starts, behind its goal line. */
  goalXs: number[];
  /** The faceoff circles' radius, which the hash marks sit on. */
  circleRadius: number;
  creasePaths: string[];
  /** The referee's crease, a 10ft semicircle on one side at the middle of the rink. */
  refereeCreasePath: string;
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

  /** The small logo beside each bench's head coach. */
  public readonly logoSize: number = 22;

  /**
   * The rink's width in feet: a real rink's 98.42ft when it stands up on phones, and 20% narrower when it lies across
   * the card, so it isn't as tall.
   */
  public static readonly standingRinkWidth = 98.42;
  public static readonly lyingRinkWidth = 78.74;

  /**
   * How much longer than wide the standing rink is drawn on phones: 1.6 instead of a real rink's 2.03, so the whole
   * card fits a phone screen. Keep it the same as $standing-aspect-ratio in the stylesheet.
   */
  public static readonly standingAspectRatio = 1.6;

  /**
   * The length the standing rink is drawn at, in feet. Everything along it moves in, while everything measured across
   * it, and every round marking, keeps its real size, so the faceoff circles stay circles. The lying rink is narrowed
   * the same way, across instead of along.
   */
  public static get standingRinkLength(): number {
    return Math.round(GameTopPlayersComponent.standingRinkWidth * GameTopPlayersComponent.standingAspectRatio * 100) / 100;
  }

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
    GameTopPlayersComponent.getRinkDrawing(GameTopPlayersComponent.lyingRinkWidth, GameTopPlayersComponent.rinkLength, false),
    GameTopPlayersComponent.getRinkDrawing(GameTopPlayersComponent.standingRinkWidth, GameTopPlayersComponent.standingRinkLength, true)
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
      ...GameTopPlayersComponent.placeLine('goalies', goalies.slice(0, 1)),
      ...GameTopPlayersComponent.placeLine('defense', this.pickLine(skaters.filter(player => player.position === 'D'),
          NhlStarPlayerUtils.getStarDefenseIds(teamId), this.numDefenseToShow)),
      ...GameTopPlayersComponent.placeLine('forwards', this.pickLine(skaters.filter(player => player.position !== 'D'),
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
    if (!this.showStarLineup) {
      return skaters.slice(0, count);
    }
    const stars = starPlayerIds.map(playerId => skaters.find(skater => skater.playerId === playerId))
        .filter(star => !!star);
    return [...stars, ...skaters.filter(skater => !stars.includes(skater))].slice(0, count);
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
   * Returns the markings of a rink that is the given width and length in feet. Things across the rink (the faceoff
   * circles, the creases and the goals) stay centered, and the faceoff dots stay 22ft either side of the middle on a
   * full-width rink, closer on a narrower one. Things along it move in on a rink drawn shorter than a real one, and
   * the round markings stay round, drawn at `getRoundScale`.
   */
  private static getRinkDrawing(width: number, length: number, standing: boolean): RinkDrawing {
    const round = (value: number) => Math.round(value * 100) / 100;
    const middle = round(width / 2);
    const dotOffset = 22 * width / GameTopPlayersComponent.standingRinkWidth;
    const dotYs = [round(middle - dotOffset), round(middle + dotOffset)];
    // 11ft from the end boards, with the blue lines 64ft further in and the end zone dots 22ft out from the goal lines
    const along = (feet: number) => round(feet * length / GameTopPlayersComponent.rinkLength);
    const roundScale = GameTopPlayersComponent.getRoundScale(length);
    const goalLineXs = [along(13.1), along(187.03)];
    const circleXs = [along(35.1), along(165.03)];
    const centerX = along(100.065);
    // The end zone faceoff circles are 29.5ft across, the creases 12ft and the referee's crease 20ft
    const circleRadius = round(14.75 * roundScale);
    const creaseRadius = round(6 * roundScale);
    const refereeRadius = round(10 * roundScale);
    return {
      standing,
      width,
      middle,
      length,
      viewBox: `0 0 ${length} ${width}`,
      goalY: round(middle - 3),
      goalLineXs,
      blueLineXs: [along(71.1), along(129.03)],
      centerX,
      // The 3.3ft deep goals sit behind their goal lines, towards the end boards
      goalXs: [round(goalLineXs[0] - 3.3), goalLineXs[1]],
      circleRadius,
      creasePaths: [
        `M${goalLineXs[0]} ${round(middle - creaseRadius)} A${creaseRadius} ${creaseRadius} 0 0 1 ${goalLineXs[0]} ${round(middle + creaseRadius)} Z`,
        `M${goalLineXs[1]} ${round(middle - creaseRadius)} A${creaseRadius} ${creaseRadius} 0 0 0 ${goalLineXs[1]} ${round(middle + creaseRadius)} Z`
      ],
      refereeCreasePath: `M${round(centerX - refereeRadius)} 0 A${refereeRadius} ${refereeRadius} 0 0 0 ${round(centerX + refereeRadius)} 0`,
      faceoffCircles: circleXs.flatMap(x => dotYs.map(y => ({
        x, y, hashMarks: GameTopPlayersComponent.getHashMarksPath(x, y, circleRadius)
      })))
    };
  }

  /**
   * How much smaller a round marking is drawn on a rink that is drawn shorter than a real one: the square root of how
   * much the rink lost, so a circle covers the same ice as the oval it stands in for. Drawn at their full size across
   * a shortened rink the faceoff circles look too big for its length, and squashed to fit they aren't circles at all.
   * A rink drawn at its real length (the lying one) keeps every marking at its real size.
   */
  private static getRoundScale(length: number): number {
    return Math.sqrt(length / GameTopPlayersComponent.rinkLength);
  }

  /**
   * Returns the SVG path of a faceoff circle's hash marks: two 2ft marks, 3ft apart, above and below the circle of
   * the given radius.
   */
  private static getHashMarksPath(x: number, y: number, radius: number): string {
    const round = (value: number) => Math.round(value * 100) / 100;
    return [-1.5, 1.5].map(offset =>
        `M${round(x + offset)} ${round(y - radius)} v-2 M${round(x + offset)} ${round(y + radius)} v2`).join(' ');
  }

  /**
   * Returns a copy of the players, best rated first, with the bigger star first in a tie (StatsUtils.sortByStarPlayer).
   */
  private static sortPlayers(players: GamePlayer[]): GamePlayer[] {
    return [...(players ?? [])].sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB) ||
        StatsUtils.sortByStarPlayer(playerA, playerB));
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
