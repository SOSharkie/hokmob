import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {NhlGameStatusModel} from "@shared/models/nhl-general/nhl-game-status.model";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {
  derivedLiveGame,
  mockFutureGame,
  mockPlayoffGame,
  mockRegulationFinal
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlGameInfoUtils', () => {

  describe('game state checks', () => {
    it('should treat FUT and PRE as future games', () => {
      expect(NhlGameInfoUtils.isFutureGame(mockFutureGame().gameState)).toBeTrue();
      expect(NhlGameInfoUtils.isFutureGame(NhlGameStateEnum.PREGAME)).toBeTrue();
      expect(NhlGameInfoUtils.isLiveGame(mockFutureGame().gameState)).toBeFalse();
      expect(NhlGameInfoUtils.isCompletedGame(mockFutureGame().gameState)).toBeFalse();
    });

    it('should treat LIVE and CRIT as live games', () => {
      expect(NhlGameInfoUtils.isLiveGame(derivedLiveGame().gameState)).toBeTrue();
      expect(NhlGameInfoUtils.isLiveGame(NhlGameStateEnum.CRITICAL)).toBeTrue();
      expect(NhlGameInfoUtils.isFutureGame(NhlGameStateEnum.LIVE)).toBeFalse();
      expect(NhlGameInfoUtils.isCompletedGame(NhlGameStateEnum.CRITICAL)).toBeFalse();
    });

    it('should treat OFF and FINAL as completed games', () => {
      expect(NhlGameInfoUtils.isCompletedGame(mockRegulationFinal().gameState)).toBeTrue();
      expect(NhlGameInfoUtils.isCompletedGame(NhlGameStateEnum.FINAL)).toBeTrue();
      expect(NhlGameInfoUtils.isLiveGame(NhlGameStateEnum.FINAL)).toBeFalse();
    });

    it('should not match a missing or unknown state', () => {
      expect(NhlGameInfoUtils.isFutureGame(undefined)).toBeFalse();
      expect(NhlGameInfoUtils.isLiveGame(null)).toBeFalse();
      expect(NhlGameInfoUtils.isCompletedGame('Final' as NhlGameStateEnum)).toBeFalse();
    });

    it('should still accept the deprecated old status model', () => {
      const status = {abstractGameState: 'Live'} as NhlGameStatusModel;
      expect(NhlGameInfoUtils.isLiveGame(status)).toBeTrue();
      expect(NhlGameInfoUtils.isCompletedGame(status)).toBeFalse();
    });
  });

  describe('getSeriesStatusShort', () => {
    function seriesStatus(topSeedWins: number, bottomSeedWins: number): SeriesStatus {
      return {...mockPlayoffGame().seriesStatus, topSeedWins, bottomSeedWins};
    }

    it('should show a tied series from a real playoff game', () => {
      expect(NhlGameInfoUtils.getSeriesStatusShort(mockPlayoffGame().seriesStatus)).toBe('Tied 2-2');
    });

    it('should show which team leads, top or bottom seed', () => {
      expect(NhlGameInfoUtils.getSeriesStatusShort(seriesStatus(3, 2))).toBe('CAR leads 3-2');
      expect(NhlGameInfoUtils.getSeriesStatusShort(seriesStatus(1, 3))).toBe('VGK leads 3-1');
    });

    it('should show the winner once a team reaches the wins needed', () => {
      expect(NhlGameInfoUtils.getSeriesStatusShort(seriesStatus(4, 2))).toBe('CAR wins 4-2');
      expect(NhlGameInfoUtils.getSeriesStatusShort(seriesStatus(0, 4))).toBe('VGK wins 4-0');
    });

    it('should show (0-0) before the series starts, including missing wins', () => {
      expect(NhlGameInfoUtils.getSeriesStatusShort(seriesStatus(0, 0))).toBe('(0-0)');
      expect(NhlGameInfoUtils.getSeriesStatusShort(seriesStatus(undefined, undefined))).toBe('(0-0)');
    });

    it('should return an empty status without series data', () => {
      expect(NhlGameInfoUtils.getSeriesStatusShort(undefined)).toBe('');
    });
  });
});
