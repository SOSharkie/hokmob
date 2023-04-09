import {Component, Input} from '@angular/core';
import {Time} from "@angular/common";
import {GameModel} from "../../models/game.model";
import {NhlGameModel} from "@shared/models/nhl-game.model";
import * as dayjs from 'dayjs'

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.component.html',
  styleUrls: ['./scorecard.component.scss']
})
export class ScorecardComponent {

  @Input()
  public game: NhlGameModel;

  public get completedGame(): boolean {
    if (this.game) {
      return this.game.status.abstractGameState === "Final"
    }
    return false;
  }

  public get homeTeamName(): string {
    if (this.game) {
      return this.game.teams.home.team.name
    }
    return "N/A"
  }

  public get awayTeamName(): string {
    if (this.game) {
      return this.game.teams.away.team.name
    }
    return "N/A"
  }

  public get gameTime(): string {
    if (this.game) {
      return dayjs(this.game.gameDate).format("h:mm");
    }
    return "N/A"
  }

  public get gameScore(): string {
    if (this.game) {
      return this.game.teams.home.score + " - " + this.game.teams.away.score;
    }
    return "N/A"
  }
}
