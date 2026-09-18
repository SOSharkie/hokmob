import {NhlPlayerHeadshotUtils} from "@shared/utils/nhl-player-headshot-utils";
import {mockGamePlayByPlay, mockPlayerLanding} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlPlayerHeadshotUtils', () => {

  describe('getHeadshotUrl', () => {
    it('should build the same URL as the roster spot headshots', () => {
      const connor = mockGamePlayByPlay(2025021057).rosterSpots.find(spot => spot.playerId === 8478398);
      expect(NhlPlayerHeadshotUtils.getHeadshotUrl(20252026, 'WPG', 8478398)).toBe(connor.headshot);
    });

    it('should return the blank headshot without a season, team or player', () => {
      expect(NhlPlayerHeadshotUtils.getHeadshotUrl(undefined, 'WPG', 8478398)).toBe('assets/blank_headshot.png');
      expect(NhlPlayerHeadshotUtils.getHeadshotUrl(20252026, null, 8478398)).toBe('assets/blank_headshot.png');
      expect(NhlPlayerHeadshotUtils.getHeadshotUrl(20252026, 'WPG', undefined)).toBe('assets/blank_headshot.png');
    });
  });

  describe('getLatestHeadshotUrl', () => {
    it('should build the same URL as a player landing without a current team', () => {
      expect(NhlPlayerHeadshotUtils.getLatestHeadshotUrl(8470638)).toBe(mockPlayerLanding(8470638).headshot);
    });

    it('should return the blank headshot without a player', () => {
      expect(NhlPlayerHeadshotUtils.getLatestHeadshotUrl(null)).toBe('assets/blank_headshot.png');
      expect(NhlPlayerHeadshotUtils.getLatestHeadshotUrl(0)).toBe('assets/blank_headshot.png');
    });
  });

  describe('showBlankHeadshot', () => {
    it('should replace a headshot that failed to load with the blank headshot', () => {
      const image = document.createElement('img');
      image.src = 'https://assets.nhle.com/mugs/nhl/20252026/WPG/1.png';
      image.addEventListener('error', event => NhlPlayerHeadshotUtils.showBlankHeadshot(event));
      image.dispatchEvent(new Event('error'));
      expect(image.src).toMatch(/assets\/blank_headshot\.png$/);

      // A failing blank headshot is left alone, so it can't loop
      const blankSrc = image.src;
      image.dispatchEvent(new Event('error'));
      expect(image.src).toBe(blankSrc);
    });

    it('should ignore an event without an image', () => {
      expect(() => NhlPlayerHeadshotUtils.showBlankHeadshot(undefined)).not.toThrow();
    });
  });
});
