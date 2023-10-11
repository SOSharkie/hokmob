import {Component, OnInit, QueryList, ViewChildren} from '@angular/core';
import {NhlStatsService} from "@shared/services/nhl-stats.service";
import {NhlPlayerModel} from "@shared/models/nhl-stats/nhl-player.model";
import {StatsUtils} from "@shared/utils/stats-utils";
import {StatLeaderboardComponent} from "@app/stats/stat-leaderboard/stat-leaderboard.component";
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import * as dayjs from "dayjs";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {

  @ViewChildren('statLeaderboardComponent')
  public statLeaderboards: QueryList<StatLeaderboardComponent>;

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

  public showFilters: boolean = false;

  public playoffsSelected: boolean = false;

  public filtersEnabled: boolean = true;

  public isLoading: boolean = false;

  private minimumGoalieSavesPlayoffs = 20;

  private minimumGoalieSavesRegularSeason = 100;

  private readonly topNumberOfPlayers = 25;

  constructor(private nhlStatsService: NhlStatsService,
              private activatedRoute: ActivatedRoute,
              private router: Router) {
  }

  public ngOnInit(): void {
    this.setDateDependentFields();
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      if (params.has("gameType")) {
        this.playoffsSelected = params.get("gameType") === "P";
      }
      this.isLoading = true;
      this.updateStats();
    });
  }

  public updateGameType(isPlayoffs: boolean): void {
    if (this.filtersEnabled && (isPlayoffs !== this.playoffsSelected)) {
      this.isLoading = true;
      this.playoffsSelected = isPlayoffs;
      this.disableFiltersForTwoSeconds();
      let gameTypeParam = this.playoffsSelected ? "P" : "R";
      this.router.navigate([],
          {
            relativeTo: this.activatedRoute,
            queryParams: {gameType: gameTypeParam},
          }
      );
      this.statLeaderboards.forEach(leaderboard => {
        leaderboard.imagesLoaded = false;
      });
      this.updateStats();
    }
  }

  private setDateDependentFields(): void {
    this.showFilters = DateTimeUtils.isPlayoffMode();
    this.playoffsSelected = DateTimeUtils.isPlayoffMode();

    if (dayjs().month() === 9) {
      this.minimumGoalieSavesRegularSeason = dayjs().date();
    } else if (dayjs().month() === 10) {
      this.minimumGoalieSavesRegularSeason = 50;
    } else {
      this.minimumGoalieSavesRegularSeason = 100;
    }
  }

  private updateStats(): void {
    this.fullSkaterList = [];
    this.fullGoalieList = [];
    this.nhlStatsService.getNhlStats(DateTimeUtils.getCurrentNhlSeason(), this.playoffsSelected).then(result  => {
      let fullPlayerList = [];
      result.forEach((team) => {
        fullPlayerList = fullPlayerList.concat(team.roster.roster);
      });

      this.fullSkaterList = fullPlayerList.filter(player => {
        return player.person.stats[0].splits[0] && player.person.stats[0].splits[0].stat.points > 0;
      });
      this.fullGoalieList = fullPlayerList.filter(player => {
        return player.person.stats[0].splits[0] && player.person.stats[0].splits[0].stat.saves >
            (this.playoffsSelected ? this.minimumGoalieSavesPlayoffs : this.minimumGoalieSavesRegularSeason);
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
      this.isLoading = false;
    });
  }

  private disableFiltersForTwoSeconds() {
    this.filtersEnabled = false;
    setTimeout(() => {
      this.filtersEnabled = true;
    }, 2000);
  }
}

