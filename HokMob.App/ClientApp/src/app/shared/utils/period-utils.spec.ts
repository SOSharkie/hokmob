import {PeriodUtils} from "@shared/utils/period-utils";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {GameClock, PeriodDescriptor} from "@shared/models/nhl-web-api/common.model";
import {
  derivedLiveGame,
  mockOvertimeFinal,
  mockPlayoffGame,
  mockRegulationFinal,
  mockShootoutFinal
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

function period(number: number, periodType: NhlPeriodTypeEnum): PeriodDescriptor {
  return {number, periodType, maxRegulationPeriods: 3};
}

function clock(timeRemaining: string, inIntermission = false): GameClock {
  return {timeRemaining, secondsRemaining: 0, running: !inIntermission, inIntermission};
}

describe('PeriodUtils', () => {

  describe('getLabel', () => {
    it('should label regulation periods with ordinals', () => {
      expect(PeriodUtils.getLabel(period(1, NhlPeriodTypeEnum.REGULATION))).toBe('1st');
      expect(PeriodUtils.getLabel(period(2, NhlPeriodTypeEnum.REGULATION))).toBe('2nd');
      expect(PeriodUtils.getLabel(period(3, NhlPeriodTypeEnum.REGULATION))).toBe('3rd');
    });

    it('should label the last period of real regulation, overtime and shootout games', () => {
      expect(PeriodUtils.getLabel(mockRegulationFinal().periodDescriptor)).toBe('3rd');
      expect(PeriodUtils.getLabel(mockOvertimeFinal().periodDescriptor)).toBe('OT');
      expect(PeriodUtils.getLabel(mockShootoutFinal().periodDescriptor)).toBe('SO');
    });

    it('should number multiple overtimes', () => {
      expect(PeriodUtils.getLabel(period(5, NhlPeriodTypeEnum.OVERTIME))).toBe('2OT');
      expect(PeriodUtils.getLabel(period(7, NhlPeriodTypeEnum.OVERTIME))).toBe('4OT');
    });

    it('should assume 3 regulation periods when maxRegulationPeriods is missing', () => {
      const periodDescriptor = {number: 5, periodType: NhlPeriodTypeEnum.OVERTIME} as PeriodDescriptor;
      expect(PeriodUtils.getLabel(periodDescriptor)).toBe('2OT');
    });

    it('should return an empty label without a period', () => {
      expect(PeriodUtils.getLabel(undefined)).toBe('');
    });
  });

  describe('getFinalLabel', () => {
    it('should label real regulation, overtime, shootout and playoff finals', () => {
      const regulation = mockRegulationFinal();
      const overtime = mockOvertimeFinal();
      const shootout = mockShootoutFinal();
      const playoff = mockPlayoffGame();
      expect(PeriodUtils.getFinalLabel(regulation.gameOutcome, regulation.periodDescriptor)).toBe('Final');
      expect(PeriodUtils.getFinalLabel(overtime.gameOutcome, overtime.periodDescriptor)).toBe('OT');
      expect(PeriodUtils.getFinalLabel(shootout.gameOutcome, shootout.periodDescriptor)).toBe('SO');
      expect(PeriodUtils.getFinalLabel(playoff.gameOutcome, playoff.periodDescriptor)).toBe('Final');
    });

    it('should number multiple overtimes', () => {
      const gameOutcome = {lastPeriodType: NhlPeriodTypeEnum.OVERTIME, otPeriods: 2};
      expect(PeriodUtils.getFinalLabel(gameOutcome, period(5, NhlPeriodTypeEnum.OVERTIME))).toBe('2OT');
    });

    it('should fall back to the period type when the game outcome is missing', () => {
      expect(PeriodUtils.getFinalLabel(undefined, period(4, NhlPeriodTypeEnum.OVERTIME))).toBe('OT');
      expect(PeriodUtils.getFinalLabel(undefined, period(5, NhlPeriodTypeEnum.SHOOTOUT))).toBe('SO');
      expect(PeriodUtils.getFinalLabel(undefined, undefined)).toBe('Final');
    });

    it('should show OT when the outcome is overtime but the period is not', () => {
      const gameOutcome = {lastPeriodType: NhlPeriodTypeEnum.OVERTIME};
      expect(PeriodUtils.getFinalLabel(gameOutcome, period(3, NhlPeriodTypeEnum.REGULATION))).toBe('OT');
    });
  });

  describe('getLiveLabel', () => {
    it('should show the period and time remaining of a live game', () => {
      const game = derivedLiveGame();
      expect(PeriodUtils.getLiveLabel(game.periodDescriptor, game.clock)).toBe('2nd - 5:32');
      expect(PeriodUtils.getLiveLabel(period(4, NhlPeriodTypeEnum.OVERTIME), clock('03:10'))).toBe('OT - 3:10');
    });

    it('should show the end of a period during intermission or at 00:00', () => {
      expect(PeriodUtils.getLiveLabel(period(1, NhlPeriodTypeEnum.REGULATION), clock('17:45', true))).toBe('End 1st');
      expect(PeriodUtils.getLiveLabel(period(2, NhlPeriodTypeEnum.REGULATION), clock('00:00'))).toBe('End 2nd');
    });

    it('should show only the period during a shootout or without a clock', () => {
      expect(PeriodUtils.getLiveLabel(period(5, NhlPeriodTypeEnum.SHOOTOUT), clock('00:00'))).toBe('SO');
      expect(PeriodUtils.getLiveLabel(period(1, NhlPeriodTypeEnum.REGULATION), undefined)).toBe('1st');
    });

    it('should show Live without a period', () => {
      expect(PeriodUtils.getLiveLabel(undefined, clock('20:00'))).toBe('Live');
    });
  });

  describe('formatTimeRemaining', () => {
    it('should remove only a leading zero', () => {
      expect(PeriodUtils.formatTimeRemaining('05:32')).toBe('5:32');
      expect(PeriodUtils.formatTimeRemaining('00:45')).toBe('0:45');
      expect(PeriodUtils.formatTimeRemaining('12:00')).toBe('12:00');
    });

    it('should return a missing time unchanged', () => {
      expect(PeriodUtils.formatTimeRemaining(undefined)).toBeUndefined();
    });
  });
});
