import {NstStatsUtils} from '@shared/utils/nst-stats-utils';
import {mockLiveNstGameStats, mockNstGameStats} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {NhlGameTypeEnum} from '@shared/enums/nhl-game-type.enum';
import {NstGameStats} from '@shared/models/natural-stat-trick/nst-game-stats.model';

describe('NstStatsUtils', () => {

  describe('getGamePageUrl', () => {
    it('should link the NST game page of a regular season and a playoff game', () => {
      expect(NstStatsUtils.getGamePageUrl(2026020010))
          .toBe('https://www.naturalstattrick.com/game.php?season=20262027&game=20010');
      expect(NstStatsUtils.getGamePageUrl('2025030414'))
          .toBe('https://www.naturalstattrick.com/game.php?season=20252026&game=30414');
    });

    it('should be empty without a game ID', () => {
      expect(NstStatsUtils.getGamePageUrl(null)).toBe('');
      expect(NstStatsUtils.getGamePageUrl('abc')).toBe('');
    });
  });

  describe('getCorsiPercentage', () => {
    it("should format a real team's share of the shot attempts", () => {
      const stats = mockNstGameStats(2026020010);
      expect(NstStatsUtils.getCorsiPercentage(stats.homeTeam.corsiFor, stats.homeTeam.corsiAgainst)).toBe('45.2%');
      expect(NstStatsUtils.getCorsiPercentage(stats.awayTeam.corsiFor, stats.awayTeam.corsiAgainst)).toBe('54.8%');
    });

    it('should show a dash without shot attempts or with a missing count', () => {
      expect(NstStatsUtils.getCorsiPercentage(0, 0)).toBe('-');
      expect(NstStatsUtils.getCorsiPercentage(12, null)).toBe('-');
      expect(NstStatsUtils.getCorsiShare(undefined, 4)).toBeUndefined();
    });

    it('should show 0% and 100% for one-sided attempts', () => {
      expect(NstStatsUtils.getCorsiPercentage(0, 3)).toBe('0.0%');
      expect(NstStatsUtils.getCorsiPercentage(3, 0)).toBe('100.0%');
    });
  });

  describe('formatExpectedGoals', () => {
    it('should show two decimals, or a dash when missing', () => {
      expect(NstStatsUtils.formatExpectedGoals(4.85)).toBe('4.85');
      expect(NstStatsUtils.formatExpectedGoals(0.6)).toBe('0.60');
      expect(NstStatsUtils.formatExpectedGoals(0)).toBe('0.00');
      expect(NstStatsUtils.formatExpectedGoals(null)).toBe('-');
    });
  });

  describe('getProgressLabel', () => {
    const live = (period: number, timeInPeriod: string): NstGameStats => ({...mockLiveNstGameStats(), period, timeInPeriod});

    it("should say how far a live game's stats go", () => {
      expect(NstStatsUtils.getProgressLabel(mockLiveNstGameStats(), NhlGameTypeEnum.REGULAR_SEASON)).toBe('2nd 0:12');
      expect(NstStatsUtils.getProgressLabel(live(3, '17:05'), NhlGameTypeEnum.REGULAR_SEASON)).toBe('3rd 17:05');
    });

    it('should name a period that NST has all of', () => {
      expect(NstStatsUtils.getProgressLabel(live(1, '20:00'), NhlGameTypeEnum.REGULAR_SEASON)).toBe('the 1st');
      expect(NstStatsUtils.getProgressLabel(live(4, '5:00'), NhlGameTypeEnum.REGULAR_SEASON)).toBe('OT');
      expect(NstStatsUtils.getProgressLabel(live(4, '2:30'), NhlGameTypeEnum.REGULAR_SEASON)).toBe('OT 2:30');
    });

    it('should count a playoff overtime as 20 minutes', () => {
      expect(NstStatsUtils.getProgressLabel(live(4, '5:00'), NhlGameTypeEnum.PLAYOFFS)).toBe('OT 5:00');
      expect(NstStatsUtils.getProgressLabel(live(5, '20:00'), NhlGameTypeEnum.PLAYOFFS)).toBe('2OT');
    });

    it('should be empty once NST marks the game final, or without how far it goes', () => {
      expect(NstStatsUtils.getProgressLabel(mockNstGameStats(2026020010), NhlGameTypeEnum.REGULAR_SEASON)).toBe('');
      expect(NstStatsUtils.getProgressLabel({...mockLiveNstGameStats(), period: null}, NhlGameTypeEnum.REGULAR_SEASON))
          .toBe('');
      expect(NstStatsUtils.getProgressLabel({...mockLiveNstGameStats(), timeInPeriod: undefined},
          NhlGameTypeEnum.REGULAR_SEASON)).toBe('');
      expect(NstStatsUtils.getProgressLabel(undefined, NhlGameTypeEnum.REGULAR_SEASON)).toBe('');
    });
  });

  describe('isPending', () => {
    it("should be true past how far a live game's stats go", () => {
      // NST is at 0:12 of the 2nd
      const stats = mockLiveNstGameStats();
      expect(NstStatsUtils.isPending(stats, 2, '00:22')).toBeTrue();
      expect(NstStatsUtils.isPending(stats, 3, '00:01')).toBeTrue();
      expect(NstStatsUtils.isPending(stats, 2, '00:12')).toBeFalse();
      expect(NstStatsUtils.isPending(stats, 2, '0:05')).toBeFalse();
      expect(NstStatsUtils.isPending(stats, 1, '19:59')).toBeFalse();
    });

    it('should be false once NST marks the game final, or without how far it goes', () => {
      expect(NstStatsUtils.isPending(mockNstGameStats(2026020010), 3, '19:59')).toBeFalse();
      expect(NstStatsUtils.isPending({...mockLiveNstGameStats(), period: undefined}, 3, '00:01')).toBeFalse();
      expect(NstStatsUtils.isPending(undefined, 3, '00:01')).toBeFalse();
      expect(NstStatsUtils.isPending(mockLiveNstGameStats(), null, '00:01')).toBeFalse();
    });
  });

  describe('findPlayer', () => {
    it('should find a real skater of either team by NHL player ID', () => {
      const stats = mockNstGameStats(2025030414);
      expect(NstStatsUtils.findPlayer(stats, 8475913).name).toBe('Mark Stone');
      expect(NstStatsUtils.findPlayer(stats, 8477940).name).toBe('Nikolaj Ehlers');
    });

    it('should find no one without stats, for a goalie or without an ID', () => {
      expect(NstStatsUtils.findPlayer(undefined, 8475913)).toBeUndefined();
      // Adin Hill isn't among the skaters
      expect(NstStatsUtils.findPlayer(mockNstGameStats(2025030414), 8478499)).toBeUndefined();
      expect(NstStatsUtils.findPlayer(mockNstGameStats(2025030414), null)).toBeUndefined();
    });
  });
});
