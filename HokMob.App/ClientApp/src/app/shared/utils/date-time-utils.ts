import * as dayjs from "dayjs";

export class DateTimeUtils {

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
}
