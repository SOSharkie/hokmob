import { BoxscoreGoalie, BoxscoreSkater } from '@shared/models/nhl-web-api/boxscore.model';
import { SkaterRatingContext, StatsUtils } from '@shared/utils/stats-utils';
import { mockGameBoxscore } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { RatingBreakdown, RatingBreakdownUtils } from './rating-breakdown';

describe('RatingBreakdownUtils', () => {

  /** The skaters and goalies of a real game, so the breakdowns run on stat lines the NHL actually produced. */
  function realSkaters(): BoxscoreSkater[] {
    const players = mockGameBoxscore(2025021057).playerByGameStats;
    return [...players.homeTeam.forwards, ...players.homeTeam.defense, ...players.awayTeam.forwards,
      ...players.awayTeam.defense];
  }

  function realGoalies(): BoxscoreGoalie[] {
    const players = mockGameBoxscore(2025021057).playerByGameStats;
    return [...players.homeTeam.goalies, ...players.awayTeam.goalies];
  }

  /** The terms of a breakdown by label, for reading one out. */
  function term(breakdown: RatingBreakdown, label: string): number {
    return breakdown.terms.find(ratingTerm => ratingTerm.label === label)?.value;
  }

  /** A stat line with nothing in it, so a test only sets what it is about. */
  function emptySkater(overrides: Partial<BoxscoreSkater> = {}): BoxscoreSkater {
    return {
      playerId: 1, sweaterNumber: 1, name: {default: 'Test'}, position: 'L', goals: 0, assists: 0, points: 0,
      plusMinus: 0, pim: 0, hits: 0, powerPlayGoals: 0, sog: 0, faceoffWinningPctg: 0, toi: '15:00',
      blockedShots: 0, shifts: 20, giveaways: 0, takeaways: 0, ...overrides
    };
  }

  describe('getSkaterBreakdown', () => {

    it('should add up to the rating StatsUtils returns, for every skater of a real game', () => {
      // Every shape of context a page can hand the formula: none at all, the draws only, a split that adds up, one
      // that doesn't, and power play assists
      const contexts: SkaterRatingContext[] = [undefined, {}, {faceoffsTaken: 0}, {faceoffsTaken: 4},
        {faceoffsTaken: 18}, {primaryAssists: 1, secondaryAssists: 0}, {primaryAssists: 1, secondaryAssists: 1},
        {primaryAssists: 5, secondaryAssists: 5}, {powerPlayAssists: 1}, {powerPlayAssists: 9},
        {faceoffsTaken: 12, primaryAssists: 0, secondaryAssists: 1, powerPlayAssists: 1}];
      realSkaters().forEach(skater => {
        contexts.forEach(ratingContext => {
          const breakdown = RatingBreakdownUtils.getSkaterBreakdown(skater, ratingContext);
          const where = skater.name.default + ', ' + JSON.stringify(ratingContext);
          expect(breakdown.rating).withContext(where)
              .toBe(StatsUtils.calculateSkaterHokmobRating(skater, ratingContext));
          expect(breakdown.terms[breakdown.terms.length - 1].total).withContext(where).toBe(breakdown.rawTotal);
          expect(Math.min(10, breakdown.rawTotal)).withContext(where).toBeCloseTo(breakdown.rating, 1);
        });
      });
    });

    it('should start at 5 and list every term of the formula', () => {
      const breakdown = RatingBreakdownUtils.getSkaterBreakdown(emptySkater());
      expect(breakdown.terms[0].label).toBe('Base');
      expect(breakdown.terms[0].value).toBe(5);
      expect(breakdown.terms.map(ratingTerm => ratingTerm.label)).toEqual(['Base', 'Goals', 'Assists',
        'Shots on goal', 'Hits', 'Blocked shots', 'Takeaways', 'Penalty minutes', 'Plus/minus', 'Giveaways',
        'Faceoffs']);
      expect(breakdown.rating).toBe(5);
      expect(breakdown.clampNote).toBeUndefined();
    });

    it('should weight the counting stats, and not pay a goal twice as a shot', () => {
      const breakdown = RatingBreakdownUtils.getSkaterBreakdown(emptySkater(
          {goals: 2, assists: 1, sog: 5, hits: 3, blockedShots: 2, takeaways: 1, giveaways: 2}));
      expect(term(breakdown, 'Goals')).toBe(2.4);
      expect(term(breakdown, 'Assists')).toBe(0.5);
      expect(term(breakdown, 'Shots on goal')).toBe(0.9);
      expect(term(breakdown, 'Hits')).toBe(0.6);
      expect(term(breakdown, 'Blocked shots')).toBe(0.4);
      expect(term(breakdown, 'Takeaways')).toBe(0.2);
      expect(term(breakdown, 'Giveaways')).toBe(-0.4);
    });

    it('should take 0.25 off a penalty minute, up to 3, and forgive a fighting major', () => {
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(emptySkater({pim: 2})), 'Penalty minutes')).toBe(-0.5);
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(emptySkater({pim: 20})), 'Penalty minutes')).toBe(-3);
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(emptySkater({pim: 5})), 'Penalty minutes')).toBe(0);
      const fightAndTrip = RatingBreakdownUtils.getSkaterBreakdown(emptySkater({pim: 7}));
      expect(term(fightAndTrip, 'Penalty minutes')).toBe(-0.5);
      expect(fightAndTrip.terms[7].detail).toBe('(7 - 5 for fighting) x 0.25, at most 3');
    });

    it('should pay a plus only for the goals the skater was on the ice for', () => {
      // A goal and an assist on the same two goals: the plus is already paid, so it adds nothing
      const scorer = RatingBreakdownUtils.getSkaterBreakdown(emptySkater({goals: 1, assists: 1, sog: 1, plusMinus: 2}));
      expect(term(scorer, 'Plus/minus')).toBe(0);
      // A power play goal doesn't count towards plus/minus, so it is added back
      const powerPlay = RatingBreakdownUtils.getSkaterBreakdown(
          emptySkater({goals: 1, sog: 1, powerPlayGoals: 1, plusMinus: 1}));
      expect(term(powerPlay, 'Plus/minus')).toBe(0.3);
    });

    it('should add a power play assist back to plus/minus, and never more than the assists', () => {
      const skater = emptySkater({assists: 1, plusMinus: 1});
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(skater), 'Plus/minus')).toBe(0);
      const onThePowerPlay = RatingBreakdownUtils.getSkaterBreakdown(skater, {powerPlayAssists: 1});
      expect(term(onThePowerPlay, 'Plus/minus')).toBe(0.3);
      expect(onThePowerPlay.terms[8].detail).toBe('(1 - 0 G + 0 PPG - 1 A + 1 PPA) x 0.3');
      // More power play assists than assists can't buy a bigger plus
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(skater, {powerPlayAssists: 5}), 'Plus/minus')).toBe(0.3);
    });

    it('should weight a primary assist above a secondary one when the split is known', () => {
      const skater = emptySkater({assists: 3});
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(skater), 'Assists')).toBe(1.5);
      const split = RatingBreakdownUtils.getSkaterBreakdown(skater, {primaryAssists: 2, secondaryAssists: 1});
      expect(term(split, 'Assists')).toBe(1.6);
      expect(split.terms[2].detail).toBe('2 primary x 0.6 + 1 secondary x 0.4');
    });

    it('should fall back to the flat assist weight when the split does not add up', () => {
      const skater = emptySkater({assists: 3});
      [{primaryAssists: 2}, {secondaryAssists: 1}, {primaryAssists: 1, secondaryAssists: 1},
        {primaryAssists: 3, secondaryAssists: 3}].forEach(ratingContext => {
        const breakdown = RatingBreakdownUtils.getSkaterBreakdown(skater, ratingContext);
        expect(term(breakdown, 'Assists')).withContext(JSON.stringify(ratingContext)).toBe(1.5);
        expect(breakdown.terms[2].detail).toBe('3 x 0.5, the split unknown');
      });
    });

    it('should take 0.5 off every minus', () => {
      const breakdown = RatingBreakdownUtils.getSkaterBreakdown(emptySkater({goals: 1, sog: 1, plusMinus: -2}));
      expect(term(breakdown, 'Plus/minus')).toBe(-1);
    });

    it('should scale the faceoff term by the draws taken, up to ten of them', () => {
      const winningHalf = emptySkater({position: 'C', faceoffWinningPctg: 1});
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(winningHalf, {faceoffsTaken: 5}), 'Faceoffs')).toBe(0.25);
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(winningHalf, {faceoffsTaken: 10}), 'Faceoffs')).toBe(0.5);
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(winningHalf, {faceoffsTaken: 24}), 'Faceoffs')).toBe(0.5);
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(emptySkater({faceoffWinningPctg: 0}), {faceoffsTaken: 20}),
          'Faceoffs')).toBe(-0.5);
    });

    it('should only give a skater without a draw count the faceoff term if he is a center', () => {
      const center = emptySkater({position: 'C', faceoffWinningPctg: 0.6});
      expect(term(RatingBreakdownUtils.getSkaterBreakdown(center), 'Faceoffs')).toBe(0.1);
      const winger = emptySkater({position: 'L', faceoffWinningPctg: 0.6});
      const breakdown = RatingBreakdownUtils.getSkaterBreakdown(winger);
      expect(term(breakdown, 'Faceoffs')).toBe(0);
      expect(breakdown.terms[10].detail).toBe('Not counted (no draw count, and not a center)');
    });

    it('should cap the rating at 10 and say so', () => {
      const breakdown = RatingBreakdownUtils.getSkaterBreakdown(emptySkater({goals: 4, assists: 3, sog: 9,
        hits: 5, blockedShots: 4, takeaways: 4, plusMinus: 5}));
      expect(term(breakdown, 'Goals')).toBe(4.8);
      expect(breakdown.rawTotal).toBeGreaterThan(10);
      expect(breakdown.rating).toBe(10);
      expect(breakdown.clampNote).toBe('Capped at 10');
    });

    it('should let a bad enough night go below zero, since a skater has no floor', () => {
      const breakdown = RatingBreakdownUtils.getSkaterBreakdown(emptySkater({plusMinus: -5, giveaways: 10, pim: 20}));
      expect(breakdown.rating).toBeLessThan(0);
      expect(breakdown.clampNote).toBeUndefined();
    });

    it('should read a missing stat as zero', () => {
      const breakdown = RatingBreakdownUtils.getSkaterBreakdown({position: 'L'} as BoxscoreSkater);
      expect(breakdown.rating).toBe(5);
      expect(breakdown.terms.every(ratingTerm => ratingTerm.label === 'Base' || ratingTerm.value === 0)).toBeTrue();
    });
  });

  describe('getGoalieBreakdown', () => {

    it('should add up to the rating StatsUtils returns, for every goalie of a real game', () => {
      realGoalies().forEach(goalie => {
        const breakdown = RatingBreakdownUtils.getGoalieBreakdown(goalie);
        expect(breakdown.rating).withContext(goalie.name.default)
            .toBe(StatsUtils.calculateGoalieHokMobRating(goalie));
      });
    });

    it('should pay a save on the penalty kill more than one at even strength or on the power play', () => {
      const breakdown = RatingBreakdownUtils.getGoalieBreakdown({
        evenStrengthShotsAgainst: '24/25', powerPlayShotsAgainst: '5/5', shorthandedShotsAgainst: '1/1',
        savePctg: 0.968, shotsAgainst: 31, saves: 30
      } as BoxscoreGoalie);
      expect(breakdown.terms.map(ratingTerm => ratingTerm.label)).toEqual(['Base', 'Even strength saves',
        'Penalty kill saves', 'Power play saves', 'Goals against']);
      expect(term(breakdown, 'Even strength saves')).toBe(4);
      expect(term(breakdown, 'Penalty kill saves')).toBe(1);
      expect(term(breakdown, 'Power play saves')).toBe(0.17);
      expect(term(breakdown, 'Goals against')).toBe(-1);
      // 5 + 4 + 1 + 1/6 - 1 = 9.17
      expect(breakdown.rawTotal).toBe(9.17);
      expect(breakdown.rating).toBe(9.2);
    });

    it('should rate a goalie who faced no shots 0, not 5', () => {
      const breakdown = RatingBreakdownUtils.getGoalieBreakdown({
        evenStrengthShotsAgainst: '0/0', powerPlayShotsAgainst: '0/0', shorthandedShotsAgainst: '0/0',
        shotsAgainst: 0, saves: 0
      } as BoxscoreGoalie);
      expect(breakdown.rating).toBe(0);
      expect(breakdown.rawTotal).toBe(5);
      expect(breakdown.clampNote).toBe('Faced no shots, so the rating is 0');
    });

    it('should floor a rough night at 0 and cap a great one at 10', () => {
      const pulled = RatingBreakdownUtils.getGoalieBreakdown({
        evenStrengthShotsAgainst: '4/10', powerPlayShotsAgainst: '1/4', shorthandedShotsAgainst: '0/0',
        savePctg: 0.357, shotsAgainst: 14, saves: 5
      } as BoxscoreGoalie);
      expect(pulled.rawTotal).toBeLessThan(0);
      expect(pulled.rating).toBe(0);
      expect(pulled.clampNote).toBe('Floored at 0');

      const shutout = RatingBreakdownUtils.getGoalieBreakdown({
        evenStrengthShotsAgainst: '30/30', powerPlayShotsAgainst: '8/8', shorthandedShotsAgainst: '2/2',
        savePctg: 1, shotsAgainst: 40, saves: 40
      } as BoxscoreGoalie);
      expect(shutout.rawTotal).toBeGreaterThan(10);
      expect(shutout.rating).toBe(10);
      expect(shutout.clampNote).toBe('Capped at 10');
    });
  });

  describe('round', () => {

    it('should keep two decimals by default', () => {
      expect(RatingBreakdownUtils.round(1 / 3)).toBe(0.33);
      expect(RatingBreakdownUtils.round(2.5, 0)).toBe(3);
      expect(RatingBreakdownUtils.round(null)).toBe(0);
    });
  });
});
