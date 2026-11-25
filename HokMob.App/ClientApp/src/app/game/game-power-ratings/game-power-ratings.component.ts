import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {TeamRatingService} from "@shared/services/team-rating.service";
import {TeamSeasonStats} from "@shared/models/nhl-stats-api/team-stats.model";
import {TeamRatingCardView} from "@app/team/team-rating-card/team-rating-card.component";
import {TeamRating, TeamRatingPoint, TeamRatingUtils} from "@shared/utils/team-rating-utils";
import {NstStatsUtils} from "@shared/utils/nst-stats-utils";

/**
 * A future game's team stats card: both teams' power ratings in one card, the home team's then the away team's, side
 * by side, compact on a phone, with the league average and Natural Stat Trick's credit noted once under both. One
 * toggle in its header (TeamRatingViewToggleComponent) switches both teams to their season stats and back. Rates the
 * league on the game's regular season, like the team page (TeamRatingService): every team's games
 * (/api/nhl-stats/team-games) with Natural Stat Trick's expected goals (/api/nst/team-games), which are optional, so
 * without them the rating falls back to the NHL's stats. The season stats
 * (/api/nhl-stats/teams) load at the same time, and without them the card has no toggle. Nothing shows until both
 * teams have played a regular season game, or when the games can't be loaded. A playoff game shows the regular season's
 * ratings and stats.
 */
@Component({
    selector: 'app-game-power-ratings',
    templateUrl: './game-power-ratings.component.html',
    styleUrls: ['./game-power-ratings.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GamePowerRatingsComponent implements OnChanges {

  /** The game's season, like 20262027. */
  @Input()
  public season: number;

  @Input()
  public homeTeamId: number;

  @Input()
  public awayTeamId: number;

  /** Every team's season stats, for the card's stats view. Empty until they load, or when they can't be. */
  public teamStats: TeamSeasonStats[] = [];

  /** Whether the season stats are still loading. */
  public statsLoading: boolean = false;

  /** The view picked with the toggle. */
  public view: TeamRatingCardView = "power";

  /** Every team's rating of the season, best first. Empty until the games load. */
  public ratings: TeamRating[] = [];

  /** Each team's rating after each of its games, for its recent change. */
  public homeTimeline: TeamRatingPoint[] = [];

  public awayTimeline: TeamRatingPoint[] = [];

  /** The season and teams of the games loaded or loading, so a late response for another game is dropped. */
  private loadKey: string;

  public readonly nstUrl: string = NstStatsUtils.teamTableUrl;

  /**
   * Whether the ratings count Natural Stat Trick's expected goals, so the note credits it. Every team has them or none
   * does, so the home team's say.
   */
  public get hasExpectedGoals(): boolean {
    return !!this.ratings.find(rating => rating.teamId === this.homeTeamId)?.hasExpectedGoals;
  }

  /** Whether both teams are rated, so the card shows. */
  public get hasRatings(): boolean {
    return [this.homeTeamId, this.awayTeamId].every(teamId => this.ratings.some(rating => rating.teamId === teamId));
  }

  /** Whether the stats have both teams' rows, so the toggle can switch to them. */
  public get hasStats(): boolean {
    return [this.homeTeamId, this.awayTeamId].every(teamId => this.teamStats.some(stats => stats.teamId === teamId));
  }

  /** Whether the season stats are ready to switch to. */
  public get canToggle(): boolean {
    return this.hasStats && !this.statsLoading;
  }

  /** The view shown: the season stats only once they're ready, or else the power ratings. */
  public get shownView(): TeamRatingCardView {
    return this.view === "stats" && this.canToggle ? "stats" : "power";
  }

  /** "Power Rating", or "Team Stats" with the season stats shown. */
  public get title(): string {
    return this.shownView === "stats" ? "Team Stats" : "Power Rating";
  }

  /** The home team then the away team, each with its own timeline. */
  public get teams(): {teamId: number, timeline: TeamRatingPoint[]}[] {
    return [
      {teamId: this.homeTeamId, timeline: this.homeTimeline},
      {teamId: this.awayTeamId, timeline: this.awayTimeline}
    ];
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes["season"] && !changes["homeTeamId"] && !changes["awayTeamId"]) {
      return;
    }
    const key = [this.season, this.homeTeamId, this.awayTeamId].join("-");
    if (key === this.loadKey) {
      return;
    }
    this.loadKey = key;
    this.ratings = [];
    this.homeTimeline = [];
    this.awayTimeline = [];
    this.teamStats = [];
    this.statsLoading = false;
    if (this.season && this.homeTeamId && this.awayTeamId) {
      this.retrieveRatings(key);
      this.retrieveTeamStats(key);
    }
  }

  /**
   * Loads every team's games and their expected goals at once, and rates the league when both are back.
   */
  private retrieveRatings(key: string): void {
    this.teamRatingService.getRatedGames(this.season).then(ratedGames => {
      if (key !== this.loadKey) {
        return;
      }
      const timelines = TeamRatingUtils.getTimeline(ratedGames, [this.homeTeamId, this.awayTeamId]);
      this.ratings = TeamRatingUtils.getLeagueRatings(ratedGames);
      this.homeTimeline = timelines.get(this.homeTeamId) ?? [];
      this.awayTimeline = timelines.get(this.awayTeamId) ?? [];
    }).catch(() => {
      // The service logs the error. The card stays hidden
    });
  }

  /**
   * Loads every team's season stats, for the card's stats view.
   */
  private retrieveTeamStats(key: string): void {
    this.statsLoading = true;
    this.nhlStatsApiService.getTeamStats(this.season).then(teamStats => {
      if (key !== this.loadKey) {
        return;
      }
      this.teamStats = teamStats;
      this.statsLoading = false;
    }).catch(() => {
      // The service logs the error. The card keeps the power ratings, without a toggle
      if (key !== this.loadKey) {
        return;
      }
      this.teamStats = [];
      this.statsLoading = false;
    });
  }

  constructor(private nhlStatsApiService: NhlStatsApiService,
              private teamRatingService: TeamRatingService) {}
}
