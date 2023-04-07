import {Component, Input} from '@angular/core';
import {Time} from "@angular/common";
import {GameModel} from "../../models/game.model";

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.component.html',
  styleUrls: ['./scorecard.component.scss']
})
export class ScorecardComponent {

  @Input()
  public game: GameModel;
}
