import {Component, OnInit} from '@angular/core';
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlStatTeamModel} from "@shared/models/nhl-stats/nhl-stat-team.model";
import {NhlStatsRosterPlayerModel} from "@shared/models/nhl-stats/nhl-stats-roster-player.model";

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {

  public fullSkaterList: NhlStatsRosterPlayerModel[];

  public fullGoalieList: NhlStatsRosterPlayerModel[];

  public topPointsList: NhlStatsRosterPlayerModel[];

  public topGoalsList: NhlStatsRosterPlayerModel[];

  public topAssistsList: NhlStatsRosterPlayerModel[];

  public savePercentageList: NhlStatsRosterPlayerModel[];

  public shutOutsList: NhlStatsRosterPlayerModel[];


  constructor(private nhlStatsService: NhlStatsService) {
  }

  public ngOnInit(): void {
    this.fullSkaterList = [];
    this.fullGoalieList = [];
    this.nhlStatsService.netNhlStats(true).then(result  => {
      let fullPlayerList = [];
      result.forEach((team) => {
        fullPlayerList = fullPlayerList.concat(team.roster.roster);
      });

      this.fullSkaterList = fullPlayerList.filter(player => {
        return player.person.stats[0].splits[0] && player.person.stats[0].splits[0].stat.points > 0;
      });
      this.fullGoalieList = fullPlayerList.filter(player => {
        return player.person.stats[0].splits[0] && player.person.stats[0].splits[0].stat.saves > 0;
      });

      this.topPointsList = this.fullSkaterList.sort((a, b) => this.sortByPoints(a, b)).slice(0, 25);
      this.topGoalsList = this.fullSkaterList.sort((a, b) => this.sortByGoals(a, b)).slice(0, 25);
      this.topAssistsList = this.fullSkaterList.sort((a, b) => this.sortByAssists(a, b)).slice(0, 25);
      this.savePercentageList = this.fullGoalieList.sort((a, b) => this.sortBySavePercentage(a, b)).slice(0, 25);
      this.shutOutsList = this.fullGoalieList.sort((a, b) => this.sortByShutouts(a, b)).slice(0, 25);

    });
  }

  private sortByPoints(playerA: NhlStatsRosterPlayerModel, playerB: NhlStatsRosterPlayerModel): number {
    return playerB.person.stats[0].splits[0].stat.points - playerA.person.stats[0].splits[0].stat.points;
  }

  private sortByGoals(playerA: NhlStatsRosterPlayerModel, playerB: NhlStatsRosterPlayerModel): number {
    return playerB.person.stats[0].splits[0].stat.goals - playerA.person.stats[0].splits[0].stat.goals;
  }

  private sortByAssists(playerA: NhlStatsRosterPlayerModel, playerB: NhlStatsRosterPlayerModel): number {
    return playerB.person.stats[0].splits[0].stat.assists - playerA.person.stats[0].splits[0].stat.assists;
  }

  private sortBySavePercentage(playerA: NhlStatsRosterPlayerModel, playerB: NhlStatsRosterPlayerModel): number {
    return playerB.person.stats[0].splits[0].stat.savePercentage - playerA.person.stats[0].splits[0].stat.savePercentage;
  }

  private sortByShutouts(playerA: NhlStatsRosterPlayerModel, playerB: NhlStatsRosterPlayerModel): number {
    return playerB.person.stats[0].splits[0].stat.shutouts - playerA.person.stats[0].splits[0].stat.shutouts;
  }
}

