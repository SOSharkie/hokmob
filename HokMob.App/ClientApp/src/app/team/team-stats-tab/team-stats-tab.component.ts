import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NaturalStatTrickService} from "@shared/services/natural-stat-trick.service";
import {NstTeamGameStats} from "@shared/models/natural-stat-trick/nst-team-games.model";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {TeamRating, TeamRatingPoint, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {SkeletonCardLayout} from "@shared/components/skeleton-card/skeleton-card.component";

/**
 * The team page's team stats tab: the power rating, the season stats and the advanced stats cards, and the power rating
 * chart below them. Every team's games of the season (/api/nhl-stats/team-games) and their expected goals from Natural
 * Stat Trick (/api/nst/team-games) are loaded when the tab opens, since the ratings and ranks compare the team to the
 * league. The expected goals are optional: without them the rating falls back to the NHL's stats. The season stats
 * card only needs the team stats the page already has, so it's shown while they load and when they fail.
 *
 * Each card shows its skeleton at its size until its data is in (see SkeletonCardComponent): the season stats until the
 * page's team stats load, and the power rating, the advanced stats and the chart until the season's games do, so
 * nothing moves when they come.
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

  /** Whether the page's team stats are still loading, so the season stats card shows its skeleton. */
  @Input()
  public teamStatsLoading: boolean = false;

  /**
   * The chart's skeleton: its title, a row of its 10 toggles (the 9 lines and the window), and the plot. On a phone the
   * toggles wrap to three rows and the plot is shorter. The chart draws on its canvas once, so its skeleton is shown
   * here in its place rather than inside it.
   */
  public readonly chartSkeletonLayout: SkeletonCardLayout = {
    rows: 1, rowHeight: 351, columns: 10, tableHeaderHeight: 36, paddingBottom: 39
  };

  public readonly chartSkeletonMobileLayout: SkeletonCardLayout = {rowHeight: 261, tableHeaderHeight: 174};

  /** Every team's season stats, for the season stats card. */
  @Input()
  public teamStats: TeamSeasonStats[] = [];

  /** Every team's games of the season, with NST's expected goals when it answered. */
  public games: TeamGameStats[] = [];

  /** Every team's rating of the season, best first. */
  public ratings: TeamRating[] = [];

  /** The team's rating after each of its games. */
  public timeline: TeamRatingPoint[] = [];

  public isLoading: boolean = false;

  public hasError: boolean = false;

  /** The season of the games loaded or loading, so a late response for another season is dropped. */
  private gamesSeason: number;

  /** The team, as the chart's list of teams. Kept as one array, so the chart only redraws when the team changes. */
  public teamIds: number[] = [];

  /**
   * Whether the season's games are still loading, or haven't started because the season isn't known yet, so the
   * power rating, advanced stats and chart show their skeletons.
   */
  public get ratingLoading(): boolean {
    return this.isLoading || !this.gamesSeason;
  }

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
   * Loads every team's games and their expected goals at once, and rates the league when both are back, so the rating
   * doesn't change under the reader when the expected goals come in.
   */
  private retrieveTeamGames(season: number): void {
    this.gamesSeason = season;
    this.isLoading = true;
    this.hasError = false;
    this.games = [];
    this.buildRatings();
    // The service logs the error. Without NST's expected goals the rating falls back to the NHL's stats
    const expectedGoals = this.naturalStatTrickService.getTeamGames(season).catch(() => [] as NstTeamGameStats[]);
    Promise.all([this.nhlStatsApiService.getTeamGames(season), expectedGoals]).then(([games, nstGames]) => {
      if (season !== this.gamesSeason) {
        return;
      }
      this.games = TeamRatingUtils.withExpectedGoals(games, nstGames);
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
