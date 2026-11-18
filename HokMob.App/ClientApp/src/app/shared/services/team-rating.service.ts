import {Injectable} from '@angular/core';
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {NaturalStatTrickService} from "@shared/services/natural-stat-trick.service";
import {NstTeamGameStats} from "@shared/models/natural-stat-trick/nst-team-games.model";
import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {TeamRatingUtils} from "@shared/utils/team-rating-utils";

/**
 * Every team's regular season games for the power rating, with Natural Stat Trick's expected goals, shared by the pages
 * that rate the league (the team page's overview and team stats tab, and a future game's page). Each season's games
 * are kept for a few minutes, so moving between them doesn't load the season again, while a season in progress still
 * picks up new games.
 */
@Injectable()
export class TeamRatingService {

  /** How long a season's games are kept, in ms. */
  public static readonly cacheTime = 5 * 60 * 1000;

  private readonly ratedGames = new Map<number, {loadedAt: number, games: Promise<TeamGameStats[]>}>();

  constructor(private nhlStatsApiService: NhlStatsApiService,
              private naturalStatTrickService: NaturalStatTrickService) {}

  /**
   * Gets every team's regular season games with their expected goals, loading the games and the expected goals at once,
   * so the rating doesn't change under the reader when the expected goals come in. The expected goals are optional:
   * without them the games come back without, and the rating falls back to the NHL's stats. Rejects when the games
   * can't be loaded, and the next call tries again.
   *
   * @param season - The season ID, like 20262027.
   */
  public getRatedGames(season: number): Promise<TeamGameStats[]> {
    const cached = this.ratedGames.get(season);
    if (cached && Date.now() - cached.loadedAt < TeamRatingService.cacheTime) {
      return cached.games;
    }
    // The services log their errors
    const expectedGoals = this.naturalStatTrickService.getTeamGames(season).catch(() => [] as NstTeamGameStats[]);
    const games = Promise.all([this.nhlStatsApiService.getTeamGames(season), expectedGoals])
        .then(([teamGames, nstGames]) => TeamRatingUtils.withExpectedGoals(teamGames, nstGames));
    this.ratedGames.set(season, {loadedAt: Date.now(), games});
    games.catch(() => {
      if (this.ratedGames.get(season)?.games === games) {
        this.ratedGames.delete(season);
      }
    });
    return games;
  }
}
