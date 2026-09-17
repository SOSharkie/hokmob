import {DateTimeUtils} from '@shared/utils/date-time-utils';
import {SeasonDates} from '@shared/models/nhl-stats-api/season-dates.model';
import {mockSeasonDates} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('DateTimeUtils', () => {
  let seasons: SeasonDates[];

  beforeEach(() => {
    // 2026-27: first game 2026-09-19, no playoff game yet. 2025-26: first playoff game 2026-04-18
    seasons = mockSeasonDates().seasons;
  });

  /** A local day and time. The month is 1-based. */
  function day(year: number, month: number, date: number, hours: number = 12): Date {
    return new Date(year, month - 1, date, hours);
  }

  describe('getDayDisplayValue', () => {
    it('should show the day of week with the full or short month', () => {
      expect(DateTimeUtils.getDayDisplayValue(day(2030, 9, 22))).toBe('Sunday, September 22');
      expect(DateTimeUtils.getDayDisplayValue(day(2030, 9, 22), true)).toBe('Sunday, Sep\u00a022');
    });

    it('should show contextual names for nearby days', () => {
      const today = new Date();
      expect(DateTimeUtils.getDayDisplayValue(today, true)).toBe('Today');
      expect(DateTimeUtils.getDayDisplayValue(new Date(today.getTime() + 24 * 60 * 60 * 1000))).toBe('Tomorrow');
    });
  });

  describe('getCurrentNhlSeason', () => {
    it('should start the new season 2 weeks before its first game', () => {
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2026, 9, 4, 23)).id).toBe(20252026);
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2026, 9, 5, 0)).id).toBe(20262027);
    });

    it('should be the new season on the day the fixture was captured and after its first game', () => {
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2026, 9, 16)).id).toBe(20262027);
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2027, 2, 1)).id).toBe(20262027);
    });

    it('should be the previous season during its playoffs and summer', () => {
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2026, 4, 18)).id).toBe(20252026);
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2026, 7, 1)).id).toBe(20252026);
    });

    it('should not start a season whose first game is not scheduled yet', () => {
      seasons[0].firstGameDate = null;
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2026, 12, 1)).id).toBe(20252026);
    });

    it('should fall back to the oldest listed season when none has started', () => {
      expect(DateTimeUtils.getCurrentNhlSeason(seasons, day(2025, 8, 1)).id).toBe(20252026);
    });

    it('should return undefined without seasons', () => {
      expect(DateTimeUtils.getCurrentNhlSeason([], day(2026, 9, 16))).toBeUndefined();
      expect(DateTimeUtils.getCurrentNhlSeason(null, day(2026, 9, 16))).toBeUndefined();
    });
  });

  describe('isPlayoffMode', () => {
    it('should start 2 days before the first playoff game', () => {
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2026, 4, 15, 23))).toBeFalse();
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2026, 4, 16, 0))).toBeTrue();
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2026, 6, 20))).toBeTrue();
    });

    it('should end when the new season starts', () => {
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2026, 9, 4, 23))).toBeTrue();
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2026, 9, 5, 0))).toBeFalse();
    });

    it('should be off while the current season has no playoff game scheduled', () => {
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2026, 9, 16))).toBeFalse();
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2027, 4, 20))).toBeFalse();
    });

    it('should use the new season\'s playoffs once they are scheduled', () => {
      seasons[0].firstPlayoffGameDate = '2027-04-17';
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2027, 4, 14))).toBeFalse();
      expect(DateTimeUtils.isPlayoffMode(seasons, day(2027, 4, 15))).toBeTrue();
    });

    it('should be off without seasons', () => {
      expect(DateTimeUtils.isPlayoffMode([], day(2026, 6, 1))).toBeFalse();
    });
  });
});
