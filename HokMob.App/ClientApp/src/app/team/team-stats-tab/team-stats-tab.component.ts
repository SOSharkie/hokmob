import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NaturalStatTrickService} from "@shared/services/natural-stat-trick.service";
import {NstTeamSeasonStats} from "@shared/models/natural-stat-trick/nst-team-stats.model";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {TeamRating, TeamRatingPoint, TeamRatingUtils} from "@shared/utils/team-rating-utils";

/**
 * The team page's team stats tab: the power rating, the season stats and the advanced stats cards, and the power rating
 * chart below them. Every team's games of the season (/api/nhl-stats/team-games) are loaded when the tab opens, since
 * the ratings and ranks compare the team to the league. The season stats card only needs the team stats the page
 * already has, so it's shown while they load and when they fail.
 */
@Component({
    selector: 'app-team-stats-tab',
    templateUrl: './team-stats-tab.component.html',
    styleUrls: ['./team-stats-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamStatsTabComponent implements OnChanges {

  @Input()
  public teamId: number;

  /** The standings' season, like 20262027. Undefined until the standings load. */
  @Input()
  public season: number;

  /** Every team's season stats, for the season stats card. */
  @Input()
  public teamStats: TeamSeasonStats[] = [];

  /** Every team's games of the season. */
  public games: TeamGameStats[] = [];

  /** Every team's rating of the season, best first. */
  public ratings: TeamRating[] = [];

  /** The team's rating after each of its games. */
  public timeline: TeamRatingPoint[] = [];

  /** Every team's 5v5 xG from Natural Stat Trick, empty until it loads or when it fails. */
  public nstTeams: NstTeamSeasonStats[] = [];

  public isLoading: boolean = false;

  public hasError: boolean = false;

  /** The season of the games loaded or loading, so a late response for another season is dropped. */
  private gamesSeason: number;

  /** The team, as the chart's list of teams. Kept as one array, so the chart only redraws when the team changes. */
  public teamIds: number[] = [];

  /** Whether the team has played, so there's something to rate. */
  public get hasRating(): boolean {
    return this.ratings.some(rating => rating.teamId === this.teamId);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes["teamId"]) {
      this.teamIds = [this.teamId];
    }
    if (changes["season"] && this.season && this.season !== this.gamesSeason) {
      this.retrieveTeamGames(this.season);
    } else if (changes["teamId"]) {
      this.buildRatings();
    }
  }

  /**
   * Loads every team's 5v5 xG from Natural Stat Trick, for the advanced stats card's xGF% row. The row is optional: it's
   * left out while it loads and when NST can't be asked.
   */
  private retrieveNstTeams(season: number): void {
    this.nstTeams = [];
    this.naturalStatTrickService.getTeamStats(season).then(teams => {
      if (season === this.gamesSeason) {
        this.nstTeams = teams;
      }
    }).catch(() => {
      // The service logs the error. The card shows its other stats
    });
  }

  private retrieveTeamGames(season: number): void {
    this.gamesSeason = season;
    this.retrieveNstTeams(season);
    this.isLoading = true;
    this.hasError = false;
    this.games = [];
    this.buildRatings();
    this.nhlStatsApiService.getTeamGames(season).then(games => {
      if (season !== this.gamesSeason) {
        return;
      }
      this.games = games;
      this.isLoading = false;
      this.buildRatings();
    }).catch(() => {
      // The service logs the error. The season stats card still shows
      if (season !== this.gamesSeason) {
        return;
      }
      this.games = [];
      this.isLoading = false;
      this.hasError = true;
      this.buildRatings();
    });
  }

  private buildRatings(): void {
    this.ratings = TeamRatingUtils.getLeagueRatings(this.games);
    this.timeline = TeamRatingUtils.getTimeline(this.games, this.teamIds).get(this.teamId) ?? [];
  }

  constructor(private nhlStatsApiService: NhlStatsApiService,
              private naturalStatTrickService: NaturalStatTrickService) {}
}
