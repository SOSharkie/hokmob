import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";
import {StatsUtils} from "@shared/utils/stats-utils";

@Component({
  selector: 'app-mini-event',
  templateUrl: './mini-event.component.html',
  styleUrls: ['./mini-event.component.scss']
})
export class MiniEventComponent implements OnChanges {

  @Input()
  public event: NhlLiveFeedPlayModel;

  @Input()
  public homeTeamId: number;

  @Input()
  public awayTeamId: number;

  @Output()
  public playerClicked = new EventEmitter<number>();

  private eventTime: string = "";

  private eventAssists: string[] = [];

  private eventPenalty: string = "";

  public ngOnChanges(changes: SimpleChanges) {
    if (changes["event"]) {

      // Event time
      if (this.event.about.periodTime.startsWith('0')) {
        this.eventTime = this.event.about.periodTime.substring(1);
      }
      this.eventTime = this.event.about.periodTime;

      // Goal event assists
      if (this.isEventGoal) {
        if (this.event.players.length === 4) {
          this.eventAssists = [StatsUtils.getPlayerLastName(this.event.players[1].player.fullName) + ", ", StatsUtils.getPlayerLastName(this.event.players[2].player.fullName)];
        } else if (this.event.players.length === 3) {
          this.eventAssists = [StatsUtils.getPlayerLastName(this.event.players[1].player.fullName)];
        } else {
          this.eventAssists = [];
        }
      }

      // Penalty type
      if (!this.isEventGoal) {
        if (this.event.result.secondaryType.includes("Missing key")) {
          this.eventPenalty = this.event.result.penaltySeverity;
        } else {
          this.eventPenalty = this.event.result.secondaryType;
        }
      }
    }
  }

  public get isHomeEvent(): boolean {
    if (this.event) {
      return this.event.team.id === this.homeTeamId;
    }
    return true;
  }

  public get isEventGoal(): boolean {
    if (this.event) {
      return this.event.result.eventTypeId === "GOAL";
    }
    return false;
  }

  public get periodTime(): string {
    return this.eventTime;
  }

  public get goalEventHomeScore(): string {
    return this.event.about.goals.home.toString();
  }

  public get goalEventAwayScore(): string {
    return this.event.about.goals.away.toString();
  }

  public get eventPlayerName(): string {
    return this.event.players[0].player.fullName;
  }

  public get goalEventAssists(): string[] {
    return this.eventAssists;
  }

  public get penaltyType(): string {
    return this.eventPenalty;
  }

  public onMainPlayerClicked(): void {
    this.playerClicked.emit(this.event.players[0].player.id);
  }

  public onAssistClicked(index: number): void {
    this.playerClicked.emit(this.event.players[index + 1].player.id);
  }
}
