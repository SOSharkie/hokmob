import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {GameShot} from "@shared/models/game-shot.model";
import {ShotMapUtils} from "@shared/utils/shot-map-utils";
import {NhlTeamColorUtils} from "@shared/utils/nhl-team-color-utils";
import {SavePercentagePipe} from "@shared/pipes/save-percentage.pipe";

/**
 * A shot on the half rink, in feet from its top left corner.
 */
export interface PlayerShotMarker {
  shot: GameShot;
  x: number;
  y: number;
  color: string;
  /** The text color on the team color, for a selected chip. */
  textColor: string;
  timeLabel: string;
}

/**
 * A player's shots in the player game dialog: a skater's shots on goal and goals, or the shots a goalie faced, on the
 * attacked half of the rink with the net at the bottom, each with a line to the net. A chip per shot below the rink
 * highlights it.
 */
@Component({
  selector: 'app-player-shot-map',
  templateUrl: './player-shot-map.component.html',
  styleUrls: ['./player-shot-map.component.scss']
})
export class PlayerShotMapComponent implements OnChanges {

  /** The rink's width and where its end boards are, in feet from center ice (api-web's coordinates). */
  public static readonly rinkWidth = 85;
  public static readonly endBoardsX = 100;

  /**
   * Where the half rink starts: a little above the blue line, or at the center line when a shot came from the neutral
   * zone. A shot from the shooter's own half is drawn at the top edge.
   */
  private static readonly zoneTopX = 21;
  private static readonly halfTopX = -2;

  /** The rink markings, in feet from center ice towards the attacked net. */
  public readonly goalLineX = 89;
  public readonly blueLineX = 25;
  public readonly faceoffCircleX = 69;
  public readonly neutralDotX = 20;
  public readonly cornerRadius = 28;

  /**
   * The player's shots (ShotMapUtils.getPlayerShots), in play order.
   */
  @Input()
  public shots: GameShot[];

  /**
   * Whether the shots are the ones a goalie faced, which changes the stats above the rink.
   */
  @Input()
  public isGoalie: boolean = false;

  public markers: PlayerShotMarker[] = [];

  /** Where the half rink starts, in feet from center ice. */
  public topX: number = PlayerShotMapComponent.zoneTopX;

  /** The shot whose chip is selected, highlighted on the rink. */
  public selectedEventId: number;

  public ngOnChanges(changes: SimpleChanges): void {
    const shots = this.shots ?? [];
    this.topX = shots.some(shot => shot.x < PlayerShotMapComponent.zoneTopX) ?
        PlayerShotMapComponent.halfTopX : PlayerShotMapComponent.zoneTopX;
    this.markers = shots.map(shot => ({
      shot,
      x: this.toRinkX(shot.y),
      y: this.toRinkY(Math.max(shot.x, this.topX)),
      color: NhlTeamColorUtils.getTeamPrimaryColor(shot.teamId),
      textColor: NhlTeamColorUtils.getTeamTextColor(shot.teamId),
      timeLabel: ShotMapUtils.getTimeLabel(shot)
    }));
    if (!this.markers.some(marker => marker.shot.eventId === this.selectedEventId)) {
      this.selectedEventId = undefined;
    }
  }

  /** The half rink's height in feet, from its top to the end boards. */
  public get rinkHeight(): number {
    return PlayerShotMapComponent.endBoardsX - this.topX;
  }

  public get viewBox(): string {
    return `0 0 ${PlayerShotMapComponent.rinkWidth} ${this.rinkHeight}`;
  }

  /**
   * The boards: straight down the sides from the top, round 28ft corners, and along the end.
   */
  public get boardsPath(): string {
    const width = PlayerShotMapComponent.rinkWidth;
    const radius = this.cornerRadius;
    const bottom = this.rinkHeight;
    return `M0 0 V${bottom - radius} A${radius} ${radius} 0 0 0 ${radius} ${bottom} H${width - radius} ` +
        `A${radius} ${radius} 0 0 0 ${width} ${bottom - radius} V0`;
  }

  /**
   * The goal line, which meets the boards in the corners, 11ft from the end boards.
   */
  public get goalLine(): {x1: number, x2: number, y: number} {
    const radius = this.cornerRadius;
    const fromEnd = PlayerShotMapComponent.endBoardsX - this.goalLineX;
    const inset = radius - Math.sqrt(radius * radius - (radius - fromEnd) * (radius - fromEnd));
    const round = (value: number) => Math.round(value * 100) / 100;
    return {x1: round(inset), x2: round(PlayerShotMapComponent.rinkWidth - inset), y: this.toRinkY(this.goalLineX)};
  }

  /** The 12ft crease, a half circle out from the goal line. */
  public get creasePath(): string {
    const middle = PlayerShotMapComponent.rinkWidth / 2;
    const y = this.toRinkY(this.goalLineX);
    return `M${middle - 6} ${y} A6 6 0 0 1 ${middle + 6} ${y} Z`;
  }

  /** The center of the net's mouth, where every shot's line ends. */
  public get netX(): number {
    return PlayerShotMapComponent.rinkWidth / 2;
  }

  public get netY(): number {
    return this.toRinkY(this.goalLineX);
  }

  public get blueLineY(): number {
    return this.toRinkY(this.blueLineX);
  }

  public get faceoffCircleY(): number {
    return this.toRinkY(this.faceoffCircleX);
  }

  /** The two faceoff dots' x, 22ft either side of the middle, for the end zone and neutral zone dots. */
  public get dotXs(): number[] {
    return [this.toRinkX(22), this.toRinkX(-22)];
  }

  /** Whether the neutral zone, and its dots, are on the drawn half. */
  public get showsNeutralZone(): boolean {
    return this.topX < this.neutralDotX;
  }

  public get neutralDotY(): number {
    return this.toRinkY(this.neutralDotX);
  }

  public get goals(): number {
    return this.markers.filter(marker => marker.shot.isGoal).length;
  }

  /**
   * A skater's shots that scored, or the shots a goalie stopped, like "1/4 (25%)" or "25/27 (.926)".
   */
  public get accuracyLabel(): string {
    const shots = this.markers.length;
    if (this.isGoalie) {
      const saves = shots - this.goals;
      return saves + "/" + shots + " (" + new SavePercentagePipe().transform(shots > 0 ? saves / shots : 0) + ")";
    }
    return this.goals + "/" + shots + " (" + (shots > 0 ? Math.round(this.goals / shots * 100) : 0) + "%)";
  }

  /**
   * Selects a shot's chip, or clears it when the shot is already selected.
   */
  public toggleShot(marker: PlayerShotMarker): void {
    this.selectedEventId = this.selectedEventId === marker.shot.eventId ? undefined : marker.shot.eventId;
  }

  public isSelected(marker: PlayerShotMarker): boolean {
    return marker.shot.eventId === this.selectedEventId;
  }

  public trackByShot(index: number, marker: PlayerShotMarker): number {
    return marker.shot.eventId;
  }

  /**
   * Feet across the drawn half. The shooter attacks downwards, a quarter turn from the team shot map's away shots,
   * which attack to the right with positive y at the top, so positive y is on the right.
   */
  private toRinkX(y: number): number {
    return Math.round((PlayerShotMapComponent.rinkWidth / 2 + y) * 100) / 100;
  }

  /** Feet down the drawn half, from its top. */
  private toRinkY(x: number): number {
    return Math.round((x - this.topX) * 100) / 100;
  }
}
