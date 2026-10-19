import { ShotMapUtils } from './shot-map-utils';
import { GameShot } from '@shared/models/game-shot.model';
import { PlayByPlay } from '@shared/models/nhl-web-api/play-by-play.model';
import { NhlPeriodTypeEnum } from '@shared/enums/nhl-period-type.enum';
import { mockGameBoxscore, mockGamePlayByPlay, mockNstGameStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('ShotMapUtils', () => {

  /** CAR 5 @ VGK 3, the 2026 Stanley Cup Final's 4th game. */
  const final = () => mockGamePlayByPlay(2025030414);
  const shot = (shots: GameShot[], eventId: number) => shots.find(item => item.eventId === eventId);

  describe('getShots', () => {
    it("should list each team's shots on goal and goals, as many as the boxscore's shots", () => {
      const shots = ShotMapUtils.getShots(final());
      const boxscore = mockGameBoxscore(2025030414);
      expect(shots.filter(item => item.isHomeTeam).length).toBe(boxscore.homeTeam.sog);
      expect(shots.filter(item => !item.isHomeTeam).length).toBe(boxscore.awayTeam.sog);
      expect(shots.filter(item => item.isGoal).length).toBe(8);
    });

    it('should list the shots in play order', () => {
      const sortOrders = ShotMapUtils.getShots(final()).map(item => item.sortOrder);
      expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
    });

    it('should keep a shot towards the right end as it is', () => {
      // Stankoven's 1st period goal: Carolina defends the left end, since Vegas defends the right
      expect(shot(ShotMapUtils.getShots(final()), 69)).toEqual(jasmine.objectContaining({
        teamId: 12, isHomeTeam: false, shooterId: 8482702, goalieId: 8479394, isGoal: true, shotType: 'backhand',
        timeInPeriod: '01:06', x: 80, y: 2
      }));
    });

    it('should turn a shot towards the left end half a turn, so every shooter attacks the net at x = 89', () => {
      const shots = ShotMapUtils.getShots(final());
      // Mark Stone in the 1st (raw -73, 2): Vegas attacks the left end
      expect(shot(shots, 86)).toEqual(jasmine.objectContaining({isHomeTeam: true, isGoal: false, x: 73, y: -2}));
      // Karlsson's 2nd period goal (raw 70, 16): the teams switched ends, so it stays
      expect(shot(shots, 783)).toEqual(jasmine.objectContaining({isHomeTeam: true, isGoal: true, x: 70, y: 16}));
      // Carolina in the 2nd (raw -82, 0)
      expect(shot(shots, 204)).toEqual(jasmine.objectContaining({isHomeTeam: false, x: 82, y: 0}));
    });

    it('should take the shooter from the scorer of a goal and the shooter of a shot on goal', () => {
      const shots = ShotMapUtils.getShots(final());
      expect(shot(shots, 86).shooterId).toBe(8475913);
      expect(shot(shots, 448).shooterId).toBe(8473533);
      expect(shot(shots, 86).shooterName).toBe('Mark Stone');
      expect(shot(shots, 448).shooterName).toBe('Jordan Staal');
    });

    it('should leave out the goalie of an empty net goal', () => {
      const emptyNetGoal = shot(ShotMapUtils.getShots(final()), 215);
      expect(emptyNetGoal.isGoal).toBeTrue();
      expect(emptyNetGoal.goalieId).toBeUndefined();
    });

    it('should leave out the shootout but keep overtime shots', () => {
      const shots = ShotMapUtils.getShots(mockGamePlayByPlay(2025020952));
      expect(shots.some(item => item.periodDescriptor.periodType === NhlPeriodTypeEnum.SHOOTOUT)).toBeFalse();
      expect(shots.filter(item => item.periodDescriptor.periodType === NhlPeriodTypeEnum.OVERTIME)
          .map(item => item.eventId)).toEqual([1254, 1283, 118]);
    });

    it('should leave out missed and blocked shots', () => {
      const playByPlay = final();
      const eventIds = ShotMapUtils.getShots(playByPlay).map(item => item.eventId);
      const otherShots = playByPlay.plays.filter(play => play.typeDescKey === 'missed-shot' || play.typeDescKey === 'blocked-shot');
      expect(otherShots.length).toBeGreaterThan(0);
      expect(otherShots.some(play => eventIds.includes(play.eventId))).toBeFalse();
    });

    it('should leave out a shot without coordinates or a shooter', () => {
      const playByPlay = final();
      const play = (eventId: number) => playByPlay.plays.find(item => item.eventId === eventId);
      delete play(86).details.xCoord;
      delete play(448).details.scoringPlayerId;
      const eventIds = ShotMapUtils.getShots(playByPlay).map(item => item.eventId);
      expect(eventIds).not.toContain(86);
      expect(eventIds).not.toContain(448);
      expect(eventIds).toContain(69);
    });

    it('should turn a shot by the half it was taken from without homeTeamDefendingSide', () => {
      const playByPlay = final();
      playByPlay.plays.forEach(play => delete play.homeTeamDefendingSide);
      const shots = ShotMapUtils.getShots(playByPlay);
      expect(shot(shots, 86)).toEqual(jasmine.objectContaining({x: 73, y: -2}));
      expect(shot(shots, 69)).toEqual(jasmine.objectContaining({x: 80, y: 2}));
    });

    it('should return no shots for a future game or without a play-by-play', () => {
      expect(ShotMapUtils.getShots(mockGamePlayByPlay(2026020056))).toEqual([]);
      expect(ShotMapUtils.getShots(undefined)).toEqual([]);
      expect(ShotMapUtils.getShots({plays: undefined} as PlayByPlay)).toEqual([]);
    });
  });

  describe('getShots with Natural Stat Trick xG', () => {
    const nstShots = (gameId: 2025030414 | 2026020010) => mockNstGameStats(gameId).shots;
    /** TBL @ NYR, where NST leaves out a shot from behind the net and a goalie's goal. */
    const rangers = () => mockGamePlayByPlay(2026020010);

    it("should give every shot of the final its xG", () => {
      const shots = ShotMapUtils.getShots(final(), nstShots(2025030414));
      expect(shots.length).toBe(49);
      expect(shots.every(item => item.expectedGoals != null)).toBeTrue();
      // Stankoven's goal at 1:06 of the 1st, and Theodore's shot from 101ft at the end
      expect(shot(shots, 69).expectedGoals).toBe(0.09);
      expect(shots[shots.length - 1].expectedGoals).toBe(0);
    });

    it("should match each shot by its shooter, period, time and type, leaving NST's missed shots out", () => {
      const staalShots = ShotMapUtils.getPlayerShots(ShotMapUtils.getShots(final(), nstShots(2025030414)), 8473533, false);
      // His miss at 10:21 of the 2nd (0.08) isn't on the map
      expect(staalShots.map(item => item.expectedGoals)).toEqual([0.05, 0.33, 0.11, 0.06]);
    });

    it("should add up to NST's xG of the goals and shots on goal", () => {
      const total = ShotMapUtils.getShots(final(), nstShots(2025030414))
          .reduce((sum, item) => sum + item.expectedGoals, 0);
      const nstTotal = nstShots(2025030414).filter(item => item.type !== 'miss')
          .reduce((sum, item) => sum + item.expectedGoals, 0);
      expect(total).toBeCloseTo(nstTotal, 6);
    });

    it("should leave the xG out of a shot NST doesn't list", () => {
      const shots = ShotMapUtils.getShots(rangers(), nstShots(2026020010));
      // Guentzel's shot from behind the net, and Shesterkin's empty net goal
      expect(shot(shots, 334).expectedGoals).toBeUndefined();
      expect(shot(shots, 1036).expectedGoals).toBeUndefined();
      expect(shots.filter(item => item.expectedGoals == null).length).toBe(2);
    });

    it("should pair a shooter's shots in the same second nearest to the net first", () => {
      // Holmberg's two shots at 2:05 of the 2nd: 452 from 5ft, 207 from about 6ft. NST lists both at 0.3 xG.
      const holmberg = nstShots(2026020010).filter(item => item.playerId === 8480995 && item.time === '2:05');
      expect(holmberg.map(item => item.distance)).toEqual([5, 6]);
      holmberg[0].expectedGoals = 0.4;
      holmberg[1].expectedGoals = 0.2;
      const others = nstShots(2026020010).filter(item => !(item.playerId === 8480995 && item.time === '2:05'));
      const shots = ShotMapUtils.getShots(rangers(), [holmberg[1], ...others, holmberg[0]]);
      expect(shot(shots, 452).expectedGoals).toBe(0.4);
      expect(shot(shots, 207).expectedGoals).toBe(0.2);
    });

    it('should not take the xG of a different type of shot at the same time', () => {
      const stankovenGoal = nstShots(2025030414).find(item => item.playerId === 8482702 && item.time === '1:06');
      const shots = ShotMapUtils.getShots(final(), [{...stankovenGoal, type: 'shot'}]);
      expect(shot(shots, 69).expectedGoals).toBeUndefined();
    });

    it('should leave every xG out without NST shots', () => {
      [undefined, null, []].forEach(missing => {
        expect(ShotMapUtils.getShots(final(), missing).some(item => item.expectedGoals != null)).toBeFalse();
      });
    });
  });

  describe('getPlayerShots', () => {
    it("should return a skater's own shots", () => {
      const staalShots = ShotMapUtils.getPlayerShots(ShotMapUtils.getShots(final()), 8473533, false);
      expect(staalShots.map(item => item.timeInPeriod)).toEqual(['07:05', '12:48', '10:28', '06:32']);
      expect(staalShots.filter(item => item.isGoal).length).toBe(2);
    });

    it('should return the shots a goalie faced, as many as his boxscore shots against', () => {
      const hartShots = ShotMapUtils.getPlayerShots(ShotMapUtils.getShots(final()), 8479394, true);
      const hart = mockGameBoxscore(2025030414).playerByGameStats.homeTeam.goalies.find(goalie => goalie.playerId === 8479394);
      expect(hartShots.length).toBe(hart.shotsAgainst);
      expect(hartShots.length - hartShots.filter(item => item.isGoal).length).toBe(hart.saves);
    });

    it('should return no shots for a goalie who faced none, a missing player or missing shots', () => {
      const shots = ShotMapUtils.getShots(final());
      expect(ShotMapUtils.getPlayerShots(shots, 8478499, true)).toEqual([]);
      expect(ShotMapUtils.getPlayerShots(shots, null, true)).toEqual([]);
      expect(ShotMapUtils.getPlayerShots(null, 8473533, false)).toEqual([]);
    });
  });

  describe('getShotTypeLabel', () => {
    it('should capitalize the shot type, with labels for the ones that need them', () => {
      expect(ShotMapUtils.getShotTypeLabel('wrist')).toBe('Wrist');
      expect(ShotMapUtils.getShotTypeLabel('tip-in')).toBe('Tip-in');
      expect(ShotMapUtils.getShotTypeLabel('wrap-around')).toBe('Wrap-around');
      expect(ShotMapUtils.getShotTypeLabel('deflected')).toBe('Deflection');
      expect(ShotMapUtils.getShotTypeLabel('bat')).toBe('Batted');
      expect(ShotMapUtils.getShotTypeLabel('between-legs')).toBe('Between the legs');
      expect(ShotMapUtils.getShotTypeLabel('some-new-type')).toBe('Some new type');
    });

    it('should return "Unknown" without a shot type', () => {
      expect(ShotMapUtils.getShotTypeLabel(undefined)).toBe('Unknown');
      expect(ShotMapUtils.getShotTypeLabel('')).toBe('Unknown');
    });
  });

  describe('getTimeLabel', () => {
    it('should label the period and the time elapsed in it', () => {
      expect(ShotMapUtils.getTimeLabel(shot(ShotMapUtils.getShots(final()), 69))).toBe('1st 1:06');
      expect(ShotMapUtils.getTimeLabel(shot(ShotMapUtils.getShots(mockGamePlayByPlay(2025020952)), 1254)))
          .toBe('OT 1:15');
    });

    it('should return an empty label without a shot', () => {
      expect(ShotMapUtils.getTimeLabel(null)).toBe('');
    });
  });
});
