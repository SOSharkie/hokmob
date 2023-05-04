import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from "@angular/core";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";

@Component({
  selector: 'app-event-timeline',
  templateUrl: './event-timeline.component.html',
  styleUrls: ['./event-timeline.component.scss']
})
export class EventTimelineComponent implements OnChanges {

  @Input()
  public gameLiveData: NhlLiveFeedModel;

  @Output()
  public playerClicked = new EventEmitter<number>();

  public firstPeriodEvents: NhlLiveFeedPlayModel[];

  public secondPeriodEvents: NhlLiveFeedPlayModel[];

  public thirdPeriodEvents: NhlLiveFeedPlayModel[];

  public overtimePeriodEvents: NhlLiveFeedPlayModel[];

  public secondOvertimePeriodEvents: NhlLiveFeedPlayModel[];

  public thirdOvertimePeriodEvents: NhlLiveFeedPlayModel[];

  public get hasFirstPeriod(): boolean {
    if (this.firstPeriodEvents) {
      return this.firstPeriodEvents.length > 0;
    }
    return false;
  }

  public get hasSecondPeriod(): boolean {
    if (this.secondOvertimePeriodEvents) {
      return this.secondPeriodEvents.length > 0;
    }
    return false;
  }

  public get hasThirdPeriod(): boolean {
    if (this.thirdOvertimePeriodEvents) {
      return this.thirdPeriodEvents.length > 0;
    }
    return false;
  }

  public get hasOvertimePeriod(): boolean {
    if (this.overtimePeriodEvents) {
      return this.overtimePeriodEvents.length > 0;
    }
    return false;
  }

  public get hasSecondOvertimePeriod(): boolean {
    if (this.secondOvertimePeriodEvents) {
      return this.secondOvertimePeriodEvents.length > 0;
    }
    return false;
  }

  public get hasThirdOvertimePeriod(): boolean {
    if (this.thirdOvertimePeriodEvents) {
      return this.secondOvertimePeriodEvents.length > 0;
    }
    return false;
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['gameLiveData'] && this.gameLiveData) {
      this.firstPeriodEvents = [];
      this.secondPeriodEvents = [];
      this.thirdPeriodEvents = [];
      this.overtimePeriodEvents = [];
      this.secondOvertimePeriodEvents = [];
      this.thirdOvertimePeriodEvents = [];
      let keyPlayIndices = this.gameLiveData.liveData.plays.scoringPlays
          .concat(this.gameLiveData.liveData.plays.penaltyPlays);
      keyPlayIndices.sort((a, b) => a - b);
      keyPlayIndices.forEach(keyPlayIndex => {
        switch (this.gameLiveData.liveData.plays.allPlays[keyPlayIndex].about.period) {
          case 1:
            this.firstPeriodEvents.push(this.gameLiveData.liveData.plays.allPlays[keyPlayIndex]);
            break;
          case 2:
            this.secondPeriodEvents.push(this.gameLiveData.liveData.plays.allPlays[keyPlayIndex]);
            break;
          case 3:
            this.thirdPeriodEvents.push(this.gameLiveData.liveData.plays.allPlays[keyPlayIndex]);
            break;
          case 4:
            this.overtimePeriodEvents.push(this.gameLiveData.liveData.plays.allPlays[keyPlayIndex]);
            break;
          case 5:
            this.secondOvertimePeriodEvents.push(this.gameLiveData.liveData.plays.allPlays[keyPlayIndex]);
            break;
          default:
            this.thirdOvertimePeriodEvents.push(this.gameLiveData.liveData.plays.allPlays[keyPlayIndex]);
        }
      });
    }
  }

  public onPlayerClicked(playerId: number): void {
    this.playerClicked.emit(playerId);
  }

}