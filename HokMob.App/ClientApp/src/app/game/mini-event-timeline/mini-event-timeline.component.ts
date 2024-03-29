import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {NhlLiveFeedPlayModel} from "@shared/models/nhl-live-feed/nhl-live-feed-play.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";

@Component({
  selector: 'app-mini-event-timeline',
  templateUrl: './mini-event-timeline.component.html',
  styleUrls: ['./mini-event-timeline.component.scss']
})
export class MiniEventTimelineComponent implements OnChanges {

  @Input()
  public gameLiveData: NhlLiveFeedModel;

  @Input()
  public homeTeamLogo: any;

  @Input()
  public awayTeamLogo: any;

  @Output()
  public playerClicked = new EventEmitter<number>();

  public periodEvents: NhlLiveFeedPlayModel[][];

  public get isGameFinal(): boolean {
    if (this.gameLiveData) {
      return NhlGameInfoUtils.isCompletedGame(this.gameLiveData.gameData.status);
    }
    return false;
  }

  public hasPeriod(periodIndex: number): boolean {
    if (this.gameLiveData && this.gameLiveData.liveData.plays.playsByPeriod &&
        this.gameLiveData.liveData.plays.playsByPeriod[periodIndex]) {
      return this.gameLiveData.liveData.plays.playsByPeriod[periodIndex].plays.length > 0;
    }
    return false;
  }

  public getPeriodLabel(periodIndex: number): string {
    switch (periodIndex) {
      case 0:
        return "1st";
      case 1:
        return "2nd";
      case 2:
        return "3rd";
      case 3:
        return "OT";
      default:
        return (periodIndex - 2) + "OT";
    }
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['gameLiveData'] && this.gameLiveData) {
      this.periodEvents = [[], [], [], [], [], [], [], []];
      let keyPlayIndices = this.gameLiveData.liveData.plays.scoringPlays
          .concat(this.gameLiveData.liveData.plays.penaltyPlays);
      keyPlayIndices.sort((a, b) => a - b);
      keyPlayIndices.forEach(keyPlayIndex => {
        let periodIndex = this.gameLiveData.liveData.plays.allPlays[keyPlayIndex].about.period - 1;
        this.periodEvents[periodIndex].push(this.gameLiveData.liveData.plays.allPlays[keyPlayIndex]);
      });
    }
  }

  public onPlayerClicked(playerId: number): void {
    this.playerClicked.emit(playerId);
  }

}
