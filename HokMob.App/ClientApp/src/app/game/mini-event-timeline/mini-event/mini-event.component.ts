import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";
import {StatsUtils} from "@shared/utils/stats-utils";

@Component({
  selector: 'app-mini-event',
  templateUrl: './mini-event.component.html',
  styleUrls: ['./mini-event.component.scss']
})
export class MiniEventComponent {

  @Input()
  public event: NhlLiveFeedPlayModel;

  @Input()
  public homeTeamId: number;

  @Input()
  public awayTeamId: number;

  @Output()
  public playerClicked = new EventEmitter<number>();

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
    if (this.event.about.periodTime.startsWith('0')) {
      return this.event.about.periodTime.substring(1);
    }
    return this.event.about.periodTime;
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
    if (this.isEventGoal) {
      if (this.event.players.length === 4) {
        return [StatsUtils.getPlayerLastName(this.event.players[1].player.fullName) + ", ", StatsUtils.getPlayerLastName(this.event.players[2].player.fullName)];
      } else if (this.event.players.length === 3) {
        return [StatsUtils.getPlayerLastName(this.event.players[1].player.fullName)];
      } else {
        return [];
      }
    }
    return [];
  }

  public get penaltyType(): string {
    if (!this.isEventGoal) {
      if (this.event.result.secondaryType.includes("Missing key")) {
        return this.event.result.penaltySeverity;
      }
      return this.event.result.secondaryType;
    }
    return "";
  }

  public get fontIcon(): string {
    switch (this.event.result.eventTypeId) {
      case "GOAL":
        return "sports_hockey";
      case "PENALTY":
        return "front_hand";
      default:
        return "";
    }
  }

  public onMainPlayerClicked(): void {
    this.playerClicked.emit(this.event.players[0].player.id);
  }

  public onAssistClicked(index: number): void {
    this.playerClicked.emit(this.event.players[index + 1].player.id);
  }
}
