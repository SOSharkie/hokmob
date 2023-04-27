import {Component, OnInit} from '@angular/core';
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlStatTeamModel} from "@shared/models/nhl-stats/nhl-stat-team.model";
import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";
import {StatsUtils} from "@shared/utils/stats-utils";

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {

  public fullSkaterList: NhlPlayerModel[];

  public fullGoalieList: NhlPlayerModel[];

  public topPointsList: NhlPlayerModel[];

  public topGoalsList: NhlPlayerModel[];

  public topAssistsList: NhlPlayerModel[];

  public topShotsList: NhlPlayerModel[];

  public topHitsList: NhlPlayerModel[];

  public timeOnIcePerGameList: NhlPlayerModel[];

  public savePercentageList: NhlPlayerModel[];

  public goalsAgainstList: NhlPlayerModel[];

  public winsList: NhlPlayerModel[];

  private readonly minimumGoalieSaves = 10;

  private readonly topNumberOfPlayers = 25;


  constructor(private nhlStatsService: NhlStatsService) {
  }

  public ngOnInit(): void {
    this.fullSkaterList = [];
    this.fullGoalieList = [];
    this.nhlStatsService.netNhlStats("20222023", true).then(result  => {
      let fullPlayerList = [];
      result.forEach((team) => {
        fullPlayerList = fullPlayerList.concat(team.roster.roster);
      });

      this.fullSkaterList = fullPlayerList.filter(player => {
        return player.person.stats[0].splits[0] && player.person.stats[0].splits[0].stat.points > 0;
      });
      this.fullGoalieList = fullPlayerList.filter(player => {
        return player.person.stats[0].splits[0] && player.person.stats[0].splits[0].stat.saves > this.minimumGoalieSaves;
      });

      this.topPointsList = this.fullSkaterList.sort((a, b) => StatsUtils.sortByField(a, b, "points")).slice(0, this.topNumberOfPlayers);
      this.topGoalsList = this.fullSkaterList.sort((a, b) => StatsUtils.sortByField(a, b, "goals")).slice(0, this.topNumberOfPlayers);
      this.topAssistsList = this.fullSkaterList.sort((a, b) => StatsUtils.sortByField(a, b, "assists")).slice(0, this.topNumberOfPlayers);
      this.savePercentageList = this.fullGoalieList.sort((a, b) => StatsUtils.sortByField(a, b, "savePercentage")).slice(0, this.topNumberOfPlayers);
      this.goalsAgainstList = this.fullGoalieList.sort((a, b) => StatsUtils.sortByField(b, a, "goalAgainstAverage")).slice(0, this.topNumberOfPlayers);
      this.winsList = this.fullGoalieList.sort((a, b) => StatsUtils.sortByField(a, b, "wins")).slice(0, this.topNumberOfPlayers);
      this.topShotsList = this.fullSkaterList.sort((a, b) => StatsUtils.sortByField(a, b, "shots")).slice(0, this.topNumberOfPlayers);
      this.topHitsList = this.fullSkaterList.sort((a, b) => StatsUtils.sortByField(a, b, "hits")).slice(0, this.topNumberOfPlayers);
      this.timeOnIcePerGameList = this.fullSkaterList.sort((a, b) => StatsUtils.sortByTimeField(a, b, "timeOnIcePerGame")).slice(0, this.topNumberOfPlayers);
    });
  }
}

