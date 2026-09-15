import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Play, RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {PeriodUtils} from "@shared/utils/period-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";

@Component({
  selector: 'app-mini-event',
  templateUrl: './mini-event.component.html',
  styleUrls: ['./mini-event.component.scss']
})
export class MiniEventComponent {

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

  @Output()
  public playerClicked = new EventEmitter<number>();

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

  /**
   * Assists show last names only, to fit the narrow timeline.
   */
  public getAssistName(playerId: number): string {
    return PlayByPlayUtils.getLastName(this.rosterSpots?.get(playerId));
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
}
