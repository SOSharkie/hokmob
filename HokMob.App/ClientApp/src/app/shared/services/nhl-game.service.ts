import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as dayjs from 'dayjs'
import {ScoreGame, ScoreResponse} from "@shared/models/nhl-web-api/score.model";
import {GameBundle} from "@shared/models/nhl-web-api/game-bundle.model";
import {GameLanding} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {PlayByPlay} from "@shared/models/nhl-web-api/play-by-play.model";
import {Boxscore} from "@shared/models/nhl-web-api/boxscore.model";
import {RightRail} from "@shared/models/nhl-web-api/right-rail.model";
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";
import {
  ClubScheduleGame,
  ClubScheduleSeason,
  TeamFormReference
} from "@shared/models/nhl-web-api/club-schedule.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {GameDayCacheUtils} from "@shared/utils/game-day-cache-utils";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {CurrentSeason} from "@shared/models/nhl-stats-api/season-dates.model";

interface CachedGameDay {
  games: ScoreGame[];
  /** When the entry expires, or undefined when it's kept until the season changes. */
  expiresAt?: number;
}

@Injectable()
export class NhlGameService {

  // Proxied through the HokMob backend (NhlController) to avoid CORS
  private readonly nhlScoreUrl = "/api/nhl/score/";

  private readonly nhlGamecenterUrl = "/api/nhl/gamecenter/";

  private readonly nhlPlayerUrl = "/api/nhl/player/";

  private readonly nhlClubScheduleSeasonUrl = "/api/nhl/club-schedule-season/";

  private readonly teamFormGameCount = 5;

  /** Cached score/{date} days, by date key (see getNhlGames), following GameDayCacheUtils' rules. */
  private readonly gameDayCache = new Map<string, CachedGameDay>();

  /** The season the cache was last built for. Games are cleared when this changes. */
  private cachedSeason: number;

  constructor(private http: HttpClient, private nhlStatsApiService: NhlStatsApiService) { }

  /**
   *  Gets all NHL games for a given date. Uses an explicit date because score/now jumps ahead to the next game day.
   *  Settled days of the current regular season, and future days, are served from a client-side cache once seen
   *  (see GameDayCacheUtils); every other day is always fetched.
   *
   * @param date - The date to get NHL games for.
   */
  public getNhlGames(date: Date): Promise<ScoreGame[]> {
    const dateKey = this.formatDateStringForNhl(date);
    const cached = this.getCachedGameDay(dateKey);
    if (cached) {
      return Promise.resolve([...cached]);
    }

    return new Promise((resolve, reject) => {
      return this.http.get<ScoreResponse>(this.nhlScoreUrl + dateKey).subscribe({
        next: (response) => {
          const games = response.games ?? [];
          resolve(games);
          this.cacheGameDay(date, dateKey, games);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets all gamecenter data for a game: landing, play-by-play, boxscore and right-rail, requested in parallel. The
   * landing is required, so the promise rejects when it fails. The other responses resolve as undefined when their
   * request fails, so the game header can still be shown.
   *
   * @param gameId - The game ID, like "2025021057".
   */
  public getGameBundle(gameId: string): Promise<GameBundle> {
    const gameUrl = this.nhlGamecenterUrl + gameId;
    const optional = <T>(request: Promise<T>): Promise<T> => request.catch(() => undefined);
    return Promise.all([
      this.get<GameLanding>(gameUrl + "/landing"),
      optional(this.get<PlayByPlay>(gameUrl + "/play-by-play")),
      optional(this.get<Boxscore>(gameUrl + "/boxscore")),
      optional(this.get<RightRail>(gameUrl + "/right-rail"))
    ]).then(([landing, playByPlay, boxscore, rightRail]) => ({landing, playByPlay, boxscore, rightRail}));
  }

  /**
   * Gets a game from score/{gameDate}, for what no gamecenter response has: the playoff series status and the recap and
   * condensed game video paths. Resolves undefined when the game isn't in the response.
   *
   * @param gameId - The game ID.
   * @param gameDate - The game's local date, like "2026-06-09" (landing.gameDate).
   */
  public getScoreGame(gameId: number, gameDate: string): Promise<ScoreGame> {
    return this.get<ScoreResponse>(this.nhlScoreUrl + gameDate)
        .then(response => (response.games ?? []).find(game => game.id === gameId));
  }

  /**
   * Gets a player's bio (country, birth date, headshot, draft, current team, ...) from player/{id}/landing, for the
   * player page header and bio and the player game dialog. The stats themselves come from the stats API
   * (NhlStatsApiService.getPlayerStats).
   *
   * @param playerId - The player ID.
   */
  public getPlayerLanding(playerId: number): Promise<PlayerLanding> {
    return this.get<PlayerLanding>(this.nhlPlayerUrl + playerId + "/landing");
  }

  /**
   * Gets a team's schedule for the current season from club-schedule-season/{abbrev}/now, which between seasons is
   * the season about to start. One response holds the team page's form, schedule and next game.
   *
   * @param teamAbbrev - The team abbreviation, like "BOS".
   */
  public getTeamSchedule(teamAbbrev: string): Promise<ClubScheduleSeason> {
    return this.get<ClubScheduleSeason>(this.nhlClubScheduleSeasonUrl + teamAbbrev + "/now");
  }

  /**
   * Gets a team's last 5 finished games before a game or a point in time, most recent first, for the team form (see
   * NhlGameInfoUtils.getTeamFormGames). Loads club-schedule-season/{abbrev}/{season} for the reference's season,
   * unless that schedule is passed in. When that season has fewer than 5 finished games, like before the preseason,
   * the previous season fills in. If only the previous season fails, the games found so far are returned.
   *
   * @param teamAbbrev - The team abbreviation, like "BOS".
   * @param reference - The game the form is shown for (its landing), or a team page's season and time.
   * @param schedule - The reference season's schedule, when the caller has already loaded it.
   */
  public getTeamFormGames(teamAbbrev: string, reference: TeamFormReference,
                          schedule?: ClubScheduleSeason): Promise<ClubScheduleGame[]> {
    const teamUrl = this.nhlClubScheduleSeasonUrl + teamAbbrev + "/";
    const season = schedule ? Promise.resolve(schedule) : this.get<ClubScheduleSeason>(teamUrl + reference.season);
    return season.then(seasonSchedule => {
      const games = NhlGameInfoUtils.getTeamFormGames(seasonSchedule.games, reference, this.teamFormGameCount);
      if (games.length >= this.teamFormGameCount || !seasonSchedule.previousSeason) {
        return games;
      }
      return this.get<ClubScheduleSeason>(teamUrl + seasonSchedule.previousSeason)
          .then(previous => NhlGameInfoUtils.getTeamFormGames([...(previous.games ?? []), ...games], reference,
              this.teamFormGameCount))
          .catch(() => games);
    });
  }

  /**
   * Gets a response through the backend proxy, logging and rejecting on error.
   */
  private get<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      return this.http.get<T>(url).subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  private formatDateStringForNhl(date: Date): string {
    return dayjs(date).format("YYYY-MM-DD");
  }

  /**
   * Returns a day's cached games, or undefined when it isn't cached or its TTL has passed (in which case it's
   * dropped from the cache).
   */
  private getCachedGameDay(dateKey: string): ScoreGame[] | undefined {
    const entry = this.gameDayCache.get(dateKey);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.gameDayCache.delete(dateKey);
      return undefined;
    }
    return entry.games;
  }

  /**
   * Classifies a fetched day with GameDayCacheUtils and stores it when it's cacheable. Needs the current season, so
   * this runs after the games are already resolved to the caller and never delays that response. Clears the whole
   * cache first when the season has changed since the last entry was cached.
   */
  private cacheGameDay(date: Date, dateKey: string, games: ScoreGame[]): void {
    this.nhlStatsApiService.getCurrentSeason().then((currentSeason: CurrentSeason) => {
      if (this.cachedSeason !== undefined && this.cachedSeason !== currentSeason.season) {
        this.gameDayCache.clear();
      }
      this.cachedSeason = currentSeason.season;

      const duration = GameDayCacheUtils.getCacheDuration(date, games, currentSeason);
      if (duration === undefined) {
        return;
      }
      this.gameDayCache.set(dateKey, {
        games,
        expiresAt: duration === 'forever' ? undefined : Date.now() + duration
      });
    }).catch(() => {
      // Can't tell which season this day belongs to; leave it uncached rather than risk caching it wrongly.
    });
  }
}
