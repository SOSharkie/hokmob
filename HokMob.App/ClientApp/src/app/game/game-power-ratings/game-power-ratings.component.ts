import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NaturalStatTrickService} from "@shared/services/natural-stat-trick.service";
import {NstTeamGameStats} from "@shared/models/natural-stat-trick/nst-team-games.model";
import {TeamRating, TeamRatingPoint, TeamRatingUtils} from "@shared/utils/team-rating-utils";

/**
 * A future game's power rating cards, the home team's then the away team's, side by side when they fit. Rates the
 * league on the game's regular season, like the team page's team stats tab: every team's games
 * (/api/nhl-stats/team-games) with Natural Stat Trick's expected goals (/api/nst/team-games), which are optional, so
 * without them the rating falls back to the NHL's stats. Nothing shows until both teams have played a regular season
 * game, or when the games can't be loaded. A playoff game shows the regular season's ratings.
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

  /** Every team's rating of the season, best first. Empty until the games load. */
  public ratings: TeamRating[] = [];

  /** Each team's rating after each of its games, for its recent change. */
  public homeTimeline: TeamRatingPoint[] = [];

  public awayTimeline: TeamRatingPoint[] = [];

  /** The season and teams of the games loaded or loading, so a late response for another game is dropped. */
  private loadKey: string;

  /** Whether both teams are rated, so both cards show. */
  public get hasRatings(): boolean {
    return [this.homeTeamId, this.awayTeamId].every(teamId => this.ratings.some(rating => rating.teamId === teamId));
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
    if (this.season && this.homeTeamId && this.awayTeamId) {
      this.retrieveRatings(key);
    }
  }

  /**
   * Loads every team's games and their expected goals at once, and rates the league when both are back.
   */
  private retrieveRatings(key: string): void {
    const season = this.season;
    // The service logs the error. Without NST's expected goals the rating falls back to the NHL's stats
    const expectedGoals = this.naturalStatTrickService.getTeamGames(season).catch(() => [] as NstTeamGameStats[]);
    Promise.all([this.nhlStatsApiService.getTeamGames(season), expectedGoals]).then(([games, nstGames]) => {
      if (key !== this.loadKey) {
        return;
      }
      const ratedGames = TeamRatingUtils.withExpectedGoals(games, nstGames);
      const timelines = TeamRatingUtils.getTimeline(ratedGames, [this.homeTeamId, this.awayTeamId]);
      this.ratings = TeamRatingUtils.getLeagueRatings(ratedGames);
      this.homeTimeline = timelines.get(this.homeTeamId) ?? [];
      this.awayTimeline = timelines.get(this.awayTeamId) ?? [];
    }).catch(() => {
      // The service logs the error. The cards stay hidden
    });
  }

  constructor(private nhlStatsApiService: NhlStatsApiService,
              private naturalStatTrickService: NaturalStatTrickService) {}
}
