import {NstStatsUtils} from '@shared/utils/nst-stats-utils';
import {mockNstGameStats} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

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
