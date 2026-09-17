import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {KeyEventPeriod, Play, PlayByPlay, RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {PeriodUtils} from "@shared/utils/period-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {PlayerHighlight} from "@shared/models/player-highlight.model";

@Component({
  selector: 'app-mini-event-timeline',
  templateUrl: './mini-event-timeline.component.html',
  styleUrls: ['./mini-event-timeline.component.scss']
})
export class MiniEventTimelineComponent implements OnChanges {

  /**
   * The game's play-by-play. The timeline lists its goals and penalties by period.
   */
  @Input()
  public playByPlay: PlayByPlay;

  @Input()
  public homeTeamLogo: any;

  @Input()
  public awayTeamLogo: any;

  @Output()
  public playerClicked = new EventEmitter<number>();

  /**
   * Emits the player hovered in an event, and null when the mouse leaves them.
   */
  @Output()
  public playerHovered = new EventEmitter<PlayerHighlight>();

  public periods: KeyEventPeriod[] = [];

  public rosterSpots = new Map<number, RosterSpot>();

  /**
   * Each goal's index among its scorer's goals in this game, by event ID.
   */
  public goalIndexes = new Map<number, number>();

  public get homeTeamId(): number {
    return this.playByPlay?.homeTeam?.id;
  }

  public get isGameFinal(): boolean {
    return NhlGameInfoUtils.isCompletedGame(this.playByPlay?.gameState);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['playByPlay']) {
      this.periods = PlayByPlayUtils.getKeyEventPeriods(this.playByPlay);
      this.rosterSpots = PlayByPlayUtils.getRosterSpotMap(this.playByPlay);
      this.goalIndexes = PlayByPlayUtils.getGoalIndexes(this.periods);
    }
  }

  public getPeriodLabel(period: KeyEventPeriod): string {
    return PeriodUtils.getLabel(period.periodDescriptor);
  }

  /**
   * Keeps the rendered events when the play-by-play refreshes.
   */
  public trackPlay(index: number, play: Play): number {
    return play.eventId;
  }

  public onPlayerClicked(playerId: number): void {
    this.playerClicked.emit(playerId);
  }

  public onPlayerHovered(highlight: PlayerHighlight): void {
    this.playerHovered.emit(highlight);
  }

}
