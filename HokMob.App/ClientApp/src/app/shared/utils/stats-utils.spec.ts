import {StatsUtils} from "@shared/utils/stats-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {NhlPeriodTypeEnum} from "@shared/enums/nhl-period-type.enum";
import {NhlPlayTypeEnum} from "@shared/enums/nhl-play-type.enum";
import {BoxscoreGoalie, BoxscoreSkater, GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {
  MockGamecenterGameId,
  mockGameBoxscore,
  mockGameLanding,
  mockGamePlayByPlay,
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
  });

  describe('calculateGoalieHokMobRating', () => {
    it('should rate a real goalie from his saves at every strength', () => {
      // Comrie: 28/30 even strength, 1/1 power play, 0/0 shorthanded, 29 saves on 31 shots: 5 + 28/6 + 1/5 - 2 = 7.87
      expect(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer(8477480))).toBe(7.9);
      // Binnington: 8/11 even strength, 4/4 power play, 1/1 shorthanded, 13 saves on 16 shots:
      // 5 + 8/6 + 4/5 + 1/6 - 3 = 4.3
      expect(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer(8476412))).toBe(4.3);
    });

    it('should pay a save made while his team is on the power play like one at even strength', () => {
      const comrie = boxscorePlayer<BoxscoreGoalie>(8477480);
      const withoutShorthandedShot = StatsUtils.calculateGoalieHokMobRating(comrie);
      // One more shot faced while the Jets had the man advantage: 7.87 + 1/6 = 8.03
      comrie.shorthandedShotsAgainst = '1/1';
      comrie.shotsAgainst = 32;
      comrie.saves = 30;
      expect(StatsUtils.calculateGoalieHokMobRating(comrie)).toBe(8.0);
      expect(StatsUtils.calculateGoalieHokMobRating(comrie)).toBeGreaterThan(withoutShorthandedShot);
      // Scored on instead: the goal costs 1 and the shot earns nothing, 7.87 - 1 = 6.87
      comrie.shorthandedShotsAgainst = '0/1';
      comrie.saves = 29;
      expect(StatsUtils.calculateGoalieHokMobRating(comrie)).toBe(6.9);
    });

    it('should rate a goalie who faced no shots 0', () => {
      const hellebuyck = boxscorePlayer<BoxscoreGoalie>(8476945);
      expect(hellebuyck.savePctg).toBeUndefined();
      expect(StatsUtils.calculateGoalieHokMobRating(hellebuyck)).toBe(0);
    });

    it('should keep the rating between 0 and 10', () => {
      const comrie = boxscorePlayer<BoxscoreGoalie>(8477480);
      comrie.saves = 19;
      expect(StatsUtils.calculateGoalieHokMobRating(comrie)).toBe(0);
      comrie.saves = 31;
      comrie.evenStrengthShotsAgainst = '60/60';
      expect(StatsUtils.calculateGoalieHokMobRating(comrie)).toBe(10);
    });
  });

  describe('getSaves', () => {
    it('should read the saves of a saves/shots string', () => {
      expect(StatsUtils.getSaves('28/30')).toBe(28);
      expect(StatsUtils.getSaves('0/0')).toBe(0);
    });

    it('should return 0 for a missing or unreadable string', () => {
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
          .toEqual([['Haydn Fleury', 'D', 7.9], ['Eric Comrie', 'G', 7.9], ['Mark Scheifele', 'C', 7.1]]);
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
      // 5 + 12 even strength saves / 6 + 5 power play saves / 5 + 1 shorthanded save / 6 - 3 goals against = 5.17
      expect(StatsUtils.calculateGoalieHokMobRating(StatsUtils.toBoxscoreGoalie(statsApiGoalie()))).toBe(5.2);
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

    it('should give the uncapped totals, which round to the ratings below 10', () => {
      expect(StatsUtils.getSkaterGameRawRating(statsApiGame<SkaterGameStats>(8477964))).toBeCloseTo(5.6, 5);
      // 5 + 12 / 6 + 5 / 5 + 1 / 6 - 3
      expect(StatsUtils.getGoalieGameRawRating(statsApiGame<GoalieGameStats>(8483548))).toBeCloseTo(5.1667, 4);
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
      const shelled = {...goalie, shotsAgainst: goalie.shotsAgainst + 8};
      // 5.17 - 8 more goals against
      expect(StatsUtils.getGoalieRawRating(shelled)).toBeCloseTo(-2.8333, 4);
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
