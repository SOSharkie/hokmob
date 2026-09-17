import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Play, RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {PeriodUtils} from "@shared/utils/period-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {PlayerHighlight} from "@shared/models/player-highlight.model";

@Component({
  selector: 'app-event',
  templateUrl: './event.component.html',
  styleUrls: ['./event.component.scss']
})
export class EventComponent {

  /**
   * A goal or penalty play.
   */
  @Input()
  public play: Play;

  @Input()
  public homeTeamId: number;

  /**
   * The game's roster spots by player ID, for player names.
   */
  @Input()
  public rosterSpots: Map<number, RosterSpot>;

  /**
   * For a goal, its index among the scorer's goals in this game (PlayByPlayUtils.getGoalIndexes).
   */
  @Input()
  public goalIndex: number;

  @Output()
  public playerClicked = new EventEmitter<number>();

  /**
   * Emits the hovered player, with the goal index when the scorer is hovered, and null when the mouse leaves them.
   */
  @Output()
  public playerHovered = new EventEmitter<PlayerHighlight>();

  public get isHomeEvent(): boolean {
    return this.play?.details?.eventOwnerTeamId === this.homeTeamId;
  }

  public get isEventGoal(): boolean {
    return PlayByPlayUtils.isGoal(this.play);
  }

  public get periodTime(): string {
    return PeriodUtils.formatTimeRemaining(this.play?.timeInPeriod) ?? "";
  }

  public get goalEventHomeScore(): string {
    return String(this.play?.details?.homeScore ?? "");
  }

  public get goalEventAwayScore(): string {
    return String(this.play?.details?.awayScore ?? "");
  }

  /**
   * The scorer's or penalized player's full name.
   */
  public get eventPlayerName(): string {
    return PlayByPlayUtils.getMainPlayerLabel(this.play, this.rosterSpots);
  }

  public get assistPlayerIds(): number[] {
    return this.isEventGoal ? PlayByPlayUtils.getAssistPlayerIds(this.play.details) : [];
  }

  public get penaltyType(): string {
    return this.isEventGoal ? "" : PlayByPlayUtils.getPenaltyLabel(this.play?.details);
  }

  public get fontIcon(): string {
    if (PlayByPlayUtils.isGoal(this.play)) {
      return "sports_hockey";
    } else if (PlayByPlayUtils.isPenalty(this.play)) {
      return "front_hand";
    }
    return "";
  }

  public getAssistName(playerId: number): string {
    return PlayByPlayUtils.getFullName(this.rosterSpots?.get(playerId));
  }

  public onMainPlayerClicked(): void {
    let playerId = PlayByPlayUtils.getMainPlayerId(this.play);
    if (playerId) {
      this.playerClicked.emit(playerId);
    }
  }

  public onAssistClicked(playerId: number): void {
    this.playerClicked.emit(playerId);
  }

  public onMainPlayerHovered(): void {
    let playerId = PlayByPlayUtils.getMainPlayerId(this.play);
    if (playerId) {
      this.playerHovered.emit({playerId, goalIndex: this.isEventGoal ? this.goalIndex : undefined});
    }
  }

  public onAssistHovered(playerId: number): void {
    this.playerHovered.emit({playerId});
  }

  public onPlayerLeft(): void {
    this.playerHovered.emit(null);
  }

}
