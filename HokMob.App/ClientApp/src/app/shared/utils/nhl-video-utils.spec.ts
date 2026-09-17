import {NhlVideoUtils} from "@shared/utils/nhl-video-utils";
import {mockPlayoffGame, mockRegularSeasonScoreResponse} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlVideoUtils', () => {

  describe('getVideoId', () => {
    it('should read the video ID at the end of a real recap path', () => {
      expect(NhlVideoUtils.getVideoId(mockPlayoffGame().threeMinRecap)).toBe('6398034433112');
    });

    it('should read the video ID of a real condensed game path', () => {
      expect(NhlVideoUtils.getVideoId(mockPlayoffGame().condensedGame)).toBe('6398034955112');
    });

    it('should allow a trailing slash', () => {
      expect(NhlVideoUtils.getVideoId('/video/car-at-vgk-recap-6398034433112/')).toBe('6398034433112');
    });

    it('should return undefined for a path without a video ID', () => {
      expect(NhlVideoUtils.getVideoId('/video/car-at-vgk-recap')).toBeUndefined();
      expect(NhlVideoUtils.getVideoId('')).toBeUndefined();
      expect(NhlVideoUtils.getVideoId(null)).toBeUndefined();
    });
  });

  describe('getEmbedUrl', () => {
    it('should build the NHL Brightcove player URL', () => {
      expect(NhlVideoUtils.getEmbedUrl('6398034433112')).toBe(
          'https://players.brightcove.net/6415718365001/D3UCGynRWU_default/index.html?videoId=6398034433112&autoplay=true');
    });
  });

  describe('getHighlightVideos', () => {
    it('should return the recap and condensed game of a real finished game', () => {
      expect(NhlVideoUtils.getHighlightVideos(mockPlayoffGame())).toEqual([
        {label: 'Recap', videoId: '6398034433112', nhlUrl: 'https://www.nhl.com/video/car-at-vgk-recap-6398034433112'},
        {label: 'Condensed Game', videoId: '6398034955112',
          nhlUrl: 'https://www.nhl.com/video/car-at-vgk-condensed-game-6398034955112'}
      ]);
    });

    it('should skip a video that is not posted', () => {
      const game = mockRegularSeasonScoreResponse().games[0];
      delete game.threeMinRecap;
      expect(NhlVideoUtils.getHighlightVideos(game).map(video => video.label)).toEqual(['Condensed Game']);
    });

    it('should skip a video whose path has no ID', () => {
      const game = mockPlayoffGame();
      game.condensedGame = '/video/car-at-vgk-condensed-game';
      expect(NhlVideoUtils.getHighlightVideos(game).map(video => video.label)).toEqual(['Recap']);
    });

    it('should return no videos without a game', () => {
      expect(NhlVideoUtils.getHighlightVideos(undefined)).toEqual([]);
    });
  });
});
