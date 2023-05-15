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

  @Input()
  public teamColor: string;

  public get isGoalie(): boolean {
    if (this.player) {
      return this.player.primaryPosition.code === "G";
    }
    return false;
  }

  public get plusMinusColor(): string {
    if (this.stats) {
      return this.stats.plusMinus > 0 ? '#84dc7b' : this.stats.plusMinus < 0 ? '#e34d53' : 'white';
    }
    return "white";
  }

  public get faceOffColor(): string {
    if (this.stats && this.stats.faceOffPct) {
      return this.stats.faceOffPct > 50 ? '#84dc7b' : this.stats.plusMinus < 50 ? '#e34d53' : 'white';
    }
    return "white";
  }

  public formatFaceOffPercent(value: number): string {
    if (value) {
      return value.toFixed(1) + "%";
    }
    return "-";
  }

}
