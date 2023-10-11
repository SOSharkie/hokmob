import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {NhlBoxscorePlayerModel} from "@shared/models/nhl-boxscore/nhl-boxscore-player.model";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {StatsUtils} from "@shared/utils/stats-utils";

@Component({
  selector: 'app-game-top-players',
  templateUrl: './game-top-players.component.html',
  styleUrls: ['./game-top-players.component.scss']
})
export class GameTopPlayersComponent implements OnChanges {

  @Input()
  public homePlayerStats: NhlBoxscorePlayerModel[];

  @Input()
  public awayPlayerStats: NhlBoxscorePlayerModel[];

  @Output()
  public playerClicked = new EventEmitter<number>();

  public topHomePlayers: NhlBoxscorePlayerModel[] = [];

  public topAwayPlayers: NhlBoxscorePlayerModel[] = [];

  public homeGoalies: NhlBoxscorePlayerModel[] = [];

  public awayGoalies: NhlBoxscorePlayerModel[] = [];

  public homePlayerHeadshots: any[];

  public awayPlayerHeadshots: any[];

  public homeImagesLoaded: boolean = false;

  public awayImagesLoaded: boolean = false;

  public readonly numSkatersToShow = 6;

  constructor(private nhlImageService: NhlImageService) {
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['homePlayerStats']) {
      this.handleHomePlayers();
    }
    if (changes['awayPlayerStats']) {
      this.handleAwayPlayers();
    }
  }

  public handleHomePlayers(): void {
    if (!this.homePlayerStats || this.homePlayerStats.length < 1) {
      return;
    }
    let homeTopPlayers = this.homePlayerStats.slice(0, this.numSkatersToShow);
    this.homeGoalies = this.homePlayerStats.filter(player => player.position.code === 'G')
        .sort((a, b) => StatsUtils.sortByGoalieTimeOnIce(a, b));
    if (homeTopPlayers.findIndex(player => player.position.code === 'G') === -1) {
      homeTopPlayers[this.numSkatersToShow - 1] = this.homeGoalies[0];
    }
    let imagesChanged = false;
    if (this.topHomePlayers.length === this.numSkatersToShow || this.topAwayPlayers.length === this.numSkatersToShow) {
      for (let i = 0; i < 6; i++) {
        if (!imagesChanged) {
          if (homeTopPlayers[i].person.id !== this.topHomePlayers[i].person.id) {
            imagesChanged = true;
          }
        }
      }
    } else {
      imagesChanged = true;
    }
    this.topHomePlayers = homeTopPlayers;
    if (imagesChanged) {
      this.loadHomeImages();
    }
  }

  public handleAwayPlayers(): void {
    if (!this.awayPlayerStats || this.awayPlayerStats.length < 1) {
      return;
    }
    let awayTopPlayers = this.awayPlayerStats.slice(0, this.numSkatersToShow);
    this.awayGoalies = this.awayPlayerStats.filter(player => player.position.code === 'G')
        .sort((a, b) => StatsUtils.sortByGoalieTimeOnIce(a, b));
    if (awayTopPlayers.findIndex(player => player.position.code === 'G') === -1) {
      awayTopPlayers[this.numSkatersToShow - 1] = this.awayGoalies[0];
    }
    let imagesChanged = false;
    if (this.topAwayPlayers.length === this.numSkatersToShow) {
      for (let i = 0; i < 6; i++) {
        if (!imagesChanged) {
          if (awayTopPlayers[i].person.id !== this.topAwayPlayers[i].person.id) {
            imagesChanged = true;
          }
        }
      }
    } else {
      imagesChanged = true;
    }
    this.topAwayPlayers = awayTopPlayers;
    if (imagesChanged) {
      this.loadAwayImages();
    }
  }

  public loadHomeImages(): void {
    this.homePlayerHeadshots = [];
    for (let i = 0; i < this.numSkatersToShow; i++){
      this.homePlayerHeadshots.push('assets/blank_headshot.png');
    }
    this.homePlayerStats.slice(0, this.numSkatersToShow).forEach((player, index) => {
      this.nhlImageService.getNhlPlayerHeadshot(player.person.id).then(data => {
        let reader = new FileReader();
        reader.addEventListener("load", () => {
          this.homePlayerHeadshots[index] = reader.result;
        }, false);
        reader.readAsDataURL(data);
      });
    });
    this.homeImagesLoaded = true;
  }

  public loadAwayImages(): void {
    this.awayPlayerHeadshots = [];
    for (let i = 0; i < this.numSkatersToShow; i++){
      this.awayPlayerHeadshots.push('assets/blank_headshot.png')
    }
    this.awayPlayerStats.slice(0, this.numSkatersToShow).forEach((player, index) => {
      this.nhlImageService.getNhlPlayerHeadshot(player.person.id).then(data => {
        let reader = new FileReader();
        reader.addEventListener("load", () => {
          this.awayPlayerHeadshots[index] = reader.result;
        }, false);
        reader.readAsDataURL(data);
      });
    });
    this.awayImagesLoaded = true;
  }

  public getHokmobScoreColor(player: NhlBoxscorePlayerModel): string {
    if (player.stats.skaterStats) {
      return StatsUtils.getHokmobRatingColor(player.stats.skaterStats.hokmobRating);
    } else {
      return StatsUtils.getHokmobRatingColor(player.stats.goalieStats.hokmobRating);
    }
  }

  public clickPlayer(player: NhlBoxscorePlayerModel): void {
    this.playerClicked.emit(player.person.id);
  }

}
