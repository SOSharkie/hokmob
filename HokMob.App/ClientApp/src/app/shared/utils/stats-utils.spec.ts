import {GoalieRatingContext, StatsUtils} from "@shared/utils/stats-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {NhlPlayTypeEnum} from "@shared/enums/nhl-play-type.enum";
import {BoxscoreGoalie, BoxscoreSkater, GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {
  MockGamecenterGameId,
  mockGameBoxscore,
  mockGameLanding,
  mockGamePlayByPlay,
  mockGoalieAssistLanding,
  mockPlayerStats
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";
import {GoalieGameStats, SkaterGameStats} from "@shared/models/nhl-stats-api/player-stats.model";

describe('StatsUtils', () => {

  /** A real skater or goalie of a game by player ID, from 2025021057 (STL @ WPG) unless another game is given. */
  function boxscorePlayer<T extends BoxscoreSkater | BoxscoreGoalie>(playerId: number,
                                                                    gameId: MockGamecenterGameId = 2025021057): T {
    const players = mockGameBoxscore(gameId).playerByGameStats;
    return [players.homeTeam, players.awayTeam]
        .flatMap(team => [...team.forwards, ...team.defense, ...team.goalies])
        .find(player => player.playerId === playerId) as T;
  }

  describe('calculateSkaterHokmobRating', () => {
    it('should rate a real center with the faceoff term', () => {
      // Scheifele: 1 goal, 4 shots, 1 takeaway, 2 giveaways, +/- 0, 70.6% faceoffs
      // 5 + 1.2 + 0.9 + 0.2 - 0.4 + (0.706 - 0.5) = 7.106
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8476460))).toBe(7.1);
    });

    it('should scale the faceoff term by the faceoffs taken, up to 10', () => {
      // Scheifele took 17, so his 70.6% counts fully.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8476460), {faceoffsTaken: 17})).toBe(7.1);
      // Holloway, a winger, won 2 of 10: 7.9 + (0.2 - 0.5) = 7.6.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8482077), {faceoffsTaken: 10})).toBe(7.6);
      // Suter won 1 of 4: 5.95 + (0.25 - 0.5) * 0.4 = 5.85.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8480459), {faceoffsTaken: 4})).toBe(5.8);
    });

    it('should not take the faceoff term from a center who took no faceoffs', () => {
      // Vilardi: a center with 0% and no faceoff plays, who got the full -0.5 without a count.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8480014))).toBe(4.3);
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8480014), {faceoffsTaken: 0})).toBe(4.8);
    });

    it('should ignore the faceoff percentage of a player who is not a center without a faceoff count', () => {
      const scheifele = boxscorePlayer<BoxscoreSkater>(8476460);
      scheifele.position = 'L';
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(6.9);
    });

    it('should rate real skaters with positive and negative plus/minus', () => {
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8477938))).toBe(7.9); // Fleury, +2
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8482077))).toBe(7.9); // Holloway, +1, winger with faceoffs
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8479385))).toBe(3.6); // Kyrou, -3
    });

    it('should not count the 5 minutes of a major penalty, and cap the penalty deduction at 3', () => {
      const scheifele = boxscorePlayer<BoxscoreSkater>(8476460);
      scheifele.pim = 5;
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(7.1);
      scheifele.pim = 7;
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(6.6);
      scheifele.pim = 20;
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(4.1);
    });

    it('should weight a primary assist above a secondary one', () => {
      // Barron: 2 assists, 2 blocks, +2, no shots. 5 + 0.4 + 0.6 + (0.556 - 0.5) = 6.5 at the flat weight.
      const barron = boxscorePlayer<BoxscoreSkater>(8480289);
      expect(barron.assists).toBe(2);
      expect(StatsUtils.calculateSkaterHokmobRating(barron)).toBe(6.5);
      expect(StatsUtils.calculateSkaterHokmobRating(barron, {primaryAssists: 2, secondaryAssists: 0})).toBe(6.7);
      expect(StatsUtils.calculateSkaterHokmobRating(barron, {primaryAssists: 0, secondaryAssists: 2})).toBe(6.3);
      // One of each is worth the same as the flat weight.
      expect(StatsUtils.calculateSkaterHokmobRating(barron, {primaryAssists: 1, secondaryAssists: 1})).toBe(6.5);
    });

    it('should fall back to the flat assist weight without both halves of the split', () => {
      const fleury = boxscorePlayer<BoxscoreSkater>(8477938); // 1 goal, 1 assist, +2
      expect(StatsUtils.calculateSkaterHokmobRating(fleury)).toBe(7.9);
      expect(StatsUtils.calculateSkaterHokmobRating(fleury, {})).toBe(7.9);
      expect(StatsUtils.calculateSkaterHokmobRating(fleury, {primaryAssists: 1})).toBe(7.9);
      expect(StatsUtils.calculateSkaterHokmobRating(fleury, {secondaryAssists: 1})).toBe(7.9);
      expect(StatsUtils.calculateSkaterHokmobRating(fleury, {primaryAssists: 1, secondaryAssists: 0})).toBe(8.0);
      expect(StatsUtils.calculateSkaterHokmobRating(fleury, {primaryAssists: 0, secondaryAssists: 1})).toBe(7.8);
    });

    it('should add power play assists back to realPlusMinus', () => {
      // Plus/minus doesn't count a power play goal, so a power play assist is added back before the 0.3 per goal the
      // skater was on the ice for. Gostisbehere assisted on Carolina's power play goal in 2025030414.
      const onIce = {...boxscorePlayer<BoxscoreSkater>(8476906, 2025030414), plusMinus: 2};
      expect(StatsUtils.calculateSkaterHokmobRating(onIce, {primaryAssists: 1, secondaryAssists: 0})).toBe(6.6);
      expect(StatsUtils.calculateSkaterHokmobRating(onIce,
          {primaryAssists: 1, secondaryAssists: 0, powerPlayAssists: 1})).toBe(6.9);
    });

    it('should not change a rating with a plus/minus of 0 or less, which never uses realPlusMinus', () => {
      // Gostisbehere was 0 and Aho -1 in the real game, so their power play assists make no difference there.
      const gostisbehere = boxscorePlayer<BoxscoreSkater>(8476906, 2025030414);
      expect(gostisbehere.plusMinus).toBe(0);
      expect(StatsUtils.calculateSkaterHokmobRating(gostisbehere, {primaryAssists: 1, secondaryAssists: 0}))
          .toBe(StatsUtils.calculateSkaterHokmobRating(gostisbehere,
              {primaryAssists: 1, secondaryAssists: 0, powerPlayAssists: 1}));

      const aho = boxscorePlayer<BoxscoreSkater>(8478427, 2025030414);
      expect(aho.plusMinus).toBe(-1);
      expect(StatsUtils.calculateSkaterHokmobRating(aho, {primaryAssists: 0, secondaryAssists: 1}))
          .toBe(StatsUtils.calculateSkaterHokmobRating(aho,
              {primaryAssists: 0, secondaryAssists: 1, powerPlayAssists: 1}));
    });

    it('should ignore more power play assists than the skater has assists', () => {
      const onIce = {...boxscorePlayer<BoxscoreSkater>(8476906, 2025030414), plusMinus: 2};
      const correct = StatsUtils.calculateSkaterHokmobRating(onIce,
          {primaryAssists: 1, secondaryAssists: 0, powerPlayAssists: 1});
      expect(StatsUtils.calculateSkaterHokmobRating(onIce,
          {primaryAssists: 1, secondaryAssists: 0, powerPlayAssists: 4})).toBe(correct);
      expect(StatsUtils.calculateSkaterHokmobRating(onIce,
          {primaryAssists: 1, secondaryAssists: 0, powerPlayAssists: -2}))
          .toBe(StatsUtils.calculateSkaterHokmobRating(onIce, {primaryAssists: 1, secondaryAssists: 0}));
    });

    it('should fall back to the flat assist weight when the split does not add up to the assists', () => {
      // A live game whose boxscore and play-by-play disagree for a moment must not rate the game two ways.
      const barron = boxscorePlayer<BoxscoreSkater>(8480289);
      expect(StatsUtils.calculateSkaterHokmobRating(barron, {primaryAssists: 1, secondaryAssists: 0})).toBe(6.5);
      expect(StatsUtils.calculateSkaterHokmobRating(barron, {primaryAssists: 2, secondaryAssists: 2})).toBe(6.5);
    });

    it('should add the penalty drawn weight for each penalty drawn', () => {
      // Vilardi drew a holding minor in 2025021057: 5 + 0.3 (1 shot) - 0.5 (-1) = 4.8, with no faceoffs taken.
      const vilardi = boxscorePlayer<BoxscoreSkater>(8480014);
      expect(StatsUtils.calculateSkaterHokmobRating(vilardi, {faceoffsTaken: 0})).toBe(4.8);
      expect(StatsUtils.calculateSkaterHokmobRating(vilardi, {faceoffsTaken: 0, penaltiesDrawn: 1})).toBe(5.1);
      expect(StatsUtils.calculateSkaterHokmobRating(vilardi, {faceoffsTaken: 0, penaltiesDrawn: 2})).toBe(5.4);
      // Hall drew one minor and took another in 2025030414, so he nets -0.5 + 0.3.
      const hall = boxscorePlayer<BoxscoreSkater>(8475791, 2025030414);
      expect(hall.pim).toBe(2);
      expect(StatsUtils.calculateSkaterHokmobRating(hall)).toBe(6.1);
      expect(StatsUtils.calculateSkaterHokmobRating(hall, {penaltiesDrawn: 1})).toBe(6.4);
    });

    it('should give a fighter the penalty drawn weight without deducting his major', () => {
      const scheifele = {...boxscorePlayer<BoxscoreSkater>(8476460), pim: 5};
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(7.1);
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele, {penaltiesDrawn: 1})).toBe(7.4);
    });

    it('should leave the rating unchanged without penalties drawn', () => {
      const vilardi = boxscorePlayer<BoxscoreSkater>(8480014);
      expect(StatsUtils.calculateSkaterHokmobRating(vilardi, {faceoffsTaken: 0, penaltiesDrawn: undefined})).toBe(4.8);
      expect(StatsUtils.calculateSkaterHokmobRating(vilardi, {faceoffsTaken: 0, penaltiesDrawn: 0})).toBe(4.8);
      expect(StatsUtils.calculateSkaterHokmobRating(vilardi, {faceoffsTaken: 0, penaltiesDrawn: -1})).toBe(4.8);
    });

    it('should cap the rating at 10', () => {
      const scheifele = boxscorePlayer<BoxscoreSkater>(8476460);
      scheifele.goals = 5;
      scheifele.sog = 8;
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(10);
    });

    it('should treat missing stats as 0', () => {
      const skater = {playerId: 1, position: 'D'} as BoxscoreSkater;
      expect(StatsUtils.calculateSkaterHokmobRating(skater)).toBe(5);
    });

    it('should round a rating on a half the same whether the faceoff percentage is rounded or exact', () => {
      // Geekie in 2026020010: 3 hits, 2 of 3 faceoffs, which the boxscore gives as 0.666667
      // 5 + 0.6 + (0.666667 - 0.5) x 0.3 = 5.65000.., and with 2/3 it's 5.64999..
      const geekie = boxscorePlayer<BoxscoreSkater>(8483447, 2026020010);
      expect(geekie.faceoffWinningPctg).toBe(0.666667);
      expect(StatsUtils.calculateSkaterHokmobRating(geekie, {faceoffsTaken: 3})).toBe(5.7);
      geekie.faceoffWinningPctg = 2 / 3;
      expect(StatsUtils.getSkaterRawRating(geekie, {faceoffsTaken: 3})).toBeLessThan(5.65);
      expect(StatsUtils.calculateSkaterHokmobRating(geekie, {faceoffsTaken: 3})).toBe(5.7);
    });
  });

  describe('roundRating', () => {
    it('should round to one decimal, a half away from zero', () => {
      expect(StatsUtils.roundRating(7.106)).toBe(7.1);
      expect(StatsUtils.roundRating(7.15)).toBe(7.2);
      expect(StatsUtils.roundRating(8.45)).toBe(8.5); // (8.45).toFixed(1) is 8.4
      expect(StatsUtils.roundRating(1.45)).toBe(1.5);
      expect(StatsUtils.roundRating(-1.45)).toBe(-1.5);
      expect(StatsUtils.roundRating(10)).toBe(10);
      expect(StatsUtils.roundRating(0)).toBe(0);
    });

    it('should round float noise around a half to the half first', () => {
      expect(StatsUtils.roundRating(5.649999999)).toBe(5.7);
      expect(StatsUtils.roundRating(5.650000001)).toBe(5.7);
      expect(StatsUtils.roundRating(5.6499)).toBe(5.6);
    });
  });

  describe('calculateGoalieHokMobRating', () => {
    /** Comrie's real game with one saves/shots split per strength, the totals they add up to, and a start and decision. */
    function goalieWith(evenStrength: string, penaltyKill: string = '0/0', powerPlay: string = '0/0',
                        starter: boolean = true, decision: string = undefined): BoxscoreGoalie {
      const splits = [evenStrength, penaltyKill, powerPlay];
      const saves = splits.reduce((total, split) => total + StatsUtils.getSaves(split), 0);
      const shots = splits.reduce((total, split) => total + StatsUtils.getShots(split), 0);
      return {
        ...boxscorePlayer<BoxscoreGoalie>(8477480),
        evenStrengthShotsAgainst: evenStrength,
        powerPlayShotsAgainst: penaltyKill,
        shorthandedShotsAgainst: powerPlay,
        saves,
        shotsAgainst: shots,
        savePctg: shots ? saves / shots : undefined,
        starter,
        decision
      };
    }

    it('should rate a real goalie from his saves above average at every strength, his workload and the result', () => {
      // Comrie won on 28/30 even strength, 1/1 power play (penalty kill), 0/0 shorthanded, 29 saves on 31 shots in
      // 59:52, above average so at 0.7: 5.75 + 0.7 x (28 - 0.903 x 30) + 0.7 x (1 - 0.853 x 1)
      // + 0.02 x (31 - 26 x 3592 / 3600) + 0.3 = 6.89
      expect(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer(8477480))).toBe(6.9);
      // Binnington lost on 8/11 even strength, 4/4 power play, 1/1 shorthanded, 13 saves on 16 shots in 56:13:
      // 5.75 + 0.6 x (8 - 0.903 x 11) + 0.6 x (4 - 0.853 x 4) + 0.6 x (1 - 0.910 x 1) + 0.02 x (16 - 26 x 3373 / 3600)
      // = 4.83
      expect(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer(8476412))).toBe(4.8);
    });

    it('should measure the workload against the shots an average goalie faces in his time on ice', () => {
      // 10 shots at .900 even strength after 20 minutes of a live game: 26 x 1/3 = 8.67 shots expected, so
      // 5.75 + 0.6 x (9 - 0.903 x 10) + 0.02 x (10 - 8.67) = 5.76, where a full game's 26 would take off 0.32
      const live = {...goalieWith('9/10'), toi: '20:00'};
      expect(StatsUtils.getGoalieRawRating(live)).toBeCloseTo(5.75 - 0.018 + 0.02 * (10 - 26 / 3), 4);
      expect(StatsUtils.calculateGoalieHokMobRating(live)).toBe(5.8);
      expect(StatsUtils.calculateGoalieHokMobRating({...live, toi: '60:00'})).toBe(5.4);
    });

    it('should measure a save against the league average at its strength, and charge 0.6 for a goal below it', () => {
      // 1.04 goals below average
      const base = StatsUtils.getGoalieRawRating(goalieWith('19/22', '4/5', '1/1'));
      // One more saved shot: 0.6 x (1 - the league average) + 0.02 of workload
      expect(StatsUtils.getGoalieRawRating(goalieWith('20/23', '4/5', '1/1')) - base).toBeCloseTo(0.0782, 4);
      expect(StatsUtils.getGoalieRawRating(goalieWith('19/22', '5/6', '1/1')) - base).toBeCloseTo(0.1082, 4);
      expect(StatsUtils.getGoalieRawRating(goalieWith('19/22', '4/5', '2/2')) - base).toBeCloseTo(0.074, 4);
      // A save turned into a goal, at any strength
      expect(StatsUtils.getGoalieRawRating(goalieWith('18/22', '4/5', '1/1')) - base).toBeCloseTo(-0.6, 4);
      expect(StatsUtils.getGoalieRawRating(goalieWith('19/22', '3/5', '1/1')) - base).toBeCloseTo(-0.6, 4);
    });

    it('should weight goals saved above average at 0.7 on a night above average', () => {
      // 1.96 goals above average
      const base = StatsUtils.getGoalieRawRating(goalieWith('22/22', '4/5', '1/1'));
      // One more saved shot: 0.7 x (1 - 0.903) + 0.02 of workload, and a save turned into a goal costs 0.7
      expect(StatsUtils.getGoalieRawRating(goalieWith('23/23', '4/5', '1/1')) - base).toBeCloseTo(0.0879, 4);
      expect(StatsUtils.getGoalieRawRating(goalieWith('21/22', '4/5', '1/1')) - base).toBeCloseTo(-0.7, 4);
      // 45 saves on 46 shots in a win: 5.75 + 0.7 x (45 - 0.903 x 46) + 0.02 x (46 - 26 x 3592 / 3600) + 0.3 = 8.87
      expect(StatsUtils.calculateGoalieHokMobRating(goalieWith('45/46', '0/0', '0/0', true, 'W'))).toBe(8.9);
    });

    it('should take the weight from the whole night, not each strength', () => {
      expect(StatsUtils.getGoalsSavedAboveAverageWeight(1.96)).toBe(0.7);
      expect(StatsUtils.getGoalsSavedAboveAverageWeight(0)).toBe(0.6);
      expect(StatsUtils.getGoalsSavedAboveAverageWeight(-1.04)).toBe(0.6);
      // Below average on the penalty kill, but above it for the night: (24 - 0.903 x 25) + (3 - 0.853 x 4) = 1.01
      expect(StatsUtils.getGoalieRawRating(goalieWith('24/25', '3/4')))
          .toBeCloseTo(5.75 + 0.7 * 1.013 + 0.02 * (29 - 26 * 3592 / 3600), 4);
    });

    it('should rate the same save percentage about the same on few shots as on many', () => {
      // .900 at even strength on 20 and on 40 shots: only the workload term (20 x 0.02) and the 0.003 a shot under
      // the league average (x 0.6) tell them apart
      const fewShots = StatsUtils.getGoalieRawRating(goalieWith('18/20'));
      const manyShots = StatsUtils.getGoalieRawRating(goalieWith('36/40'));
      expect(manyShots - fewShots).toBeCloseTo(0.4 - 0.6 * 0.06, 4);
    });

    it('should add the win bonus, and the shutout bonus on top for a starter who let no shot in', () => {
      const noDecision = StatsUtils.getGoalieRawRating(goalieWith('26/26', '4/4'));
      // 0.3 for the win and 0.065 for each of the 30 shots
      expect(StatsUtils.getGoalieRawRating(goalieWith('26/26', '4/4', '0/0', true, 'W')) - noDecision)
          .toBeCloseTo(0.3 + 1.95, 4);
      // A reliever who let nothing in and got the win only gets the win
      expect(StatsUtils.getGoalieRawRating(goalieWith('26/26', '4/4', '0/0', false, 'W')) - noDecision)
          .toBeCloseTo(0.3, 4);
      // Neither for an overtime loss
      expect(StatsUtils.getGoalieRawRating(goalieWith('26/26', '4/4', '0/0', true, 'O'))).toBeCloseTo(noDecision, 4);
      // A win with a goal against is only the win
      expect(StatsUtils.getGoalieRawRating(goalieWith('25/26', '4/4', '0/0', true, 'W')) -
          StatsUtils.getGoalieRawRating(goalieWith('25/26', '4/4'))).toBeCloseTo(0.3, 4);
    });

    it('should rate a goalie who faced no shots 0', () => {
      const hellebuyck = boxscorePlayer<BoxscoreGoalie>(8476945);
      expect(hellebuyck.savePctg).toBeUndefined();
      expect(StatsUtils.calculateGoalieHokMobRating(hellebuyck)).toBe(0);
    });

    it('should keep the rating between 0 and 10', () => {
      // 5.75 + 0.6 x (10 - 0.903 x 30) + 0.02 x 4 = -4.42
      expect(StatsUtils.calculateGoalieHokMobRating(goalieWith('10/30'))).toBe(0);
      // A 60 shot shutout win: 5.75 + 0.7 x (60 - 0.903 x 60) + 0.02 x 34 + 0.3 + 0.065 x 60 = 14.70
      expect(StatsUtils.calculateGoalieHokMobRating(goalieWith('60/60', '0/0', '0/0', true, 'W'))).toBe(10);
    });

    it('should rate a shutout win of more than 30 shots a 10, and a quieter one less', () => {
      // 31 shots: 5.75 + 0.7 x (31 - 0.903 x 31) + 0.02 x (31 - 25.94) + 0.3 + 0.065 x 31 = 10.27
      expect(StatsUtils.calculateGoalieHokMobRating(goalieWith('31/31', '0/0', '0/0', true, 'W'))).toBe(10);
      // 20 shots: 5.75 + 0.7 x (20 - 0.903 x 20) + 0.02 x (20 - 25.94) + 0.3 + 0.065 x 20 = 8.59
      expect(StatsUtils.calculateGoalieHokMobRating(goalieWith('20/20', '0/0', '0/0', true, 'W'))).toBe(8.6);
    });
  });

  describe('calculateGoalieHokMobRating with goals and assists', () => {
    /** Shesterkin's real win in 2026020010, where he scored into the empty net. */
    const shesterkin = () => boxscorePlayer<BoxscoreGoalie>(8478048, 2026020010);

    it('should add a goalie\'s goal at a skater\'s 1.2', () => {
      // A win on 16/17 even strength and 8/8 power play (penalty kill), 24 saves on 25 shots in 60:00, above average
      // so at 0.7: 5.75 + 0.7 x (16 - 0.903 x 17) + 0.7 x (8 - 0.853 x 8) + 0.02 x (25 - 26) + 0.3 = 7.31
      expect(StatsUtils.calculateGoalieHokMobRating(shesterkin())).toBe(7.3);
      // ... + 1.2 for the goal = 8.51
      expect(StatsUtils.calculateGoalieHokMobRating(shesterkin(), {goals: 1, assists: 0})).toBe(8.5);
      expect(StatsUtils.getGoalieRawRating(shesterkin(), {goals: 1, assists: 0}) -
          StatsUtils.getGoalieRawRating(shesterkin())).toBeCloseTo(StatsUtils.goalWeight, 10);
    });

    it('should weight a goalie\'s assists like a skater\'s, by the split when it\'s known', () => {
      const withoutPoints = StatsUtils.getGoalieRawRating(shesterkin());
      const withAssists = (context: GoalieRatingContext) =>
          StatsUtils.getGoalieRawRating(shesterkin(), context) - withoutPoints;
      expect(withAssists({assists: 1, primaryAssists: 1, secondaryAssists: 0})).toBeCloseTo(0.6, 10);
      expect(withAssists({assists: 1, primaryAssists: 0, secondaryAssists: 1})).toBeCloseTo(0.4, 10);
      // The stats API has no split for a goalie, so his assists count the flat 0.5
      expect(withAssists({assists: 2})).toBeCloseTo(1.0, 10);
    });

    it('should still rate 0 a goalie who faced no shots, and cap at 10', () => {
      const backup = boxscorePlayer<BoxscoreGoalie>(8482193, 2026020010); // Garand, who didn't play
      expect(StatsUtils.calculateGoalieHokMobRating(backup, {goals: 1, assists: 1})).toBe(0);
      expect(StatsUtils.calculateGoalieHokMobRating(shesterkin(), {goals: 3, assists: 0})).toBe(10);
    });

    it('should not take anything off for missing or negative counts', () => {
      const rating = StatsUtils.calculateGoalieHokMobRating(shesterkin());
      expect(StatsUtils.calculateGoalieHokMobRating(shesterkin(), {})).toBe(rating);
      expect(StatsUtils.calculateGoalieHokMobRating(shesterkin(), {goals: null, assists: undefined})).toBe(rating);
      expect(StatsUtils.calculateGoalieHokMobRating(shesterkin(), {goals: -1, assists: -1})).toBe(rating);
    });
  });

  describe('getGoalieRatingContext', () => {
    it('should count a real goalie\'s goal from the scoring summary', () => {
      expect(StatsUtils.getGoalieRatingContext(mockGameLanding(2026020010), 8478048))
          .toEqual({goals: 1, assists: 0, primaryAssists: 0, secondaryAssists: 0});
      // Vasilevskiy, in the other net, had no points
      expect(StatsUtils.getGoalieRatingContext(mockGameLanding(2026020010), 8476883))
          .toEqual({goals: 0, assists: 0, primaryAssists: 0, secondaryAssists: 0});
    });

    it('should count a real goalie\'s primary assist', () => {
      expect(StatsUtils.getGoalieRatingContext(mockGoalieAssistLanding(), 8474593))
          .toEqual({goals: 0, assists: 1, primaryAssists: 1, secondaryAssists: 0});
    });

    it('should use the assist counts it is given', () => {
      const landing = mockGoalieAssistLanding();
      const assistCounts = StatsUtils.getAssistCounts(landing);
      expect(StatsUtils.getGoalieRatingContext(landing, 8474593, assistCounts))
          .toEqual(StatsUtils.getGoalieRatingContext(landing, 8474593));
    });

    it('should give no points without a scoring summary', () => {
      const none = {goals: 0, assists: 0, primaryAssists: 0, secondaryAssists: 0};
      expect(StatsUtils.getGoalieRatingContext(mockGameLanding(2026020056), 8478048)).toEqual(none);
      expect(StatsUtils.getGoalieRatingContext(undefined, 8478048)).toEqual(none);
    });
  });

  describe('getGoalieShutoutBonus', () => {
    it('should pay 0.065 a shot for a shutout win, and nothing otherwise', () => {
      const comrie = boxscorePlayer<BoxscoreGoalie>(8477480);
      expect(StatsUtils.getGoalieShutoutBonus(comrie)).toBe(0); // 29 saves on 31 shots
      expect(StatsUtils.getGoalieShutoutBonus({...comrie, saves: 31})).toBeCloseTo(2.015, 4);
      expect(StatsUtils.getGoalieShutoutBonus({...comrie, saves: 31, starter: false})).toBe(0);
      expect(StatsUtils.getGoalieShutoutBonus(undefined)).toBe(0);
    });
  });

  describe('getGoalieExpectedShotsAgainst', () => {
    it('should scale the average shots by the time on ice, up to a full game', () => {
      const goalie = boxscorePlayer<BoxscoreGoalie>(8476412);
      expect(StatsUtils.getGoalieExpectedShotsAgainst({...goalie, toi: '20:00'})).toBeCloseTo(26 / 3, 4);
      expect(StatsUtils.getGoalieExpectedShotsAgainst({...goalie, toi: '30:00'})).toBe(13);
      expect(StatsUtils.getGoalieExpectedShotsAgainst({...goalie, toi: '60:00'})).toBe(26);
      // Overtime doesn't raise it
      expect(StatsUtils.getGoalieExpectedShotsAgainst({...goalie, toi: '65:00'})).toBe(26);
      // Binnington's real 56:13
      expect(StatsUtils.getGoalieExpectedShotsAgainst(goalie)).toBeCloseTo(26 * 3373 / 3600, 4);
    });

    it('should use a full game when the time on ice is missing or unreadable', () => {
      const goalie = boxscorePlayer<BoxscoreGoalie>(8476412);
      expect(StatsUtils.getGoalieExpectedShotsAgainst({...goalie, toi: undefined})).toBe(26);
      expect(StatsUtils.getGoalieExpectedShotsAgainst({...goalie, toi: '-'})).toBe(26);
      expect(StatsUtils.getGoalieExpectedShotsAgainst(undefined)).toBe(26);
    });
  });

  describe('getGoalsSavedAboveAverage', () => {
    it('should add up the saves above the league average at every strength', () => {
      // Comrie: (28 - 0.903 x 30) + (1 - 0.853 x 1) + 0 = 1.057
      expect(StatsUtils.getGoalsSavedAboveAverage(boxscorePlayer(8477480))).toBeCloseTo(1.057, 4);
      // Binnington: (8 - 0.903 x 11) + (4 - 0.853 x 4) + (1 - 0.910 x 1) = -1.255
      expect(StatsUtils.getGoalsSavedAboveAverage(boxscorePlayer(8476412))).toBeCloseTo(-1.255, 4);
    });

    it('should be 0 for a goalie who faced no shots or has no splits', () => {
      expect(StatsUtils.getGoalsSavedAboveAverage(boxscorePlayer(8476945))).toBe(0);
      expect(StatsUtils.getGoalsSavedAboveAverage({} as BoxscoreGoalie)).toBe(0);
      expect(StatsUtils.getGoalsSavedAboveAverage(undefined)).toBe(0);
    });
  });

  describe('isShutoutWin', () => {
    it('should need a start, a win and no goal against', () => {
      const comrie = boxscorePlayer<BoxscoreGoalie>(8477480);
      expect(comrie.starter).toBeTrue();
      expect(comrie.decision).toBe('W');
      expect(StatsUtils.isShutoutWin(comrie)).toBeFalse(); // 29 saves on 31 shots
      expect(StatsUtils.isShutoutWin({...comrie, saves: 31})).toBeTrue();
      expect(StatsUtils.isShutoutWin({...comrie, saves: 31, starter: false})).toBeFalse();
      expect(StatsUtils.isShutoutWin({...comrie, saves: 31, decision: 'O'})).toBeFalse();
      expect(StatsUtils.isShutoutWin({...comrie, saves: 31, decision: undefined})).toBeFalse();
    });

    it('should not count a win without a shot faced', () => {
      expect(StatsUtils.isShutoutWin({...boxscorePlayer<BoxscoreGoalie>(8476945), starter: true, decision: 'W'}))
          .toBeFalse();
      expect(StatsUtils.isShutoutWin(undefined)).toBeFalse();
    });
  });

  describe('getLegacyGoalieRawRating', () => {
    it('should keep the formula before goals saved above average', () => {
      // Comrie: 5 + 28/6 + 1/5 - 2 = 7.87
      expect(StatsUtils.getLegacyGoalieRawRating(boxscorePlayer(8477480))).toBeCloseTo(7.8667, 4);
      // Binnington: 5 + 8/6 + 4/5 + 1/6 - 3 = 4.3
      expect(StatsUtils.getLegacyGoalieRawRating(boxscorePlayer(8476412))).toBeCloseTo(4.3, 4);
    });
  });

  describe('getSaves and getShots', () => {
    it('should read the saves and the shots of a saves/shots string', () => {
      expect(StatsUtils.getSaves('28/30')).toBe(28);
      expect(StatsUtils.getShots('28/30')).toBe(30);
      expect(StatsUtils.getSaves('0/0')).toBe(0);
      expect(StatsUtils.getShots('0/0')).toBe(0);
    });

    it('should return 0 for a missing or unreadable string', () => {
      for (const split of [null, '', '-', '28']) {
        expect(StatsUtils.getShots(split)).toBe(0);
      }
      expect(StatsUtils.getSaves(null)).toBe(0);
      expect(StatsUtils.getSaves('')).toBe(0);
      expect(StatsUtils.getSaves('-')).toBe(0);
    });
  });

  describe('getTimeOnIceSeconds', () => {
    it('should convert a time on ice to seconds', () => {
      expect(StatsUtils.getTimeOnIceSeconds('59:52')).toBe(3592);
      expect(StatsUtils.getTimeOnIceSeconds('00:00')).toBe(0);
      expect(StatsUtils.getTimeOnIceSeconds(null)).toBe(0);
    });
  });

  describe('getAssistCounts', () => {
    it('should split the assists of a real game into primary and secondary', () => {
      const assistCounts = StatsUtils.getAssistCounts(mockGameLanding(2025021057));
      expect(assistCounts.get(8480289)).toEqual({primary: 1, secondary: 1, powerPlay: 0}); // Barron, 2 assists
      expect(assistCounts.get(8477504)).toEqual({primary: 1, secondary: 0, powerPlay: 0}); // Morrissey
      expect(assistCounts.get(8477938)).toEqual({primary: 0, secondary: 1, powerPlay: 0}); // Fleury
      expect(assistCounts.has(8476460)).toBeFalse(); // Scheifele, who scored but assisted on nothing
    });

    it('should count the assists on a real power play goal', () => {
      // Carolina scored one power play goal in 2025030414, assisted by Gostisbehere then Aho.
      const assistCounts = StatsUtils.getAssistCounts(mockGameLanding(2025030414));
      expect(assistCounts.get(8476906)).toEqual({primary: 1, secondary: 0, powerPlay: 1});
      expect(assistCounts.get(8478427)).toEqual({primary: 0, secondary: 1, powerPlay: 1});
      // Ehlers assisted on two even strength goals.
      expect(assistCounts.get(8477940)).toEqual({primary: 1, secondary: 1, powerPlay: 0});
      expect([...assistCounts.values()].reduce((total, counts) => total + counts.powerPlay, 0)).toBe(2);
    });

    it('should agree with the play-by-play on who assisted and in which order', () => {
      const assistCounts = StatsUtils.getAssistCounts(mockGameLanding(2025021057));
      const fromPlayByPlay = new Map<number, number[]>();
      mockGamePlayByPlay(2025021057).plays.filter(play => play.typeDescKey === NhlPlayTypeEnum.GOAL).forEach(play => {
        [play.details?.assist1PlayerId, play.details?.assist2PlayerId].forEach((playerId, index) => {
          if (playerId == null) {
            return;
          }
          const counts = fromPlayByPlay.get(playerId) ?? [0, 0];
          counts[index]++;
          fromPlayByPlay.set(playerId, counts);
        });
      });
      expect(fromPlayByPlay.size).toBe(8);
      expect(assistCounts.size).toBe(fromPlayByPlay.size);
      fromPlayByPlay.forEach((counts, playerId) => {
        expect([assistCounts.get(playerId).primary, assistCounts.get(playerId).secondary]).toEqual(counts);
      });
    });

    it('should not count a shootout goal, which has no assists', () => {
      // 2025020952 went to a shootout, whose goal is in the scoring summary with an empty assists array.
      const shootoutGoals = mockGameLanding(2025020952).summary.scoring
          .filter(period => period.periodDescriptor.periodType === NhlPeriodTypeEnum.SHOOTOUT)
          .flatMap(period => period.goals);
      expect(shootoutGoals.length).toBe(1);
      expect(shootoutGoals[0].assists).toEqual([]);
      const credited = [...StatsUtils.getAssistCounts(mockGameLanding(2025020952)).values()]
          .reduce((total, counts) => total + counts.primary + counts.secondary, 0);
      expect(credited).toBe(7); // the 4 regulation goals' assists
    });

    it('should return an empty map without a scoring summary', () => {
      expect(StatsUtils.getAssistCounts(mockGameLanding(2026020056)).size).toBe(0);
      expect(StatsUtils.getAssistCounts(undefined).size).toBe(0);
      expect(StatsUtils.getAssistCounts({...mockGameLanding(2025021057), summary: undefined}).size).toBe(0);
    });
  });

  describe('getGamePlayers', () => {
    const rosterSpots = () => PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025021057));

    it('should list every dressed player of a team, best rated first, with full names', () => {
      const players = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots());
      expect(players.length).toBe(20);
      expect(players.slice(0, 3).map(player => [player.name, player.position, player.hokmobRating]))
          .toEqual([['Haydn Fleury', 'D', 7.9], ['Mark Scheifele', 'C', 7.1], ['Eric Comrie', 'G', 6.9]]);
      expect(players[players.length - 1].name).toBe('Connor Hellebuyck');
      expect(players.every(player => player.teamId === 52 && player.isHome)).toBeTrue();
      const ratings = players.map(player => player.hokmobRating);
      expect(ratings).toEqual([...ratings].sort((ratingA, ratingB) => ratingB - ratingA));
    });

    it('should keep the skater or goalie stats and the roster headshot', () => {
      const players = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), false, rosterSpots());
      const holloway = players.find(player => player.playerId === 8482077);
      expect(holloway.teamId).toBe(19);
      expect(holloway.isHome).toBeFalse();
      expect(holloway.skaterStats.goals).toBe(1);
      expect(holloway.goalieStats).toBeUndefined();
      expect(holloway.headshot).toBe('https://assets.nhle.com/mugs/nhl/20252026/STL/8482077.png');

      const binnington = players.find(player => player.playerId === 8476412);
      expect(binnington.goalieStats.saves).toBe(13);
      expect(binnington.skaterStats).toBeUndefined();
    });

    it('should scale the faceoff term by the play-by-play faceoff counts', () => {
      const faceoffCounts = PlayByPlayUtils.getFaceoffCounts(mockGamePlayByPlay(2025021057));
      const rating = (players: GamePlayer[], playerId: number) =>
          players.find(player => player.playerId === playerId).hokmobRating;
      const home = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots(), faceoffCounts);
      const away = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), false, rosterSpots(), faceoffCounts);
      expect(rating(home, 8476460)).toBe(7.1); // Scheifele, 17 faceoffs
      expect(rating(home, 8480014)).toBe(4.8); // Vilardi, a center without faceoffs
      expect(rating(away, 8482077)).toBe(7.6); // Holloway, a winger who won 2 of 10

      const withoutCounts = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots());
      expect(rating(withoutCounts, 8480014)).toBe(4.3);
      const ratings = home.map(player => player.hokmobRating);
      expect(ratings).toEqual([...ratings].sort((ratingA, ratingB) => ratingB - ratingA));
    });

    it('should weight assists by the landing assist counts', () => {
      const assistCounts = StatsUtils.getAssistCounts(mockGameLanding(2025021057));
      const rating = (players: GamePlayer[], playerId: number) =>
          players.find(player => player.playerId === playerId).hokmobRating;
      const withCounts = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots(), undefined,
          assistCounts);
      const withoutCounts = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots());

      // Fleury's one assist was a secondary one, so he loses 0.1 off the flat weight.
      expect(rating(withoutCounts, 8477938)).toBe(7.9);
      expect(rating(withCounts, 8477938)).toBe(7.8);
      // Morrissey's was primary.
      expect(rating(withCounts, 8477504)).toBe(rating(withoutCounts, 8477504) + 0.1);
      // Barron had one of each, so the split and the flat weight agree.
      expect(rating(withCounts, 8480289)).toBe(rating(withoutCounts, 8480289));
      // A player with no assists is unaffected, although the map has no entry for him.
      expect(rating(withCounts, 8476460)).toBe(rating(withoutCounts, 8476460));

      const ratings = withCounts.map(player => player.hokmobRating);
      expect(ratings).toEqual([...ratings].sort((ratingA, ratingB) => ratingB - ratingA));
    });

    it('should add the play-by-play penalties drawn to the rating context', () => {
      const playByPlay = mockGamePlayByPlay(2025021057);
      const player = (players: GamePlayer[], playerId: number) => players.find(p => p.playerId === playerId);
      const withCounts = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots(),
          PlayByPlayUtils.getFaceoffCounts(playByPlay), undefined, PlayByPlayUtils.getPenaltiesDrawnCounts(playByPlay));
      const withoutCounts = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots(),
          PlayByPlayUtils.getFaceoffCounts(playByPlay));

      // Vilardi drew a holding minor; Scheifele drew none, so he gets 0 rather than no count.
      expect(player(withCounts, 8480014).ratingContext.penaltiesDrawn).toBe(1);
      expect(player(withCounts, 8480014).hokmobRating).toBe(5.1);
      expect(player(withoutCounts, 8480014).hokmobRating).toBe(4.8);
      expect(player(withCounts, 8476460).ratingContext.penaltiesDrawn).toBe(0);
      expect(player(withCounts, 8476460).hokmobRating).toBe(player(withoutCounts, 8476460).hokmobRating);
      expect(player(withoutCounts, 8480014).ratingContext.penaltiesDrawn).toBeUndefined();

      const ratings = withCounts.map(p => p.hokmobRating);
      expect(ratings).toEqual([...ratings].sort((ratingA, ratingB) => ratingB - ratingA));
    });

    it('should rate a goalie\'s goal from the landing, which the boxscore doesn\'t have', () => {
      const shesterkin = (players: GamePlayer[]) => players.find(player => player.playerId === 8478048);
      const landing = mockGameLanding(2026020010);
      const withLanding = StatsUtils.getGamePlayers(mockGameBoxscore(2026020010), true, undefined, undefined,
          StatsUtils.getAssistCounts(landing), undefined, landing);
      const withoutLanding = StatsUtils.getGamePlayers(mockGameBoxscore(2026020010), true);
      expect(shesterkin(withLanding).goalieRatingContext)
          .toEqual({goals: 1, assists: 0, primaryAssists: 0, secondaryAssists: 0});
      expect(shesterkin(withLanding).hokmobRating).toBe(8.5);
      expect(shesterkin(withoutLanding).goalieRatingContext).toBeUndefined();
      expect(shesterkin(withoutLanding).hokmobRating).toBe(7.3);
    });

    it('should use the short name and the season headshot without roster spots', () => {
      const players = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true);
      const scheifele = players.find(player => player.playerId === 8476460);
      expect(scheifele.name).toBe('M. Scheifele');
      expect(scheifele.headshot).toBe('https://assets.nhle.com/mugs/nhl/20252026/WPG/8476460.png');
    });

    it('should return no players for a future game or a missing boxscore', () => {
      expect(StatsUtils.getGamePlayers(mockGameBoxscore(2026020056), true, rosterSpots())).toEqual([]);
      expect(StatsUtils.getGamePlayers(undefined, false)).toEqual([]);
    });
  });

  describe('formatSeconds', () => {
    it('should format a stats API time on ice', () => {
      expect(StatsUtils.formatSeconds(1021)).toBe('17:01');
      expect(StatsUtils.formatSeconds(1181.6133)).toBe('19:42');
      expect(StatsUtils.formatSeconds(3600)).toBe('60:00');
      expect(StatsUtils.formatSeconds(1664.2568)).toBe('27:44');
    });

    it('should format short times with two second digits', () => {
      expect(StatsUtils.formatSeconds(0)).toBe('0:00');
      expect(StatsUtils.formatSeconds(9)).toBe('0:09');
      expect(StatsUtils.formatSeconds(70)).toBe('1:10');
    });

    it('should return a dash for a missing or negative time', () => {
      expect(StatsUtils.formatSeconds(null)).toBe('-');
      expect(StatsUtils.formatSeconds(undefined)).toBe('-');
      expect(StatsUtils.formatSeconds(-1)).toBe('-');
    });
  });

  describe('toBoxscoreSkater', () => {
    /** Barbashev's stats API row for 2025030414, the game with a captured boxscore. */
    function statsApiSkater(): SkaterGameStats {
      return (mockPlayerStats(8477964).recentGames as SkaterGameStats[])
          .find(game => game.gameId === 2025030414);
    }

    it('should map a real game to the same stats as its boxscore', () => {
      const skater = StatsUtils.toBoxscoreSkater(statsApiSkater());
      const boxscoreSkater = boxscorePlayer<BoxscoreSkater>(8477964, 2025030414);
      expect(skater.playerId).toBe(8477964);
      expect(skater.name.default).toBe('Ivan Barbashev');
      expect(skater.position).toBe(boxscoreSkater.position);
      expect(skater.goals).toBe(boxscoreSkater.goals);
      expect(skater.assists).toBe(boxscoreSkater.assists);
      expect(skater.plusMinus).toBe(boxscoreSkater.plusMinus);
      expect(skater.pim).toBe(boxscoreSkater.pim);
      expect(skater.hits).toBe(boxscoreSkater.hits);
      expect(skater.sog).toBe(boxscoreSkater.sog);
      expect(skater.blockedShots).toBe(boxscoreSkater.blockedShots);
      expect(skater.giveaways).toBe(boxscoreSkater.giveaways);
      expect(skater.takeaways).toBe(boxscoreSkater.takeaways);
      expect(skater.powerPlayGoals).toBe(boxscoreSkater.powerPlayGoals);
      expect(skater.toi).toBe(boxscoreSkater.toi);
    });

    it('should give a real game the same rating as its boxscore', () => {
      expect(StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(statsApiSkater())))
          .toBe(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer<BoxscoreSkater>(8477964, 2025030414)));
      // 5 + 1 shot * 0.3 + 1 hit * 0.2 - 1 giveaway * 0.2, with no faceoff term for a winger.
      expect(StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(statsApiSkater()))).toBe(5.3);
    });

    it('should give a real game the same rating as its boxscore with faceoff counts', () => {
      const faceoffCounts = PlayByPlayUtils.getFaceoffCounts(mockGamePlayByPlay(2025030414));
      const game = statsApiSkater();
      expect(game.totalFaceoffs).toBe(0);
      expect(StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(game),
          {faceoffsTaken: game.totalFaceoffs}))
          .toBe(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer<BoxscoreSkater>(8477964, 2025030414),
              {faceoffsTaken: faceoffCounts.get(8477964) ?? 0}));
    });

    it('should give a real game the same rating as its boxscore with the assist split', () => {
      const assistCounts = StatsUtils.getAssistCounts(mockGameLanding(2025030414));
      const game = statsApiSkater();
      const fromStatsApi = StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(game), {
        primaryAssists: game.totalPrimaryAssists,
        secondaryAssists: game.totalSecondaryAssists,
        powerPlayAssists: game.ppAssists
      });
      expect(fromStatsApi).toBe(StatsUtils.calculateSkaterHokmobRating(
          boxscorePlayer<BoxscoreSkater>(8477964, 2025030414), {
            primaryAssists: assistCounts.get(8477964)?.primary ?? 0,
            secondaryAssists: assistCounts.get(8477964)?.secondary ?? 0,
            powerPlayAssists: assistCounts.get(8477964)?.powerPlay ?? 0
          }));
    });

    it('should give a real game the same rating as its boxscore with penalties drawn', () => {
      const penaltiesDrawnCounts = PlayByPlayUtils.getPenaltiesDrawnCounts(mockGamePlayByPlay(2025030414));
      const game = statsApiSkater();
      expect(game.penaltiesDrawn).toBe(1);
      const fromStatsApi = StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(game),
          {penaltiesDrawn: game.penaltiesDrawn});
      expect(fromStatsApi).toBe(5.6);
      expect(fromStatsApi).toBe(StatsUtils.calculateSkaterHokmobRating(
          boxscorePlayer<BoxscoreSkater>(8477964, 2025030414), {penaltiesDrawn: penaltiesDrawnCounts.get(8477964)}));
    });

    it('should map a faceoff percentage, and treat a player without faceoffs as 0', () => {
      const centre = {...statsApiSkater(), positionCode: 'C', faceoffWinPct: 0.56362};
      expect(StatsUtils.toBoxscoreSkater(centre).faceoffWinningPctg).toBe(0.56362);
      expect(StatsUtils.toBoxscoreSkater(statsApiSkater()).faceoffWinningPctg).toBe(0);
    });

    it('should treat missing stats as 0, so a row without the realtime report still rates', () => {
      const skater = {playerId: 1, positionCode: 'D', skaterFullName: 'No Stats'} as SkaterGameStats;
      expect(StatsUtils.toBoxscoreSkater(skater).hits).toBe(0);
      expect(StatsUtils.toBoxscoreSkater(skater).blockedShots).toBe(0);
      expect(StatsUtils.toBoxscoreSkater(skater).toi).toBe('-');
      expect(StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(skater))).toBe(5);
    });
  });

  describe('toBoxscoreGoalie', () => {
    /** Bussi's stats API row for 2025030414, the game he won 5-3. */
    function statsApiGoalie(): GoalieGameStats {
      return (mockPlayerStats(8483548).recentGames as GoalieGameStats[])
          .find(game => game.gameId === 2025030414);
    }

    it('should map a real game to the same stats as its boxscore', () => {
      const goalie = StatsUtils.toBoxscoreGoalie(statsApiGoalie());
      const boxscoreGoalie = boxscorePlayer<BoxscoreGoalie>(8483548, 2025030414);
      expect(goalie.playerId).toBe(8483548);
      expect(goalie.name.default).toBe('Brandon Bussi');
      expect(goalie.position).toBe('G');
      expect(goalie.evenStrengthShotsAgainst).toBe(boxscoreGoalie.evenStrengthShotsAgainst);
      expect(goalie.powerPlayShotsAgainst).toBe(boxscoreGoalie.powerPlayShotsAgainst);
      expect(goalie.shorthandedShotsAgainst).toBe(boxscoreGoalie.shorthandedShotsAgainst);
      expect(goalie.saveShotsAgainst).toBe(boxscoreGoalie.saveShotsAgainst);
      expect(goalie.shotsAgainst).toBe(boxscoreGoalie.shotsAgainst);
      expect(goalie.saves).toBe(boxscoreGoalie.saves);
      expect(goalie.goalsAgainst).toBe(boxscoreGoalie.goalsAgainst);
      expect(goalie.evenStrengthGoalsAgainst).toBe(boxscoreGoalie.evenStrengthGoalsAgainst);
      expect(goalie.powerPlayGoalsAgainst).toBe(boxscoreGoalie.powerPlayGoalsAgainst);
      expect(goalie.decision).toBe(boxscoreGoalie.decision);
      expect(goalie.starter).toBe(boxscoreGoalie.starter);
      expect(goalie.toi).toBe(boxscoreGoalie.toi);
    });

    it('should give a real game the same rating as its boxscore', () => {
      expect(StatsUtils.calculateGoalieHokMobRating(StatsUtils.toBoxscoreGoalie(statsApiGoalie())))
          .toBe(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer<BoxscoreGoalie>(8483548, 2025030414)));
      // A win on 12/15 even strength, 5/5 power play (penalty kill), 1/1 shorthanded: 5.75 + 0.6 x (12 - 0.903 x 15)
      // + 0.6 x (5 - 0.853 x 5) + 0.6 x (1 - 0.910 x 1) + 0.02 x (21 - 26) + 0.3 = 5.52
      expect(StatsUtils.calculateGoalieHokMobRating(StatsUtils.toBoxscoreGoalie(statsApiGoalie()))).toBe(5.5);
    });

    it('should mark an overtime loss and a regulation loss', () => {
      expect(StatsUtils.toBoxscoreGoalie({...statsApiGoalie(), wins: 0, losses: 1}).decision).toBe('L');
      expect(StatsUtils.toBoxscoreGoalie({...statsApiGoalie(), wins: 0, otLosses: 1}).decision).toBe('O');
      expect(StatsUtils.toBoxscoreGoalie({...statsApiGoalie(), wins: 0}).decision).toBeUndefined();
    });

    it('should leave out the saves by strength when the report is missing, and rate the goalie 0 without saves', () => {
      const goalie = {playerId: 1, goalieFullName: 'No Stats', shotsAgainst: 10, saves: 9} as GoalieGameStats;
      expect(StatsUtils.toBoxscoreGoalie(goalie).evenStrengthShotsAgainst).toBeUndefined();
      expect(StatsUtils.toBoxscoreGoalie(goalie).saveShotsAgainst).toBe('9/10');
      expect(StatsUtils.calculateGoalieHokMobRating(StatsUtils.toBoxscoreGoalie(goalie))).toBe(0);
    });
  });

  describe('calculateSkaterGameRating and calculateGoalieGameRating', () => {
    function statsApiGame<T extends SkaterGameStats | GoalieGameStats>(playerId: 8477964 | 8483548): T {
      return (mockPlayerStats(playerId).recentGames as T[]).find(game => game.gameId === 2025030414);
    }

    it('should rate a real skater row with its faceoffs, assist split, power play assists and penalties drawn', () => {
      const game = statsApiGame<SkaterGameStats>(8477964);
      expect(StatsUtils.calculateSkaterGameRating(game)).toBe(StatsUtils.calculateSkaterHokmobRating(
          StatsUtils.toBoxscoreSkater(game), {
            faceoffsTaken: game.totalFaceoffs,
            primaryAssists: game.totalPrimaryAssists,
            secondaryAssists: game.totalSecondaryAssists,
            powerPlayAssists: game.ppAssists,
            penaltiesDrawn: game.penaltiesDrawn
          }));
      // 5 + 1 shot * 0.3 + 1 hit * 0.2 - 1 giveaway * 0.2 + 1 penalty drawn * 0.3
      expect(StatsUtils.calculateSkaterGameRating(game)).toBe(5.6);
    });

    it('should rate a real goalie row like its boxscore', () => {
      expect(StatsUtils.calculateGoalieGameRating(statsApiGame<GoalieGameStats>(8483548)))
          .toBe(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer<BoxscoreGoalie>(8483548, 2025030414)));
    });

    it('should add a goalie row\'s goals and assists, its assists at the flat weight', () => {
      const game = statsApiGame<GoalieGameStats>(8483548);
      expect(StatsUtils.toGoalieRatingContext(game)).toEqual({goals: 0, assists: 0});
      const withPoints = {...game, goals: 1, assists: 1};
      expect(StatsUtils.toGoalieRatingContext(withPoints)).toEqual({goals: 1, assists: 1});
      // 5.518 + 1.2 + 0.5
      expect(StatsUtils.getGoalieGameRawRating(withPoints)).toBeCloseTo(7.218, 4);
      expect(StatsUtils.calculateGoalieGameRating(withPoints)).toBe(7.2);
    });

    it('should give a goalie row without goals or assists no points', () => {
      const game = {...statsApiGame<GoalieGameStats>(8483548), goals: undefined, assists: undefined};
      expect(StatsUtils.toGoalieRatingContext(game)).toEqual({goals: 0, assists: 0});
      expect(StatsUtils.calculateGoalieGameRating(game)).toBe(5.5);
    });

    it('should give the uncapped totals, which round to the ratings below 10', () => {
      expect(StatsUtils.getSkaterGameRawRating(statsApiGame<SkaterGameStats>(8477964))).toBeCloseTo(5.6, 5);
      // 5.75 + 0.6 x (12 - 0.903 x 15) + 0.6 x (5 - 0.853 x 5) + 0.6 x (1 - 0.910 x 1) + 0.02 x (21 - 26) + 0.3
      expect(StatsUtils.getGoalieGameRawRating(statsApiGame<GoalieGameStats>(8483548))).toBeCloseTo(5.518, 4);
    });
  });

  describe('getSkaterRawRating and getGoalieRawRating', () => {
    it('should give the total of a rating capped at 10', () => {
      // Scheifele's real game (7.106), with 3 more goals at 1.2 each
      const scheifele = boxscorePlayer<BoxscoreSkater>(8476460);
      const hatTrickMore = {...scheifele, goals: scheifele.goals + 3, sog: scheifele.sog + 3};
      expect(StatsUtils.getSkaterRawRating(scheifele)).toBeCloseTo(7.106, 3);
      expect(StatsUtils.getSkaterRawRating(hatTrickMore)).toBeCloseTo(10.706, 3);
      expect(StatsUtils.calculateSkaterHokmobRating(hatTrickMore)).toBe(10);
    });

    it('should give the total of a goalie rating kept between 0 and 10', () => {
      const goalie = boxscorePlayer<BoxscoreGoalie>(8483548, 2025030414);
      // 15 more even strength goals against than his real 12/15: 5.518 - 15 x 0.6 x 0.903 + 15 x 0.02 of workload
      const shelled = {...goalie, evenStrengthShotsAgainst: '12/30', shotsAgainst: goalie.shotsAgainst + 15};
      expect(StatsUtils.getGoalieRawRating(shelled)).toBeCloseTo(-2.309, 4);
      expect(StatsUtils.calculateGoalieHokMobRating(shelled)).toBe(0);
    });
  });

  describe('sorting', () => {
    it('should sort goalies by time on ice, most first', () => {
      const goalies = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), false).filter(player => player.goalieStats);
      expect(goalies.map(goalie => goalie.goalieStats.toi)).toEqual(['56:13', '00:00']);
      const sorted = [...goalies].reverse().sort((goalieA, goalieB) => StatsUtils.sortByGoalieTimeOnIce(goalieA, goalieB));
      expect(sorted.map(goalie => goalie.playerId)).toEqual([8476412, 8480981]);
    });

    it('should sort players by rating, best first', () => {
      const players = [{hokmobRating: 6.1}, {hokmobRating: 8.2}, {hokmobRating: 0}] as GamePlayer[];
      expect(players.sort((playerA, playerB) => StatsUtils.sortByHokMobRating(playerA, playerB))
          .map(player => player.hokmobRating)).toEqual([8.2, 6.1, 0]);
    });

    it('should sort star players ahead of the rest, the bigger star first', () => {
      // Martin Necas is the second star forward of Colorado, Nathan MacKinnon its biggest, and Jalen Chatfield is
      // not a star anywhere
      const players = [{playerId: 8480039}, {playerId: 8478970}, {playerId: 8477492}] as GamePlayer[];
      expect(players.sort((playerA, playerB) => StatsUtils.sortByStarPlayer(playerA, playerB))
          .map(player => player.playerId)).toEqual([8477492, 8480039, 8478970]);
      expect(StatsUtils.sortByStarPlayer({playerId: 8478970} as GamePlayer, {} as GamePlayer)).toBe(0);
    });

    it('should list a star ahead of an equally rated teammate, but never ahead of a better rated one', () => {
      // Carolina, where Sebastian Aho leads the star forwards and Jaccob Slavin the defensemen, both rated 6.2 here
      const faceoffCounts = PlayByPlayUtils.getFaceoffCounts(mockGamePlayByPlay(2025030414));
      const players = StatsUtils.getGamePlayers(mockGameBoxscore(2025030414), false, undefined, faceoffCounts);
      const rated = (rating: number) => players.filter(player => player.hokmobRating === rating)
          .map(player => player.playerId);
      // Shayne Gostisbehere is the second star defenseman and Taylor Hall is no star, so they follow
      expect(rated(6.2)).toEqual([8478427, 8476958, 8476906, 8475791]);
      // Jordan Staal, Nikolaj Ehlers and Logan Stankoven are rated better and still lead the list
      expect(players.slice(0, 3).map(player => player.playerId)).toEqual([8473533, 8477940, 8482702]);
    });
  });
});
