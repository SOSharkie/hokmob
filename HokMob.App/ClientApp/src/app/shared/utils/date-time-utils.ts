import * as dayjs from "dayjs";
import {SeasonDates} from "@shared/models/nhl-stats-api/season-dates.model";

export class DateTimeUtils {

  /**
   * Formats a given date with the day of week, day and month, or a contextual day string.
   *
   * @param inputDate - The date to format.
   * @param shortMonth - Whether to abbreviate the month, like "Sunday, Sep 20" instead of "Sunday, September 20". The
   *   short month and day are joined by a non-breaking space, so a narrow label wraps after the day of week instead.
   */
  public static getDayDisplayValue(inputDate: Date, shortMonth: boolean = false): string {
    let today = dayjs();
    let day = dayjs(inputDate);
    if (today.isSame(day, 'day')) {
      return "Today"
    } else if (today.add(1, 'day').isSame(day, 'day')) {
      return "Tomorrow"
    } else if (today.subtract(1, 'day').isSame(day, 'day')) {
      return "Yesterday"
    } else {
      return day.format(shortMonth ? 'dddd, MMM\u00a0D' : 'dddd, MMMM D');
    }
  }

  /**
   * Formats a given date with the day and abbreviated month, or a contextual day string.
   *
   * @param inputDate - The date to format.
   */
  public static getDateDisplayValue(inputDate: Date): string {
    let today = dayjs();
    let day = dayjs(inputDate);
    if (today.isSame(day, 'day')) {
      return "Today"
    } else if (today.add(1, 'day').isSame(day, 'day')) {
      return "Tomorrow"
    } else if (today.subtract(1, 'day').isSame(day, 'day')) {
      return "Yesterday"
    } else {
      return day.format('MMM D');
    }
  }

  /** How many days before a season's first game the season starts. */
  public static readonly seasonStartLeadDays = 14;

  /** How many days before a season's first playoff game playoff mode starts. */
  public static readonly playoffModeLeadDays = 2;

  /**
   * Gets the current NHL season: the newest season whose first game (the first preseason game) is at most 2 weeks
   * away or already played. When no listed season has started, it's the oldest one listed.
   *
   * @param seasons - The latest seasons, newest first (NhlStatsApiService.getSeasonDates).
   * @param today - The day to work it out for.
   */
  public static getCurrentNhlSeason(seasons: SeasonDates[], today: Date = new Date()): SeasonDates {
    const list = seasons ?? [];
    return list.find(season => DateTimeUtils.isOnOrAfterLeadDay(today, season.firstGameDate,
        DateTimeUtils.seasonStartLeadDays)) ?? list[list.length - 1];
  }

  /**
   * Whether the site is in playoff mode: from 2 days before the current season's first playoff game until the next
   * season starts (see getCurrentNhlSeason).
   *
   * @param seasons - The latest seasons, newest first (NhlStatsApiService.getSeasonDates).
   * @param today - The day to work it out for.
   */
  public static isPlayoffMode(seasons: SeasonDates[], today: Date = new Date()): boolean {
    const currentSeason = DateTimeUtils.getCurrentNhlSeason(seasons, today);
    return DateTimeUtils.isOnOrAfterLeadDay(today, currentSeason?.firstPlayoffGameDate,
        DateTimeUtils.playoffModeLeadDays);
  }

  public static getNhlSeasonDisplayValue(season: string): string {
    return season.substring(0, 4) + "-" + season.substring(4);
  }

  /**
   * Whether a day is on or after the day that is some days before a game day, comparing local days. False for a
   * missing game day.
   *
   * @param today - The day to check.
   * @param gameDate - A game day, like "2026-09-19", which parses as local midnight.
   * @param leadDays - How many days before the game day to start.
   */
  private static isOnOrAfterLeadDay(today: Date, gameDate: string, leadDays: number): boolean {
    if (!gameDate) {
      return false;
    }
    const leadDay = dayjs(gameDate).subtract(leadDays, "day");
    return !dayjs(today).startOf("day").isBefore(leadDay);
  }
}
