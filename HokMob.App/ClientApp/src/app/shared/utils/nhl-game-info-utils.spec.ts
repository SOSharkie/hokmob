import {NhlGameInfoUtils} from "@shared/utils/nhl-game-info-utils";
import {NhlGameStateEnum} from "@shared/enums/nhl-game-state.enum";
import {SeriesStatus} from "@shared/models/nhl-web-api/common.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {ClubScheduleGame} from "@shared/models/nhl-web-api/club-schedule.model";
import {
  derivedLiveGame,
  mockClubScheduleSeason,
  mockFutureGame,
  mockGameLanding,
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

  describe('getGameDescription', () => {
    function seriesStatus(topSeedWins: number, bottomSeedWins: number): SeriesStatus {
      return {...mockPlayoffGame().seriesStatus, topSeedWins, bottomSeedWins};
    }

    it('should label real regular season games, and preseason games', () => {
      expect(NhlGameInfoUtils.getGameDescription(mockGameLanding(2025021057).gameType, undefined))
          .toBe('NHL Regular Season');
      expect(NhlGameInfoUtils.getGameDescription(NhlGameTypeEnum.PRESEASON, undefined)).toBe('NHL Preseason');
    });

    it('should show the series title and status of a real playoff game', () => {
      expect(NhlGameInfoUtils.getGameDescription(mockGameLanding(2025030414).gameType, mockPlayoffGame().seriesStatus))
          .toBe('Stanley Cup Final: Tied 2-2');
      expect(NhlGameInfoUtils.getGameDescription(NhlGameTypeEnum.PLAYOFFS, seriesStatus(4, 2)))
          .toBe('Stanley Cup Final: CAR wins 4-2');
    });

    it('should show the matchup before the series starts', () => {
      expect(NhlGameInfoUtils.getGameDescription(NhlGameTypeEnum.PLAYOFFS, seriesStatus(0, 0)))
          .toBe('Stanley Cup Final: CAR vs VGK');
    });

    it('should fall back to NHL Playoffs without series data or a title', () => {
      expect(NhlGameInfoUtils.getGameDescription(NhlGameTypeEnum.PLAYOFFS, undefined)).toBe('NHL Playoffs');
      const untitled = {...seriesStatus(3, 1), seriesTitle: undefined};
      expect(NhlGameInfoUtils.getGameDescription(NhlGameTypeEnum.PLAYOFFS, untitled)).toBe('NHL Playoffs: CAR leads 3-1');
    });

    it('should show NHL for other or missing game types', () => {
      expect(NhlGameInfoUtils.getGameDescription(4 as NhlGameTypeEnum, undefined)).toBe('NHL');
      expect(NhlGameInfoUtils.getGameDescription(undefined, undefined)).toBe('NHL');
    });
  });

  describe('getTeamFormGames', () => {
    function bostonGames(): ClubScheduleGame[] {
      return mockClubScheduleSeason('BOS', 20252026).games;
    }

    function gameById(games: ClubScheduleGame[], gameId: number): ClubScheduleGame {
      return games.find(game => game.id === gameId);
    }

    function ids(games: ClubScheduleGame[]): number[] {
      return games.map(game => game.id);
    }

    it('should return the last 5 finished games before a real playoff game, most recent first', () => {
      const games = bostonGames();
      expect(ids(NhlGameInfoUtils.getTeamFormGames(games, gameById(games, 2025030115))))
          .toEqual([2025030114, 2025030113, 2025030112, 2025030111, 2025021292]);
    });

    it('should skip games that are not finished, like a postponed game', () => {
      const games = bostonGames();
      gameById(games, 2025030114).gameState = NhlGameStateEnum.FUTURE;
      expect(ids(NhlGameInfoUtils.getTeamFormGames(games, gameById(games, 2025030115))))
          .toEqual([2025030113, 2025030112, 2025030111, 2025021292, 2025021278]);
    });

    it('should skip preseason games for a regular season game, but not for a preseason game', () => {
      const games = bostonGames();
      expect(ids(NhlGameInfoUtils.getTeamFormGames(games, gameById(games, 2025020008)))).toEqual([2025020005]);
      expect(ids(NhlGameInfoUtils.getTeamFormGames(games, gameById(games, 2025010095))))
          .toEqual([2025010078, 2025010063, 2025010047, 2025010018, 2025010013]);
    });

    it('should return no games before a season has been played', () => {
      const games = mockClubScheduleSeason('BOS', 20262027).games;
      expect(NhlGameInfoUtils.getTeamFormGames(games, mockGameLanding(2026020056))).toEqual([]);
    });

    it('should sort games in any order and return the requested count', () => {
      const games = bostonGames().reverse();
      expect(ids(NhlGameInfoUtils.getTeamFormGames(games, mockGameLanding(2026020056), 3)))
          .toEqual([2025030116, 2025030115, 2025030114]);
    });

    it('should return no games without games or a game', () => {
      expect(NhlGameInfoUtils.getTeamFormGames(null, mockGameLanding(2026020056))).toEqual([]);
      expect(NhlGameInfoUtils.getTeamFormGames(bostonGames(), null)).toEqual([]);
    });
  });
});
