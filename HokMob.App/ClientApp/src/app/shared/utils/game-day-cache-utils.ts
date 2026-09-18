import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import {ScoreGame} from "@shared/models/nhl-web-api/score.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {CurrentSeason} from "@shared/models/nhl-stats-api/season-dates.model";
import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";

dayjs.extend(utc);
dayjs.extend(timezone);

export class GameDayCacheUtils {

  /** How long a future day is cached: schedules and start times change rarely. */
  public static readonly futureDayCacheDurationMs = 30 * 60 * 1000;

  /** A past game day settles at 1pm Eastern the day after it's played, leaving time for postgame updates (stats
   *  corrections, highlight clips, three stars). */
  private static readonly settledCutoffHourEastern = 13;

  private static readonly easternTimeZone = "America/New_York";

  /**
   * How long a home page scoreboard day's games can be cached on the client, mirroring the backend's
   * NhlApiClient score/{date} rules: a settled regular season day of the current season is cached until the
   * season changes ('forever'), a future day gets a moderate TTL (a number of milliseconds), and everything else
   * (today, live games, a not-yet-settled past day, or a preseason/playoff/earlier-season day) is never cached
   * (undefined), so it's always refetched.
   *
   * @param date - The day the games are for.
   * @param games - The day's games, as returned by score/{date}.
   * @param currentSeason - The current season, or undefined when it couldn't be worked out (nothing is cached then).
   * @param now - The current time, for tests.
   */
  public static getCacheDuration(date: Date, games: ScoreGame[], currentSeason: CurrentSeason | undefined,
                                 now: Date = new Date()): 'forever' | number | undefined {
    if (games.some(game => NhlGameInfoUtils.isLiveGame(game.gameState))) {
      // A live game, whatever the day: the calendar date alone doesn't rule this out for a future-dated day.
      return undefined;
    }

    const day = dayjs(date).startOf('day');
    const today = dayjs(now).startOf('day');

    if (day.isAfter(today, 'day')) {
      return this.futureDayCacheDurationMs;
    }
    if (!day.isBefore(today, 'day')) {
      // Today: the scoreboard refreshes it every 10 seconds while it's shown, so it's never cached.
      return undefined;
    }
    if (!currentSeason || games.length === 0 || !this.isSettled(date, now)) {
      return undefined;
    }

    const isCurrentSeasonRegularDay = games.every(game =>
      game.gameType === NhlGameTypeEnum.REGULAR_SEASON && game.season === currentSeason.season);
    return isCurrentSeasonRegularDay ? 'forever' : undefined;
  }

  /**
   * Whether a past day has settled: the current time is on or after 1pm Eastern the day after it was played.
   * Builds the cutoff from a single "date time" string parsed straight into the zone, instead of parsing the date
   * and then calling .hour()/.add() on the result: those mutate the wall-clock fields without re-deriving the
   * zone's UTC offset for the new day, which is wrong across a DST change.
   */
  private static isSettled(date: Date, now: Date): boolean {
    const nextDay = dayjs(date).add(1, 'day').format('YYYY-MM-DD');
    const settledAt = dayjs.tz(`${nextDay} ${this.settledCutoffHourEastern}:00`, this.easternTimeZone);
    return !dayjs(now).isBefore(settledAt);
  }
}
