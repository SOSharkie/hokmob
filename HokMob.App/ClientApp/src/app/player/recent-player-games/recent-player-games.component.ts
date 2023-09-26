import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsSplitModel} from "@shared/models/nhl-stats/nhl-stats-split.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import * as dayjs from "dayjs";
import {NhlImageService} from "@shared/services/nhl-image.service";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlPlayerStatsModel} from "@shared/models/nhl-stats/nhl-player-stats.model";
import {NhlTeamLogoUtils} from "@shared/utils/nhl-team-logo-utils";

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

  @Input()
  public teamColor: string;

  @Input()
  public isGoalie: boolean;

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

  public getPlusMinusColor(stat: NhlPlayerStatsModel): string {
    return stat.plusMinus > 0 ? '#84dc7b' : stat.plusMinus < 0 ? '#e34d53' : 'white';
  }

  constructor(private nhlImageService: NhlImageService) {
  }

  public getDateString(date: string): string {
    return DateTimeUtils.getDateDisplayValue(dayjs(date).toDate());
  }

  public getRecentGameScore(index: number): string {
    if (this.recentGames && this.recentGames[index]) {
      let game = this.recentGames[index];
      if (game.teams.away.team.id === this.teamId) {
        return "(" + game.teams.away.score + " - " + game.teams.home.score + ")";
      } else {
        return "(" + game.teams.home.score + " - " + game.teams.away.score + ")";
      }
    }
    return "";
  }

  public getRecentGameGoalsAgainstAverage(gameStats: NhlPlayerStatsModel): number {
    return ((gameStats.goalsAgainst * 60) / Number(gameStats.timeOnIce.replace(":", ".")));
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if ((changes['regularSeasonGames'] || changes['playoffGames']) && !this.imagesLoaded) {
      if (!this.regularSeasonGames) {
        return;
      }
      this.teamLogos = [];
      this.lastTenGames.forEach((statSplit, index) => {
        this.teamLogos[index] = NhlTeamLogoUtils.getTeamPrimaryLogo(statSplit.opponent.id);
      });
      this.imagesLoaded = true;
    }
  }
}
