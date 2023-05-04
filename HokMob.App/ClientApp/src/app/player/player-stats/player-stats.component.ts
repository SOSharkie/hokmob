import {Component, Input} from '@angular/core';
import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";

@Component({
  selector: 'app-player-stats',
  templateUrl: './player-stats.component.html',
  styleUrls: ['./player-stats.component.scss']
})
export class PlayerStatsComponent {

  @Input()
  public statTitle: string;

  @Input()
  public stats: NhlPlayerStatsModel;

  @Input()
  public player: NhlPersonModel;

  public get isGoalie(): boolean {
    if (this.player) {
      return this.player.primaryPosition.code === "G";
    }
    return false;
  }

  public formatFaceOffPercent(value: number): string {
    return value.toFixed(1) + "%";
  }

}
