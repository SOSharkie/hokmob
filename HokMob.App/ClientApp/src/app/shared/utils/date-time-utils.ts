import * as dayjs from "dayjs";

export class DateTimeUtils {

  /**
   * Formats a given date with the day of week, day and month, or a contextual day string.
   *
   * @param inputDate - The date to format.
   */
  public static getDayDisplayValue(inputDate: Date): string {
    let today = dayjs();
    let day = dayjs(inputDate);
    if (today.isSame(day, 'day')) {
      return "Today"
    } else if (today.add(1, 'day').isSame(day, 'day')) {
      return "Tomorrow"
    } else if (today.subtract(1, 'day').isSame(day, 'day')) {
      return "Yesterday"
    } else {
      return day.format('dddd, MMMM D');
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

  /**
   * Gets the current NHL season string, like "20222023". New seasons generally start around Oct 10th.
   */
  public static getCurrentNhlSeason(): string {
    let today = dayjs();
    let currentYear = today.get('year');
    let nextYear = today.add(1, 'year').get('year');
    let prevYear = today.subtract(1, 'year').get('year');
    if (today.month() < 9 || (today.month() === 9 && today.date() < 10)) {
      return prevYear.toString() + currentYear.toString();
    } else {
      return currentYear.toString() + nextYear.toString();
    }
  }
}
