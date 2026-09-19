import {StatsUtils} from "@shared/utils/stats-utils";
import {PlayByPlayUtils} from "@shared/utils/play-by-play-utils";
import {BoxscoreGoalie, BoxscoreSkater, GamePlayer} from "@shared/models/nhl-web-api/boxscore.model";
import {
  MockGamecenterGameId,
  mockGameBoxscore,
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
      // 5 + 1.1 + 0.9 + 0.2 - 0.4 + (0.706 - 0.5) = 7.006
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8476460))).toBe(7.0);
    });

    it('should scale the faceoff term by the faceoffs taken, up to 10', () => {
      // Scheifele took 17, so his 70.6% counts fully.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8476460), 17)).toBe(7.0);
      // Holloway, a winger, won 2 of 10: 7.8 + (0.2 - 0.5) = 7.5.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8482077), 10)).toBe(7.5);
      // Suter won 1 of 4: 5.95 + (0.25 - 0.5) * 0.4 = 5.85.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8480459), 4)).toBe(5.8);
    });

    it('should not take the faceoff term from a center who took no faceoffs', () => {
      // Vilardi: a center with 0% and no faceoff plays, who got the full -0.5 without a count.
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8480014))).toBe(4.3);
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8480014), 0)).toBe(4.8);
    });

    it('should ignore the faceoff percentage of a player who is not a center without a faceoff count', () => {
      const scheifele = boxscorePlayer<BoxscoreSkater>(8476460);
      scheifele.position = 'L';
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(6.8);
    });

    it('should rate real skaters with positive and negative plus/minus', () => {
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8477938))).toBe(7.8); // Fleury, +2
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8482077))).toBe(7.8); // Holloway, +1, winger with faceoffs
      expect(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer(8479385))).toBe(3.6); // Kyrou, -3
    });

    it('should not count the 5 minutes of a major penalty, and cap the penalty deduction at 3', () => {
      const scheifele = boxscorePlayer<BoxscoreSkater>(8476460);
      scheifele.pim = 5;
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(7.0);
      scheifele.pim = 7;
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(6.5);
      scheifele.pim = 20;
      expect(StatsUtils.calculateSkaterHokmobRating(scheifele)).toBe(4.0);
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
    it('should rate a real goalie from his even strength and power play saves', () => {
      // Comrie: 28/30 even strength, 1/1 power play, 29 saves on 31 shots: 5 + 28/6 + 1/5 - 2 = 7.87
      expect(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer(8477480))).toBe(7.9);
      // Binnington: 8/11 even strength, 4/4 power play, 13 saves on 16 shots: 5 + 8/6 + 4/5 - 3 = 4.13
      expect(StatsUtils.calculateGoalieHokMobRating(boxscorePlayer(8476412))).toBe(4.1);
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

  describe('getGamePlayers', () => {
    const rosterSpots = () => PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025021057));

    it('should list every dressed player of a team, best rated first, with full names', () => {
      const players = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots());
      expect(players.length).toBe(20);
      expect(players.slice(0, 3).map(player => [player.name, player.position, player.hokmobRating]))
          .toEqual([['Eric Comrie', 'G', 7.9], ['Haydn Fleury', 'D', 7.8], ['Mark Scheifele', 'C', 7.0]]);
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
      expect(rating(home, 8476460)).toBe(7.0); // Scheifele, 17 faceoffs
      expect(rating(home, 8480014)).toBe(4.8); // Vilardi, a center without faceoffs
      expect(rating(away, 8482077)).toBe(7.5); // Holloway, a winger who won 2 of 10

      const withoutCounts = StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), true, rosterSpots());
      expect(rating(withoutCounts, 8480014)).toBe(4.3);
      const ratings = home.map(player => player.hokmobRating);
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
      expect(StatsUtils.calculateSkaterHokmobRating(StatsUtils.toBoxscoreSkater(game), game.totalFaceoffs))
          .toBe(StatsUtils.calculateSkaterHokmobRating(boxscorePlayer<BoxscoreSkater>(8477964, 2025030414),
              faceoffCounts.get(8477964) ?? 0));
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
      // 5 + 12 even strength saves / 6 + 5 power play saves / 5 - 3 goals against = 5.0
      expect(StatsUtils.calculateGoalieHokMobRating(StatsUtils.toBoxscoreGoalie(statsApiGoalie()))).toBe(5.0);
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

    it('should sort by rating with the star boost, leaving the ratings themselves alone', () => {
      // Kyle Connor is one of the Winnipeg stars, Morgan Barron is not
      const connor = {playerId: 8478398, hokmobRating: 6.4} as GamePlayer;
      const barron = {playerId: 8480289, hokmobRating: 6.5} as GamePlayer;
      expect(StatsUtils.starRatingBoost).toBe(0.5);
      expect(StatsUtils.getSortRating(connor)).toBe(6.9);
      expect(StatsUtils.getSortRating(barron)).toBe(6.5);
      expect(connor.hokmobRating).toBe(6.4);
      expect(StatsUtils.sortByBoostedRating(connor, barron)).toBeLessThan(0);
    });

    it('should keep a player rated more than the boost above a star, and rate a missing player 0', () => {
      // Connor cannot catch a teammate rated 7.0, only one within half a point of him
      const connor = {playerId: 8478398, hokmobRating: 6.4} as GamePlayer;
      expect(StatsUtils.sortByBoostedRating(connor, {playerId: 8480289, hokmobRating: 7.0} as GamePlayer))
          .toBeGreaterThan(0);
      expect(StatsUtils.sortByBoostedRating(connor, {playerId: 8480289, hokmobRating: 6.9} as GamePlayer)).toBe(0);
      expect(StatsUtils.getSortRating({playerId: 8480289} as GamePlayer)).toBe(0);
      expect(StatsUtils.getSortRating(undefined)).toBe(0);
    });

    it('should sort star players ahead of the rest, the bigger star first', () => {
      // Cale Makar is the second star of Colorado, Nathan MacKinnon its biggest, and Jalen Chatfield is not a star anywhere
      const players = [{playerId: 8480069}, {playerId: 8478970}, {playerId: 8477492}] as GamePlayer[];
      expect(players.sort((playerA, playerB) => StatsUtils.sortByStarPlayer(playerA, playerB))
          .map(player => player.playerId)).toEqual([8477492, 8480069, 8478970]);
      expect(StatsUtils.sortByStarPlayer({playerId: 8478970} as GamePlayer, {} as GamePlayer)).toBe(0);
    });

    it('should list a star ahead of an equally rated teammate, but never ahead of a better rated one', () => {
      // Carolina, where Sebastian Aho and Jaccob Slavin are the stars, both rated 6.2 in this game
      const faceoffCounts = PlayByPlayUtils.getFaceoffCounts(mockGamePlayByPlay(2025030414));
      const players = StatsUtils.getGamePlayers(mockGameBoxscore(2025030414), false, undefined, faceoffCounts);
      const rated = (rating: number) => players.filter(player => player.hokmobRating === rating)
          .map(player => player.playerId);
      // Taylor Hall and Shayne Gostisbehere are rated 6.2 too, and come after the two stars
      expect(rated(6.2)).toEqual([8478427, 8476958, 8475791, 8476906]);
      // Jordan Staal, Nikolaj Ehlers and Logan Stankoven are rated better and still lead the list
      expect(players.slice(0, 3).map(player => player.playerId)).toEqual([8473533, 8477940, 8482702]);
    });
  });
});
