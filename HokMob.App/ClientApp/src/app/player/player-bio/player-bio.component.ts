import {Component, Input} from '@angular/core';
import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";

@Component({
  selector: 'app-player-bio',
  templateUrl: './player-bio.component.html',
  styleUrls: ['./player-bio.component.scss']
})
export class PlayerBioComponent {

  @Input()
  public player: NhlPersonModel;

  @Input()
  public countryFlagPath: string;

  public get shoots(): string {
    if (this.player) {
      if (this.player.shootsCatches === "L") {
        return "Left";
      }
      return "Right";
    }
    return "Right";
  }

  public get weight(): string {
    if (this.player) {
      return this.player.weight + " lb";
    }
    return "-";
  }

  public get rosterStatusHeader(): string {
    if (this.player) {
      if (this.player.captain) {
        return "Captain";
      } else if (this.player.alternateCaptain) {
        return "Captain";
      } else {
        return "Rookie"
      }
    }
    return "-";
  }

  public get rosterStatus(): string {
    if (this.player) {
      if (this.player.captain) {
        return "Yes";
      } else if (this.player.alternateCaptain) {
        return "Alternate";
      } else if (this.player.rookie) {
        return "Yes"
      } else {
        return "No";
      }
    }
    return "-";
  }

}
