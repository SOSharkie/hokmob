import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsSplitModel} from "@shared/models/nhl-stats/nhl-stats-split.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import * as dayjs from "dayjs";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";

@Component({
  selector: 'app-recent-player-games',
  templateUrl: './recent-player-games.component.html',
  styleUrls: ['./recent-player-games.component.scss']
})
export class RecentPlayerGamesComponent implements OnChanges {

  @Input()
  public playoffGames: NhlStatsSplitModel[];

  @Input()
  public regularSeasonGames: NhlStatsSplitModel[];

  @Input()
  public recentGames: NhlGameModel[];

  @Input()
  public teamId: number;

  public teamLogos: any[];

  public imagesLoaded: boolean = false;

  public get lastTenGames(): NhlStatsSplitModel[] {
    if (this.playoffGames) {
      if (this.playoffGames.length > 9) {
        return this.playoffGames.slice(0, 10);
      } else {
        return this.playoffGames.slice(0, this.playoffGames.length).concat(this.regularSeasonGames.slice(0, 10 - this.playoffGames.length));
      }
    } else if (this.regularSeasonGames) {
      return this.regularSeasonGames.slice(0, 10);
    }
    return [];
  }

  constructor(private nhlImageService: NhlImageService) {
  }

  public getDateString(date: string): string {
    return DateTimeUtils.getDateDisplayValue(dayjs(date).toDate());
  }

  public getRecentGameScore(index: number): string {
    if (this.recentGames) {
      let game = this.recentGames[index];
      if (game.teams.away.team.id === this.teamId) {
        return "(" + game.teams.away.score + " - " + game.teams.home.score + ")";
      } else {
        return "(" + game.teams.home.score + " - " + game.teams.away.score + ")";
      }
    }
    return "";
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if ((changes['regularSeasonGames'] || changes['playoffGames']) && !this.imagesLoaded) {
      if (!this.regularSeasonGames) {
        return;
      }
      this.teamLogos = [];
      for (let i = 0; i < 10; i++) {
        this.teamLogos.push('assets/nhl_logo.png');
      }
      this.lastTenGames.forEach((statSplit, index) => {
        this.nhlImageService.getNhlTeamLogo(statSplit.opponent.id).then(data => {
          let reader = new FileReader();
          reader.addEventListener("load", () => {
            this.teamLogos[index] = reader.result;
          }, false);
          reader.readAsDataURL(data);
        });
      });
      this.imagesLoaded = true;
    }
  }
}
