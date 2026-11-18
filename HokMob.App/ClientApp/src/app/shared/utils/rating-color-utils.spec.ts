import {RatingColorUtils} from "@shared/utils/rating-color-utils";

describe('RatingColorUtils', () => {

  describe('getTier', () => {
    it('should cut a game rating at 8, 6.5 and 5', () => {
      expect([10, 8, 7.9, 6.5, 6.4, 5, 4.9, -1].map(rating => RatingColorUtils.getTier(rating, 'game')))
          .toEqual(['elite', 'elite', 'good', 'good', 'ordinary', 'ordinary', 'poor', 'poor']);
    });

    it('should cut a season average at 6.5, 6 and 5.5, since averages spread less than games', () => {
      expect([6.5, 6.49, 6, 5.99, 5.5, 5.49].map(rating => RatingColorUtils.getTier(rating, 'seasonAverage')))
          .toEqual(['elite', 'good', 'good', 'ordinary', 'ordinary', 'poor']);
      // A typical skater average is ordinary, not poor as it was on the game cut points
      expect(RatingColorUtils.getTier(5.8, 'seasonAverage')).toBe('ordinary');
    });

    it('should cut a team rating at 7.5, 6 and 3.5, with the league average of 5 ordinary', () => {
      expect([7.5, 7.4, 6, 5, 3.5, 3.4].map(rating => RatingColorUtils.getTier(rating, 'team')))
          .toEqual(['elite', 'good', 'good', 'ordinary', 'ordinary', 'poor']);
    });

    it('should have no tier without a rating', () => {
      expect(RatingColorUtils.getTier(null, 'game')).toBeNull();
      expect(RatingColorUtils.getTier(undefined, 'team')).toBeNull();
      expect(RatingColorUtils.getTier(NaN, 'seasonAverage')).toBeNull();
    });
  });

  describe('getColor', () => {
    it('should give the tier\'s custom property', () => {
      expect(RatingColorUtils.getColor(8.2, 'game')).toBe('var(--rating-elite)');
      expect(RatingColorUtils.getColor(6.2, 'seasonAverage')).toBe('var(--rating-good)');
      expect(RatingColorUtils.getColor(5, 'team')).toBe('var(--rating-ordinary)');
      expect(RatingColorUtils.getColor(4.2, 'game')).toBe('var(--rating-poor)');
    });

    it('should give no color without a rating', () => {
      expect(RatingColorUtils.getColor(null, 'game')).toBeUndefined();
      expect(RatingColorUtils.getTierColor(null)).toBeUndefined();
    });
  });

  describe('getTierRanges', () => {
    it('should cover the scale from worst to best', () => {
      expect(RatingColorUtils.getTierRanges('game', 0, 10)).toEqual([
        {tier: 'poor', from: 0, to: 5},
        {tier: 'ordinary', from: 5, to: 6.5},
        {tier: 'good', from: 6.5, to: 8},
        {tier: 'elite', from: 8, to: 10}
      ]);
    });
  });

  describe('resolveTierColor', () => {
    it('should read each tier\'s color from the global styles', () => {
      expect(RatingColorUtils.tiers.map(tier => RatingColorUtils.resolveTierColor(tier)))
          .toEqual(['#0e87e0', '#1ec854', '#e68122', '#e55b5b']);
    });
  });
});
