import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {NhlLeadersService} from "@shared/services/nhl-leaders.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {GoalieStatsLeaders, SkaterStatsLeaders, StatsLeader} from "@shared/models/nhl-web-api/stats-leaders.model";
import {HitsAndShotsLeaders} from "@shared/models/nhl-stats-api/leaders.model";
import {SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {NhlTeamUtils} from "@shared/utils/nhl-team-utils";
import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {LeaderboardEntry, LeaderboardFormat} from "@app/stats/stat-leaderboard/stat-leaderboard.component";

/**
 * One leaderboard of the stats page.
 */
export interface Leaderboard {
  title: string;
  entries: LeaderboardEntry[];
  format: LeaderboardFormat;
}

/**
 * The stats page. Three requests: the NHL web API's skater and goalie leaders, which carry the NHL's own
 * qualification rules, headshots and logos, and the stats API's hits and shots leaders, which the web API has no
 * category for. The season is the standings season, so the off-season shows the last season played.
 */
@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {

  public leaderboards: Leaderboard[] = [];

  public showFilters: boolean = false;

  public playoffsSelected: boolean = false;

  public filtersEnabled: boolean = true;

  public isLoading: boolean = false;

  /** The season the leaderboards are for, from the standings. Undefined until they load. */
  private season: number;

  /** The game type of the last request, so a response of the other one is ignored. */
  private requestedGameType: number;

  private readonly skaterCategories = ["points", "goals", "assists", "toi"];

  private readonly goalieCategories = ["savePctg", "goalsAgainstAverage", "wins"];

  private readonly leaderCount = 5;

  private get gameType(): number {
    return this.playoffsSelected ? 3 : 2;
  }

  constructor(private nhlLeadersService: NhlLeadersService,
              private nhlStatsApiService: NhlStatsApiService,
              private nhlStandingAndPlayoffService: NhlStandingAndPlayoffService,
              private activatedRoute: ActivatedRoute,
              private router: Router) {
  }

  public ngOnInit(): void {
    this.showFilters = DateTimeUtils.isPlayoffMode();
    this.playoffsSelected = DateTimeUtils.isPlayoffMode();
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      if (params.has("gameType")) {
        this.playoffsSelected = params.get("gameType") === "P";
      }
      this.updateStats();
    });
  }

  /**
   * Switches between the regular season and the playoffs. The game type is a query parameter, so the leaders are
   * loaded by the query parameter subscription rather than here.
   */
  public updateGameType(isPlayoffs: boolean): void {
    if (this.filtersEnabled && (isPlayoffs !== this.playoffsSelected)) {
      this.playoffsSelected = isPlayoffs;
      this.isLoading = true;
      this.disableFiltersForTwoSeconds();
      const gameTypeParam = this.playoffsSelected ? "P" : "R";
      this.router.navigate([],
          {
            relativeTo: this.activatedRoute,
            queryParams: {gameType: gameTypeParam},
          }
      );
    }
  }

  /**
   * Loads the leaderboards of the selected game type. The season comes from the standings, which are only asked for
   * once: switching between the regular season and the playoffs reloads the leaders alone.
   */
  private updateStats(): void {
    this.isLoading = true;
    this.requestedGameType = this.gameType;
    if (this.season) {
      this.retrieveLeaders(this.season, this.gameType);
      return;
    }
    this.nhlStandingAndPlayoffService.getNhlStandings(NhlStandingsTypeEnum.BY_LEAGUE).then(standings => {
      this.season = standings[0]?.teams[0]?.seasonId;
      if (!this.season) {
        this.showEmptyLeaderboards();
        return;
      }
      this.retrieveLeaders(this.season, this.requestedGameType);
    }).catch(() => {
      // The service logs the error. Without a season there's nothing to ask the leaders for
      this.showEmptyLeaderboards();
    });
  }

  /**
   * Loads the three sources at once and builds every leaderboard from what came back, so a source that fails only
   * leaves its own boards empty.
   */
  private retrieveLeaders(season: number, gameType: number): void {
    const skaterLeaders = this.nhlLeadersService
        .getSkaterLeaders(season, gameType, this.skaterCategories, this.leaderCount)
        .catch(() => null);
    const goalieLeaders = this.nhlLeadersService
        .getGoalieLeaders(season, gameType, this.goalieCategories, this.leaderCount)
        .catch(() => null);
    const hitsAndShots = this.nhlStatsApiService.getHitsAndShotsLeaders(season, gameType, this.leaderCount)
        .catch(() => null);
    Promise.all([skaterLeaders, goalieLeaders, hitsAndShots]).then(([skaters, goalies, hitsAndShotsLeaders]) => {
      if (this.requestedGameType !== gameType) {
        return;
      }
      this.leaderboards = this.buildLeaderboards(skaters, goalies, hitsAndShotsLeaders);
      this.isLoading = false;
    });
  }

  private buildLeaderboards(skaters: SkaterStatsLeaders, goalies: GoalieStatsLeaders,
                            hitsAndShots: HitsAndShotsLeaders): Leaderboard[] {
    return [
      {title: "Points", entries: this.toEntries(skaters?.points), format: "number"},
      {title: "Goals", entries: this.toEntries(skaters?.goals), format: "number"},
      {title: "Assists", entries: this.toEntries(skaters?.assists), format: "number"},
      {title: "Save Percentage", entries: this.toEntries(goalies?.savePctg), format: "savePctg"},
      {title: "Goals Against Average", entries: this.toEntries(goalies?.goalsAgainstAverage), format: "gaa"},
      {title: "Wins", entries: this.toEntries(goalies?.wins), format: "number"},
      {title: "Shots", entries: this.toSkaterEntries(hitsAndShots?.shots, "shots"), format: "number"},
      {title: "Hits", entries: this.toSkaterEntries(hitsAndShots?.hits, "hits"), format: "number"},
      {title: "Time On Ice Per Game", entries: this.toEntries(skaters?.toi), format: "toi"}
    ];
  }

  /**
   * Converts NHL web API leaders, which bring their own headshot and a team abbreviation.
   */
  private toEntries(leaders: StatsLeader[]): LeaderboardEntry[] {
    return (leaders ?? []).map(leader => ({
      playerId: leader.id,
      name: (leader.firstName?.default ?? "") + " " + (leader.lastName?.default ?? ""),
      teamId: NhlTeamUtils.getTeamIdByAbbrev(leader.teamAbbrev),
      headshot: leader.headshot,
      value: leader.value
    }));
  }

  /**
   * Converts stats API rows, which have no headshot and list every team of the season ("CGY,VAN"). The headshot is
   * built from the player's last team of that season.
   */
  private toSkaterEntries(rows: SkaterSeasonStats[], field: "hits" | "shots"): LeaderboardEntry[] {
    return (rows ?? []).map(row => {
      const teamAbbrev = row.teamAbbrevs?.split(",").pop()?.trim();
      return {
        playerId: row.playerId,
        name: row.skaterFullName,
        teamId: NhlTeamUtils.getTeamIdByAbbrev(teamAbbrev),
        headshot: NhlPlayerHeadshotUtils.getHeadshotUrl(row.seasonId ?? this.season, teamAbbrev, row.playerId),
        value: row[field]
      };
    });
  }

  /**
   * Shows every leaderboard's empty state, for when there is no season to ask the leaders for.
   */
  private showEmptyLeaderboards(): void {
    this.leaderboards = this.buildLeaderboards(null, null, null);
    this.isLoading = false;
  }

  private disableFiltersForTwoSeconds(): void {
    this.filtersEnabled = false;
    setTimeout(() => {
      this.filtersEnabled = true;
    }, 2000);
  }
}
