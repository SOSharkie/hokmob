import {Component, Input} from '@angular/core';
import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";

@Component({
  selector: 'app-event',
  templateUrl: './event.component.html',
  styleUrls: ['./event.component.scss']
})
export class EventComponent {

  @Input()
  public event: NhlLiveFeedPlayModel;

  @Input()
  public homeTeamId: number;

  @Input()
  public awayTeamId: number;

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

  public get eventSecondaryLabel(): string {
    if (this.isEventGoal) {
      if (this.event.players.length === 4) {
        return "Assists: " + this.event.players[1].player.fullName + ", " + this.event.players[2].player.fullName;
      } else if (this.event.players.length === 3) {
        return "Assists: " + this.event.players[1].player.fullName;
      } else {
        return "Unassisted"
      }
    } else {
      return this.event.result.secondaryType;
    }
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

}
