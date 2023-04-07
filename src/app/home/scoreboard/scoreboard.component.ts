import {Component, ViewChild, ViewEncapsulation} from '@angular/core';
import {GameModel} from "../../shared/models/game.model";
import {MatDatepicker} from "@angular/material/datepicker";

@Component({
  selector: 'app-scores',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ScoreboardComponent {

  @ViewChild('datePicker')
  public datePicker: MatDatepicker<any>;

  public currentDayGames: GameModel[] = [
    {homeTeam: "Sharks", awayTeam: "Flyers", gameTime: {hours: 4, minutes: 30}},
    {homeTeam: "Kings", awayTeam: "Rangers", gameTime: {hours: 6, minutes: 30}},
    {homeTeam: "Penguins", awayTeam: "Avalanche", gameTime: {hours: 7, minutes: 30}},
  ];

  public onClickDate(): void {
    this.datePicker.open();
  }
}
