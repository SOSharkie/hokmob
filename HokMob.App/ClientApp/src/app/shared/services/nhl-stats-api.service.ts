import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {TeamSeasonStats, TeamStatsResponse} from "@shared/models/nhl-stats-api/team-stats.model";
import {PlayerStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {HitsAndShotsLeaders} from "@shared/models/nhl-stats-api/leaders.model";
import {CurrentSeason, SeasonDates, SeasonDatesResponse} from "@shared/models/nhl-stats-api/season-dates.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";

/**
 * The stats the NHL web API doesn't have, from the NHL stats API through the backend (/api/nhl-stats/*). The backend
 * builds every stats API query and merges its reports, so each method here is one request.
 */
@Injectable()
export class NhlStatsApiService {

  private readonly nhlTeamStatsUrl = "/api/nhl-stats/teams";

  private readonly nhlPlayerStatsUrl = "/api/nhl-stats/player/";

  private readonly nhlLeadersUrl = "/api/nhl-stats/leaders";

  private readonly nhlSeasonsUrl = "/api/nhl-stats/seasons";

  /** How long the season dates are reused before they're asked for again: 1 hour. */
  private readonly seasonDatesMaxAge = 60 * 60 * 1000;

  /** The season dates request, shared by every caller until it's older than seasonDatesMaxAge. */
  private seasonDates: Promise<SeasonDates[]>;

  private seasonDatesRequestedAt: number;

  constructor(private http: HttpClient) { }

  /**
   * Gets a player's NHL stats by season and for their last 10 games. The backend merges the stats API reports, so
   * this is one request whose rows hold hits and blocks for a skater, and saves by strength for a goalie. A player
   * without NHL games resolves empty lists.
   *
   * @param playerId - The player ID.
   * @param isGoalie - Whether the player is a goalie (the landing's position is "G"), which decides the reports the
   *   backend reads.
   */
  public getPlayerStats(playerId: number, isGoalie: boolean = false): Promise<PlayerStats> {
    const url = this.nhlPlayerStatsUrl + playerId + "?position=" + (isGoalie ? "goalie" : "skater");
    return new Promise((resolve, reject) => {
      return this.http.get<PlayerStats>(url).subscribe({
        next: (response) => {
          resolve({
            regularSeasons: response?.regularSeasons ?? [],
            playoffSeasons: response?.playoffSeasons ?? [],
            recentGames: response?.recentGames ?? []
          });
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets a season's hits and shots leaders, best first. The NHL web API has no hits or shots category, so these two
   * leaderboards come from the stats API while the others come from NhlLeadersService. A season without games
   * played resolves empty lists.
   *
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season (the default), 3 for the playoffs.
   * @param limit - The number of leaders per category.
   */
  public getHitsAndShotsLeaders(season: number | string, gameType: number = 2,
                                limit: number = 5): Promise<HitsAndShotsLeaders> {
    const url = this.nhlLeadersUrl + "?season=" + season + "&gameType=" + gameType + "&limit=" + limit;
    return new Promise((resolve, reject) => {
      return this.http.get<HitsAndShotsLeaders>(url).subscribe({
        next: (response) => {
          resolve({hits: response?.hits ?? [], shots: response?.shots ?? []});
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets every team's stats for a season (power play, penalty kill, goals and shots per game, faceoffs). All teams
   * come back, so a team page works out league ranks itself and every team page shares one cached response. A season
   * with no games played yet resolves an empty list.
   *
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season (the default), 3 for the playoffs.
   */
  public getTeamStats(season: number | string, gameType: number = 2): Promise<TeamSeasonStats[]> {
    const url = this.nhlTeamStatsUrl + "?season=" + season + "&gameType=" + gameType;
    return new Promise((resolve, reject) => {
      return this.http.get<TeamStatsResponse>(url).subscribe({
        next: (response) => {
          resolve(response?.teams ?? []);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets the first game days of the two latest seasons, newest first. One request is shared by every caller for an
   * hour, so a page asking for the current season and playoff mode at once makes one request. A failed request isn't
   * reused.
   */
  public getSeasonDates(): Promise<SeasonDates[]> {
    if (this.seasonDates && Date.now() - this.seasonDatesRequestedAt < this.seasonDatesMaxAge) {
      return this.seasonDates;
    }
    this.seasonDatesRequestedAt = Date.now();
    const request = new Promise<SeasonDates[]>((resolve, reject) => {
      return this.http.get<SeasonDatesResponse>(this.nhlSeasonsUrl).subscribe({
        next: (response) => {
          resolve(response?.seasons ?? []);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
    this.seasonDates = request;
    request.catch(() => {
      if (this.seasonDates === request) {
        this.seasonDates = undefined;
      }
    });
    return request;
  }

  /**
   * Gets the current season and whether the site is in playoff mode, worked out from the season dates for today (see
   * DateTimeUtils.getCurrentNhlSeason and isPlayoffMode). Rejects when the dates fail to load or no season is listed.
   */
  public getCurrentSeason(): Promise<CurrentSeason> {
    return this.getSeasonDates().then(seasons => {
      const today = new Date();
      const currentSeason = DateTimeUtils.getCurrentNhlSeason(seasons, today);
      if (!currentSeason) {
        throw new Error("No NHL season is listed");
      }
      return {season: currentSeason.id, isPlayoffMode: DateTimeUtils.isPlayoffMode(seasons, today)};
    });
  }
}
