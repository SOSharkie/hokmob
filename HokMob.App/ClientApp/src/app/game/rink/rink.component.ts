import {Component} from '@angular/core';

export type RinkLine = 'goalies' | 'defense' | 'forwards';

/**
 * A player and their spot on the rink, in percent: along the rink from their own end boards, and across it.
 */
export interface RinkSpot<T> {
  player: T;
  line: RinkLine;
  length: number;
  across: number;
}

/**
 * A rink's markings in feet, for one rink width and length. Positions along the rink come from the drawing, since the
 * standing rink is drawn shorter than a real one (RinkComponent.standingRinkLength).
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

/**
 * A hockey rink with its markings, lying across the card on wider screens and standing up on phones, home's end on
 * the left or at the top. The players are projected into it and placed with placeLine: each card's stylesheet
 * positions them from their --length and --across (see _rink-card.scss).
 */
@Component({
  selector: 'app-rink',
  templateUrl: './rink.component.html',
  styleUrls: ['./rink.component.scss']
})
export class RinkComponent {

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
    return Math.round(RinkComponent.standingRinkWidth * RinkComponent.standingAspectRatio * 100) / 100;
  }

  /**
   * How far each line stands from its own end boards, in feet: the goalie in the crease, the defense between the
   * faceoff circles and the blue line, and the forwards in the middle of the neutral zone.
   */
  private static readonly lineLengths: Record<RinkLine, number> = {goalies: 17, defense: 52, forwards: 85.6};

  /**
   * Where a line's players stand across the rink, in percent, by how many there are. Defensemen line up with the
   * faceoff dots, 22ft either side of the middle.
   */
  private static readonly lineAcross: Record<RinkLine, number[][]> = {
    goalies: [[], [50]],
    defense: [[], [50], [27.6, 72.4]],
    forwards: [[], [50], [27.6, 72.4], [18, 50, 82]]
  };

  /**
   * The rink markings for each way the rink is shown. CSS shows the lying one on wider screens and the standing one on
   * phones.
   */
  public readonly rinkDrawings: RinkDrawing[] = [
    RinkComponent.getRinkDrawing(RinkComponent.lyingRinkWidth, RinkComponent.rinkLength, false),
    RinkComponent.getRinkDrawing(RinkComponent.standingRinkWidth, RinkComponent.standingRinkLength, true)
  ];

  /**
   * Places a line's players on their team's half of the rink: at the line's distance from the end boards, spread
   * across the rink by how many there are (one goalie, up to two defensemen and up to three forwards).
   *
   * @param line - The goalies, the defense or the forwards.
   * @param players - The line's players, in order across the rink.
   */
  public static placeLine<T>(line: RinkLine, players: T[]): RinkSpot<T>[] {
    const across = RinkComponent.lineAcross[line][players.length] ?? [];
    const length = RinkComponent.lineLengths[line] / RinkComponent.rinkLength * 100;
    return players.map((player, index) => ({player, line, length, across: across[index]}));
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
    const dotOffset = 22 * width / RinkComponent.standingRinkWidth;
    const dotYs = [round(middle - dotOffset), round(middle + dotOffset)];
    // 11ft from the end boards, with the blue lines 64ft further in and the end zone dots 22ft out from the goal lines
    const along = (feet: number) => round(feet * length / RinkComponent.rinkLength);
    const roundScale = RinkComponent.getRoundScale(length);
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
        x, y, hashMarks: RinkComponent.getHashMarksPath(x, y, circleRadius)
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
    return Math.sqrt(length / RinkComponent.rinkLength);
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

}
