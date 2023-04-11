import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlBoxscoreModel} from "@shared/models/nhl-boxscore/nhl-boxscore.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit {

  public gameBoxscore: NhlBoxscoreModel;

  public gameInfo: NhlGameModel;

  constructor(private route: ActivatedRoute,
              private nhlGameService: NhlGameService) {
  }

  public ngOnInit(): void {
    this.route.params.subscribe((params: Params) => {
      const gameId = params['id'];
      console.log("game id is", gameId);
      this.nhlGameService.getNhlGameBoxscore(gameId).then(boxscore => {
        this.gameBoxscore = boxscore;
        console.log("boxscore", boxscore);
      });
      this.nhlGameService.getNhlGames(new Date()).then(games => {
        this.gameInfo = games.games.find(game => game.gamePk === Number(gameId));
      });
    });
  }

}
