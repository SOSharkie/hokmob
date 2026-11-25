import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {TeamSeasonStats, TeamStatsResponse} from "@shared/models/nhl-stats-api/team-stats.model";
import {TeamGameStats, TeamGamesResponse} from "@shared/models/nhl-stats-api/team-games.model";
import {GoalieSeasonStats, PlayerStats, SkaterSeasonStats} from "@shared/models/nhl-stats-api/player-stats.model";
import {SeasonPlayersResponse} from "@shared/models/nhl-stats-api/season-players.model";
import {TeamPlayersResponse} from "@shared/models/nhl-stats-api/team-players.model";
import {HitsAndShotsLeaders} from "@shared/models/nhl-stats-api/leaders.model";
import {CurrentSeason, SeasonDates, SeasonDatesResponse} from "@shared/models/nhl-stats-api/season-dates.model";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {DraftPlayerStats, DraftStatsResponse} from "@shared/models/nhl-stats-api/draft-stats.model";
import {
  LeagueGoalieStats,
  LeaguePlayers,
  LeaguePlayersResponse,
  LeagueSkaterStats
} from "@shared/models/nhl-stats-api/league-players.model";

/**
 * The stats the NHL web API doesn't have, from the NHL stats API through the backend (/api/nhl-stats/*). The backend
 * builds every stats API query and merges its reports, so each method here is one request.
 */
@Injectable()
export class NhlStatsApiService {

  private readonly nhlTeamStatsUrl = "/api/nhl-stats/teams";

  private readonly nhlTeamGamesUrl = "/api/nhl-stats/team-games";

  private readonly nhlPlayerStatsUrl = "/api/nhl-stats/player/";

  private readonly nhlLeadersUrl = "/api/nhl-stats/leaders";

  private readonly nhlSeasonPlayersUrl = "/api/nhl-stats/season-players";

  private readonly nhlTeamPlayersUrl = "/api/nhl-stats/team-players";

  private readonly nhlSeasonsUrl = "/api/nhl-stats/seasons";

  private readonly nhlDraftStatsUrl = "/api/nhl-stats/draft";

  private readonly nhlLeaguePlayersUrl = "/api/nhl-stats/league-players";

  /** How long a season's league players are reused before they're asked for again: 5 minutes, like the backend. */
  public static readonly leaguePlayersMaxAge = 5 * 60 * 1000;

  /** The league players requests by season, game type and position, until they're older than leaguePlayersMaxAge. */
  private readonly leaguePlayers = new Map<string, {requestedAt: number, players: Promise<LeaguePlayers>}>();

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
   * Gets the season stats of some players, like the stats page's top 25 of a category, for the columns their
   * leaderboard has no values for. The rows come in no particular order, and a player without games that season has
   * none. No player IDs resolves an empty list without a request.
   *
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season, 3 for the playoffs.
   * @param isGoalie - Whether the players are goalies, which decides the reports the backend reads.
   * @param playerIds - The player IDs, at most 25 of them.
   */
  public getSeasonPlayerStats(season: number | string, gameType: number, isGoalie: boolean,
                              playerIds: number[]): Promise<SkaterSeasonStats[] | GoalieSeasonStats[]> {
    if (!playerIds?.length) {
      return Promise.resolve([]);
    }
    const url = this.nhlSeasonPlayersUrl + "?season=" + season + "&gameType=" + gameType + "&position=" +
        (isGoalie ? "goalie" : "skater") + "&ids=" + playerIds.join(",");
    return new Promise((resolve, reject) => {
      return this.http.get<SeasonPlayersResponse>(url).subscribe({
        next: (response) => {
          resolve(response?.players ?? []);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets a team's skater and goalie stats for one season, for the team page's player stats tab. Only a traded
   * player's games for this team count. A season the team hasn't played yet resolves empty lists.
   *
   * @param teamId - The NHL team ID, like 28.
   * @param season - The season ID, like 20252026.
   * @param gameType - 2 for the regular season (the default), 3 for the playoffs.
   */
  public getTeamPlayerStats(teamId: number, season: number | string,
                            gameType: number = 2): Promise<TeamPlayersResponse> {
    const url = this.nhlTeamPlayersUrl + "?teamId=" + teamId + "&season=" + season + "&gameType=" + gameType;
    return new Promise((resolve, reject) => {
      return this.http.get<TeamPlayersResponse>(url).subscribe({
        next: (response) => {
          resolve({skaters: response?.skaters ?? [], goalies: response?.goalies ?? []});
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
   * Gets every team's game by game stats for a season, one row per team and game, sorted by date. A season with no
   * games yet resolves an empty list.
   *
   * @param season - The season ID, like 20262027.
   * @param gameType - 2 for the regular season (the default), 3 for the playoffs.
   */
  public getTeamGames(season: number | string, gameType: number = 2): Promise<TeamGameStats[]> {
    const url = this.nhlTeamGamesUrl + "?season=" + season + "&gameType=" + gameType;
    return new Promise((resolve, reject) => {
      return this.http.get<TeamGamesResponse>(url).subscribe({
        next: (response) => {
          resolve(NhlStatsApiService.toRows<TeamGameStats>(response?.games, "gameId"));
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets every player's season row of one position, for percentiles against the league: about 1,000 skaters, or 100
   * goalies, in a full season. A season is kept for leaguePlayersMaxAge, so moving between players doesn't load it
   * again, and a failed request isn't reused. A season with no games yet resolves no players.
   *
   * @param season - The season ID, like 20262027.
   * @param gameType - 2 for the regular season, 3 for the playoffs.
   * @param isGoalie - Whether to get the goalies instead of the skaters.
   */
  public getLeaguePlayers(season: number | string, gameType: number, isGoalie: boolean): Promise<LeaguePlayers> {
    const position = isGoalie ? "goalie" : "skater";
    const key = season + "-" + gameType + "-" + position;
    const cached = this.leaguePlayers.get(key);
    if (cached && Date.now() - cached.requestedAt < NhlStatsApiService.leaguePlayersMaxAge) {
      return cached.players;
    }
    const url = this.nhlLeaguePlayersUrl + "?season=" + season + "&gameType=" + gameType + "&position=" + position;
    const request = new Promise<LeaguePlayers>((resolve, reject) => {
      return this.http.get<LeaguePlayersResponse>(url).subscribe({
        next: (response) => {
          resolve({
            players: NhlStatsApiService.toRows<LeagueSkaterStats | LeagueGoalieStats>(response?.players, "playerId"),
            mostTeamGames: response?.mostTeamGames ?? 0
          });
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
    this.leaguePlayers.set(key, {requestedAt: Date.now(), players: request});
    request.catch(() => {
      if (this.leaguePlayers.get(key)?.players === request) {
        this.leaguePlayers.delete(key);
      }
    });
    return request;
  }

  /**
   * Turns a response's columns of equally long arrays into one object per row.
   *
   * @param columns - The arrays by field.
   * @param countField - A field every row has, whose array's length is the number of rows.
   */
  private static toRows<T>(columns: {[field in keyof T]?: T[field][]}, countField: keyof T): T[] {
    const fields = Object.keys(columns ?? {}) as (keyof T)[];
    const count = columns?.[countField]?.length ?? 0;
    const rows: T[] = [];
    for (let i = 0; i < count; i++) {
      const row = {} as Record<keyof T, unknown>;
      fields.forEach(field => row[field] = columns[field][i]);
      rows.push(row as T);
    }
    return rows;
  }

  /**
   * Gets the regular season career stats of the players drafted in one round, sorted by overall pick. Players who never
   * played an NHL game aren't listed, so a recent round can resolve an empty list.
   *
   * @param year - The draft year, from 2006 on.
   * @param round - The round, 1 to 7.
   */
  public getDraftStats(year: number, round: number): Promise<DraftPlayerStats[]> {
    const url = this.nhlDraftStatsUrl + "?year=" + year + "&round=" + round;
    return new Promise((resolve, reject) => {
      return this.http.get<DraftStatsResponse>(url).subscribe({
        next: (response) => {
          resolve(response?.players ?? []);
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
