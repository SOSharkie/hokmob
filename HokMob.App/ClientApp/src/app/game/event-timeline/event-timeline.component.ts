import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from "@angular/core";
import {KeyEventPeriod, Play, PlayByPlay, RosterSpot} from "@shared/models/nhl-web-api/play-by-play.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {PeriodUtils} from "@shared/utils/period-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";

@Component({
  selector: 'app-event-timeline',
  templateUrl: './event-timeline.component.html',
  styleUrls: ['./event-timeline.component.scss']
})
export class EventTimelineComponent implements OnChanges {

  /**
   * The game's play-by-play. The timeline lists its goals and penalties by period.
   */
  @Input()
  public playByPlay: PlayByPlay;

  @Output()
  public playerClicked = new EventEmitter<number>();

  public periods: KeyEventPeriod[] = [];

  public rosterSpots = new Map<number, RosterSpot>();

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

}
