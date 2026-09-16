import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {HttpParams} from "@angular/common/http";
import * as dayjs from 'dayjs'
import {NhlScheduleModel} from "@shared/models/nhl-schedule/nhl-schedule.model";
import {ScoreGame, ScoreResponse} from "@shared/models/nhl-web-api/score.model";
import {NhlGameModel} from "@shared/models/nhl-schedule/nhl-game.model";
import {NhlLiveFeedModel} from "@shared/models/nhl-live-feed/nhl-live-feed.model";
import {GameBundle} from "@shared/models/nhl-web-api/game-bundle.model";
import {GameLanding} from "@shared/models/nhl-web-api/gamecenter-landing.model";
import {PlayByPlay} from "@shared/models/nhl-web-api/play-by-play.model";
import {Boxscore} from "@shared/models/nhl-web-api/boxscore.model";
import {RightRail} from "@shared/models/nhl-web-api/right-rail.model";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {PlayerLanding} from "@shared/models/nhl-web-api/player-landing.model";
import {
  ClubScheduleGame,
  ClubScheduleSeason,
  TeamFormReference
} from "@shared/models/nhl-web-api/club-schedule.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";

@Injectable()
export class NhlGameService {

  private readonly nhlScheduleUrl = "https://statsapi.web.nhl.com/api/v1/schedule";

  private readonly nhlGameUrl = "https://statsapi.web.nhl.com/api/v1/game/"

  private readonly nhlLiveFeed = "/feed/live";

  private readonly scheduleDetails = "linescore,broadcasts(all),game(seriesSummary),seriesSummary(series)"

  // Proxied through the HokMob backend (NhlController) to avoid CORS
  private readonly nhlScoreUrl = "/api/nhl/score/";

  private readonly nhlGamecenterUrl = "/api/nhl/gamecenter/";

  private readonly nhlPlayerUrl = "/api/nhl/player/";

  private readonly nhlClubScheduleSeasonUrl = "/api/nhl/club-schedule-season/";

  private readonly teamFormGameCount = 5;

  constructor(private http: HttpClient) { }

  /**
   *  Gets all NHL games for a given date. Uses an explicit date because score/now jumps ahead to the next game day.
   *
   * @param date - The date to get NHL games for.
   */
  public getNhlGames(date: Date): Promise<ScoreGame[]> {
    return new Promise((resolve, reject) => {
      return this.http.get<ScoreResponse>(this.nhlScoreUrl + this.formatDateStringForNhl(date)).subscribe({
        next: (response) => {
          resolve(response.games ?? []);
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
   * Gets the playoff series status of a game from score/{gameDate}, since no gamecenter response has it. Resolves
   * undefined when the game isn't in the response or has no series status.
   *
   * @param gameId - The game ID.
   * @param gameDate - The game's local date, like "2026-06-09" (landing.gameDate).
   */
  public getSeriesStatus(gameId: number, gameDate: string): Promise<SeriesStatus> {
    return this.get<ScoreResponse>(this.nhlScoreUrl + gameDate)
        .then(response => (response.games ?? []).find(game => game.id === gameId)?.seriesStatus);
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

  // The methods below call the dead stats API. They're only kept for the unmigrated team and player pages
  // (see docs/nhl-api-migration-plan.md).

  /**
   *  Gets all nhl game models for a given team.
   *
   * @param startDate - The start date to look for.
   * @param endDate - The end date to look for.
   * @param teamId - The team ID to get NHL game models for.
   */
  public getTeamGames(startDate: Date, endDate: Date, teamId?: number): Promise<NhlScheduleModel> {
    const options = {
      params: new HttpParams().set("startDate", this.formatDateStringForNhl(startDate))
          .set("endDate", this.formatDateStringForNhl(endDate))
          .set("teamId", teamId)
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe({
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

  /**
   * Gets the nhl game for a given game ID (gamePk for NHL API).
   *
   * @param gameId - The ID of the game to get the NHL game model for.
   */
  public getNhlGame(gameId: string): Promise<NhlGameModel> {
    const options = {
      params: new HttpParams().set("gamePk", gameId).set("hydrate", this.scheduleDetails)
    };

    return new Promise((resolve, reject) => {
      return this.http.get<NhlScheduleModel>(this.nhlScheduleUrl, options).subscribe({
        next: (response) => {
          let game: NhlGameModel = response.dates[0].games.find(game => game.gamePk === Number(gameId));
          resolve(game);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Gets the NHL game live feed for a given game ID.
   *
   * @param gameId - The ID of the game to get the live feed.
   */
  public getNhlGameLiveFeed(gameId: string): Promise<NhlLiveFeedModel> {
    let gameUrl = this.nhlGameUrl + gameId + this.nhlLiveFeed;

    return new Promise((resolve, reject) => {
      return this.http.get<NhlLiveFeedModel>(gameUrl).subscribe({
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
}
