import {Component, Input} from '@angular/core';
import * as dayjs from "dayjs";
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";

/**
 * The player's bio, from player/{id}/landing. Neither NHL API has captaincy or rookie flags, so the old
 * "Captain / Rookie" tile shows the draft instead.
 */
@Component({
  selector: 'app-player-bio',
  templateUrl: './player-bio.component.html',
  styleUrls: ['./player-bio.component.scss']
})
export class PlayerBioComponent {

  @Input()
  public player: PlayerLanding;

  @Input()
  public countryFlagPath: string;

  public get position(): string {
    return this.player?.position ?? "-";
  }

  public get age(): string {
    return this.player?.birthDate ? String(dayjs().diff(dayjs(this.player.birthDate), 'year')) : "-";
  }

  /**
   * The height as feet and inches, like 6' 3" for 75 inches.
   */
  public get height(): string {
    if (!this.player?.heightInInches) {
      return "-";
    }
    return Math.floor(this.player.heightInInches / 12) + "' " + (this.player.heightInInches % 12) + "\"";
  }

  /**
   * "Shoots" for a skater, "Catches" for a goalie.
   */
  public get shootsCatchesHeader(): string {
    return this.player?.position === "G" ? "Catches" : "Shoots";
  }

  public get shootsCatches(): string {
    if (!this.player?.shootsCatches) {
      return "-";
    }
    return this.player.shootsCatches === "L" ? "Left" : "Right";
  }

  public get birthCountry(): string {
    return this.player?.birthCountry ?? "-";
  }

  public get sweaterNumber(): string {
    return this.player?.sweaterNumber ? String(this.player.sweaterNumber) : "-";
  }

  public get weight(): string {
    return this.player?.weightInPounds ? this.player.weightInPounds + " lb" : "-";
  }

  /**
   * The draft, like "2011 R1 #7 (WPG)", or "Undrafted" for a player without draft details.
   */
  public get draft(): string {
    const draft = this.player?.draftDetails;
    if (!draft?.year) {
      return "Undrafted";
    }
    return draft.year + " R" + draft.round + " #" + draft.overallPick + " (" + draft.teamAbbrev + ")";
  }
}
