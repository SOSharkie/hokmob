import { Component } from '@angular/core';
import {GameModel} from "../../shared/models/game.model";

@Component({
  selector: 'app-scores',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss']
})
export class ScoreboardComponent {

  public currentDayGames: GameModel[] = [
    {homeTeam: "Sharks", awayTeam: "Flyers", gameTime: {hours: 4, minutes: 30}},
    {homeTeam: "Kings", awayTeam: "Rangers", gameTime: {hours: 6, minutes: 0}},
    {homeTeam: "Penguins", awayTeam: "Avalanche", gameTime: {hours: 7, minutes: 30}},
  ];
}
