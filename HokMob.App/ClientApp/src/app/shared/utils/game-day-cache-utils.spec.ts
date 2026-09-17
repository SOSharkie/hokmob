import {GameDayCacheUtils} from "@shared/utils/game-day-cache-utils";
import {ScoreGame} from "@shared/models/nhl-web-api/score.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {CurrentSeason} from "@shared/models/nhl-stats-api/season-dates.model";
import {mockScoreResponse} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('GameDayCacheUtils', () => {

  const currentSeason: CurrentSeason = {season: 20262027, isPlayoffMode: false};

  /** Real games (see mockScoreResponse), overridden to look like a day of the given season and game type. */
  function games(season: number = currentSeason.season,
                 gameType: NhlGameTypeEnum = NhlGameTypeEnum.REGULAR_SEASON): ScoreGame[] {
    return mockScoreResponse().games.map(game => ({...game, season, gameType}));
  }

  describe('getCacheDuration', () => {
    it('should give a future day a moderate TTL', () => {
      const future = new Date(2026, 9, 20);
      const now = new Date(2026, 9, 15);
      expect(GameDayCacheUtils.getCacheDuration(future, games(), currentSeason, now))
          .toBe(GameDayCacheUtils.futureDayCacheDurationMs);
    });

    it('should never cache today, even with only finished games', () => {
      const today = new Date(2026, 9, 15, 20, 0);
      const now = new Date(2026, 9, 15, 8, 0);
      expect(GameDayCacheUtils.getCacheDuration(today, games(), currentSeason, now)).toBeUndefined();
    });

    it('should not cache a past day before it settles (1pm Eastern the day after)', () => {
      const gameDay = new Date(2026, 9, 14);
      // 2026-10-15T17:00:00Z is 1pm EDT; one minute before that, the day hasn't settled yet.
      const now = new Date('2026-10-15T16:59:00Z');
      expect(GameDayCacheUtils.getCacheDuration(gameDay, games(), currentSeason, now)).toBeUndefined();
    });

    it('should cache a settled current-season regular day forever, once the cutoff passes', () => {
      const gameDay = new Date(2026, 9, 14);
      const now = new Date('2026-10-15T17:00:00Z');
      expect(GameDayCacheUtils.getCacheDuration(gameDay, games(), currentSeason, now)).toBe('forever');
    });

    it('should use the Eastern cutoff across a DST change (2026-11-01, EDT to EST)', () => {
      const beforeChange = new Date(2026, 9, 30); // Settles 2026-10-31T17:00:00Z (13:00 EDT, -04:00)
      const afterChange = new Date(2026, 9, 31); // Settles 2026-11-01T18:00:00Z (13:00 EST, -05:00)

      expect(GameDayCacheUtils.getCacheDuration(beforeChange, games(), currentSeason,
          new Date('2026-10-31T16:59:00Z'))).toBeUndefined();
      expect(GameDayCacheUtils.getCacheDuration(beforeChange, games(), currentSeason,
          new Date('2026-10-31T17:00:00Z'))).toBe('forever');

      expect(GameDayCacheUtils.getCacheDuration(afterChange, games(), currentSeason,
          new Date('2026-11-01T17:00:00Z'))).toBeUndefined();
      expect(GameDayCacheUtils.getCacheDuration(afterChange, games(), currentSeason,
          new Date('2026-11-01T18:00:00Z'))).toBe('forever');
    });

    it('should not cache a settled day from an earlier season', () => {
      const gameDay = new Date(2026, 2, 1); // The real mockScoreResponse date, season 20252026
      const now = new Date(2026, 8, 17);
      expect(GameDayCacheUtils.getCacheDuration(gameDay, mockScoreResponse().games, currentSeason, now))
          .toBeUndefined();
    });

    it('should not cache a settled preseason or playoff day of the current season', () => {
      const gameDay = new Date(2026, 9, 14);
      const now = new Date(2026, 9, 20);
      expect(GameDayCacheUtils.getCacheDuration(gameDay, games(currentSeason.season, NhlGameTypeEnum.PRESEASON),
          currentSeason, now)).toBeUndefined();
      expect(GameDayCacheUtils.getCacheDuration(gameDay, games(currentSeason.season, NhlGameTypeEnum.PLAYOFFS),
          currentSeason, now)).toBeUndefined();
    });

    it('should not cache a day with no games', () => {
      const gameDay = new Date(2026, 9, 14);
      const now = new Date(2026, 9, 20);
      expect(GameDayCacheUtils.getCacheDuration(gameDay, [], currentSeason, now)).toBeUndefined();
    });

    it('should not cache a settled day when the current season is unknown', () => {
      const gameDay = new Date(2026, 9, 14);
      const now = new Date(2026, 9, 20);
      expect(GameDayCacheUtils.getCacheDuration(gameDay, games(), undefined, now)).toBeUndefined();
    });
  });
});
