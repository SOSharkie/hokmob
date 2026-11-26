import {PlayerPercentileUtils} from './player-percentile-utils';
import {
  mockEdgeSeason,
  mockLeagueGoalies,
  mockLeaguePlayerRows,
  mockLeagueSkaters,
  mockNstPlayerRows
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {LeagueGoalieStats, LeaguePlayers, LeagueSkaterStats} from '@shared/models/nhl-stats-api/league-players.model';

describe('PlayerPercentileUtils', () => {

  function skaters(): LeaguePlayers<LeagueSkaterStats> {
    return mockLeaguePlayerRows(mockLeagueSkaters());
  }

  function goalies(): LeaguePlayers<LeagueGoalieStats> {
    return mockLeaguePlayerRows(mockLeagueGoalies());
  }

  function trait(traits: ReturnType<typeof PlayerPercentileUtils.getPlayerTraits>, key: string) {
    return traits.traits.find(item => item.key === key);
  }

  describe('getPositionGroup', () => {
    it('should group centers and wingers as forwards, and keep defensemen and goalies apart', () => {
      expect(['C', 'L', 'R'].map(code => PlayerPercentileUtils.getPositionGroup(code))).toEqual(['F', 'F', 'F']);
      expect(PlayerPercentileUtils.getPositionGroup('D')).toBe('D');
      expect(PlayerPercentileUtils.getPositionGroup('G')).toBe('G');
    });

    it('should count a missing position as a forward', () => {
      expect(PlayerPercentileUtils.getPositionGroup(undefined)).toBe('F');
    });
  });

  describe('getMinGames', () => {
    it('should ask for 20 games in a full season', () => {
      expect(PlayerPercentileUtils.getMinGames(82)).toBe(20);
      expect(PlayerPercentileUtils.getMinGames(84)).toBe(20);
    });

    it('should scale the minimum to the most games a team has played', () => {
      // The captured 2026-27 season: 26 games
      expect(PlayerPercentileUtils.getMinGames(mockLeagueSkaters().mostTeamGames)).toBe(7);
      // The 48 game 2012-13 season
      expect(PlayerPercentileUtils.getMinGames(48)).toBe(12);
    });

    it('should ask for at least 1 game', () => {
      expect(PlayerPercentileUtils.getMinGames(0)).toBe(1);
      expect(PlayerPercentileUtils.getMinGames(null)).toBe(1);
    });
  });

  describe('getPer60', () => {
    it('should give a count per 60 minutes of ice time', () => {
      expect(PlayerPercentileUtils.getPer60(2, 1800)).toBe(4);
    });

    it('should give nothing without ice time or a count', () => {
      expect(PlayerPercentileUtils.getPer60(2, 0)).toBeUndefined();
      expect(PlayerPercentileUtils.getPer60(null, 1800)).toBeUndefined();
    });
  });

  describe('getPercentile', () => {
    it('should give the share of the pool a value is ahead of, with ties counted as half', () => {
      expect(PlayerPercentileUtils.getPercentile(3, [1, 2, 3, 4])).toBe(62.5);
      expect(PlayerPercentileUtils.getPercentile(2, [1, 2, 2, 4])).toBe(50);
      // Every value tied
      expect(PlayerPercentileUtils.getPercentile(0, [0, 0, 0])).toBe(50);
    });

    it('should reach 0 and 100 for a value outside the pool', () => {
      expect(PlayerPercentileUtils.getPercentile(5, [1, 2, 3])).toBe(100);
      expect(PlayerPercentileUtils.getPercentile(0, [1, 2, 3])).toBe(0);
    });

    it('should rank a lower value higher when lower is better', () => {
      expect(PlayerPercentileUtils.getPercentile(1, [1, 2, 3, 4], true)).toBe(87.5);
    });

    it('should leave out the pool\'s missing values', () => {
      expect(PlayerPercentileUtils.getPercentile(3, [1, undefined, 3, null, NaN])).toBe(75);
    });

    it('should give nothing without a value or a pool', () => {
      expect(PlayerPercentileUtils.getPercentile(undefined, [1, 2])).toBeUndefined();
      expect(PlayerPercentileUtils.getPercentile(1, [])).toBeUndefined();
      expect(PlayerPercentileUtils.getPercentile(1, [undefined])).toBeUndefined();
    });
  });

  describe('getRank', () => {
    it('should rank a value 1 plus the values ahead of it, with ties sharing a rank', () => {
      expect(PlayerPercentileUtils.getRank(5, [9, 5, 5, 1])).toBe(2);
      expect(PlayerPercentileUtils.getRank(9, [9, 5, 5, 1])).toBe(1);
      expect(PlayerPercentileUtils.getRank(1, [9, 5, 5, 1])).toBe(4);
    });

    it('should rank the other way when lower is better', () => {
      expect(PlayerPercentileUtils.getRank(1, [9, 5, 5, 1], true)).toBe(1);
      expect(PlayerPercentileUtils.getRank(9, [9, 5, 5, 1], true)).toBe(4);
    });

    it('should give a value outside the pool the rank it would have among it', () => {
      expect(PlayerPercentileUtils.getRank(6, [9, 5, 1])).toBe(2);
      expect(PlayerPercentileUtils.getRank(10, [9, 5, 1])).toBe(1);
    });

    it("should leave the pool's missing values out, and have no rank without a value or a pool", () => {
      expect(PlayerPercentileUtils.getRank(5, [undefined, 9, null, NaN, 1])).toBe(2);
      expect(PlayerPercentileUtils.getRank(undefined, [9, 5])).toBeUndefined();
      expect(PlayerPercentileUtils.getRank(5, [])).toBeUndefined();
      expect(PlayerPercentileUtils.getRank(5, undefined)).toBeUndefined();
    });
  });

  describe('getRankTier', () => {
    it('should color the top 5% elite, the rest of the top 25% good and the bottom 20% poor', () => {
      expect(PlayerPercentileUtils.getRankTier(99.5)).toBe('elite');
      expect(PlayerPercentileUtils.getRankTier(95)).toBe('elite');
      expect(PlayerPercentileUtils.getRankTier(94.9)).toBe('good');
      expect(PlayerPercentileUtils.getRankTier(75)).toBe('good');
      expect(PlayerPercentileUtils.getRankTier(74.9)).toBe('middle');
      expect(PlayerPercentileUtils.getRankTier(20)).toBe('middle');
      expect(PlayerPercentileUtils.getRankTier(19.9)).toBe('poor');
      expect(PlayerPercentileUtils.getRankTier(0)).toBe('poor');
    });

    it('should leave a missing percentile uncolored', () => {
      expect(PlayerPercentileUtils.getRankTier(undefined)).toBe('middle');
      expect(PlayerPercentileUtils.getRankTier(NaN)).toBe('middle');
    });
  });

  describe('getPlayerPool', () => {
    it('should pool a forward with the forwards who have the minimum games, himself among them', () => {
      const pool = PlayerPercentileUtils.getPlayerPool(skaters(), 8477934);
      expect(pool.group).toBe('F');
      expect(pool.player.skaterFullName).toBe('Leon Draisaitl');
      expect(pool.minGames).toBe(7);
      expect(pool.gamesPlayed).toBe(26);
      expect(pool.pool.length).toBe(32);
      expect(pool.pool.every(row => row.positionCode !== 'D' && row.gamesPlayed >= 7)).toBeTrue();
      expect(pool.pool).toContain(pool.player);
      expect(pool.isSmallSample).toBeFalse();
    });

    it('should pool a defenseman with the defensemen', () => {
      const pool = PlayerPercentileUtils.getPlayerPool(skaters(), 8470613);
      expect(pool.group).toBe('D');
      expect(pool.pool.length).toBe(14);
    });

    it('should rank a player under the minimum against the pool without putting him in it', () => {
      const pool = PlayerPercentileUtils.getPlayerPool(skaters(), 8476480);
      expect(pool.player.skaterFullName).toBe('Vladislav Namestnikov');
      expect(pool.isSmallSample).toBeTrue();
      expect(pool.gamesPlayed).toBe(6);
      expect(pool.pool.length).toBe(32);
      expect(pool.pool).not.toContain(pool.player);
    });

    it('should pool a goalie with the goalies', () => {
      const pool = PlayerPercentileUtils.getPlayerPool(goalies(), 8476945);
      expect(pool.group).toBe('G');
      expect(pool.pool.length).toBe(14);
    });

    it('should have no pool for a player without a row', () => {
      expect(PlayerPercentileUtils.getPlayerPool(skaters(), 1)).toBeUndefined();
      expect(PlayerPercentileUtils.getPlayerPool(undefined, 8477934)).toBeUndefined();
    });
  });

  describe('getPlayerTraits', () => {
    it('should rank a forward among the 32 forwards with at least 7 games', () => {
      const traits = PlayerPercentileUtils.getPlayerTraits(skaters(), 8477934);
      expect(traits.group).toBe('F');
      expect(traits.gamesPlayed).toBe(26);
      expect(traits.minGames).toBe(7);
      expect(traits.poolSize).toBe(32);
      expect(traits.isSmallSample).toBeFalse();
      expect(traits.traits.map(item => item.label))
          .toEqual(['Goals', 'Shot attempts', 'Playmaking', 'Possession', 'Defense', 'Physical']);
      // Second in goals per 60, behind Cutter Gauthier: ahead of 30 and tied with himself. Without Natural Stat Trick
      // his ixG drops out, and goals alone decide it
      expect(trait(traits, 'goals').percentile).toBeCloseTo(30.5 / 32 * 100, 10);
      expect(trait(traits, 'goals').value).toBeCloseTo(30.5 / 32 * 100, 10);
      // 23 goals in 26 games of 1320.4615 seconds
      expect(trait(traits, 'goals').formattedValue).toBe('2.41 goals per 60');
      expect(traits.usesNst).toBeFalse();
      expect(traits.usesEdge).toBeFalse();
      // 401 shot attempts for and 292 against at 5v5
      expect(trait(traits, 'possession').value).toBeCloseTo(401 / 693, 10);
      expect(trait(traits, 'possession').formattedValue).toBe('57.9%');
    });

    it('should count a secondary assist as half of a primary one in playmaking', () => {
      // Leon Draisaitl: 16 primary and 8 secondary assists in 26 games of 1320.4615 seconds
      const playmaking = trait(PlayerPercentileUtils.getPlayerTraits(skaters(), 8477934), 'playmaking');
      expect(playmaking.value).toBeCloseTo((16 + 8 / 2) * 3600 / (26 * 1320.4615), 10);
      expect(playmaking.formattedValue).toBe('2.10 per 60');
      expect(playmaking.description).toBe('Primary assists plus half of secondary assists, per 60 minutes');
    });

    it('should leave playmaking out without the assist split', () => {
      const rows = skaters();
      const player = rows.players.find(row => row.playerId === 8477934);
      player.totalPrimaryAssists = null;
      player.totalSecondaryAssists = null;
      expect(trait(PlayerPercentileUtils.getPlayerTraits(rows, 8477934), 'playmaking').percentile).toBeUndefined();
    });

    it('should put the forward with the most goals per 60 at the top', () => {
      const traits = PlayerPercentileUtils.getPlayerTraits(skaters(), 8483445);
      expect(trait(traits, 'goals').percentile).toBeCloseTo(31.5 / 32 * 100, 10);
    });

    it('should count the forwards tied at no goals as half ahead of each other', () => {
      const rows = skaters();
      const dellandrea = rows.players.find(row => row.skaterFullName === 'Ty Dellandrea');
      const traits = PlayerPercentileUtils.getPlayerTraits(rows, dellandrea.playerId);
      // Tied with Andrew Mangiapane, Jeff Viel and himself
      expect(trait(traits, 'goals').percentile).toBeCloseTo(1.5 / 32 * 100, 10);
    });

    it('should rank defense on blocks and takeaways apart, then on the average of the two percentiles', () => {
      // Ty Dellandrea blocks the most shots per 60 of the 32 forwards (14 blocks), but has 1 takeaway: ahead of 3
      const rows = skaters();
      const dellandrea = rows.players.find(row => row.skaterFullName === 'Ty Dellandrea');
      const defense = trait(PlayerPercentileUtils.getPlayerTraits(rows, dellandrea.playerId), 'defense');
      expect(defense.value).toBeCloseTo((31.5 / 32 * 100 + 3.5 / 32 * 100) / 2, 10);
      // His average is ahead of 18 forwards' averages, where his blocks and takeaways added up were ahead of 30
      expect(defense.percentile).toBeCloseTo(18.5 / 32 * 100, 10);
      expect(defense.description).toBe('Blocked shots, takeaways and 5v5 on-ice expected goals against per 60 minutes');
    });

    it('should put the forward who does both best at the top of defense', () => {
      // Alexander Wennberg: 11 blocks and 6 takeaways
      const defense = trait(PlayerPercentileUtils.getPlayerTraits(skaters(), 8477505), 'defense');
      expect(defense.percentile).toBeCloseTo(31.5 / 32 * 100, 10);
      expect(defense.formattedValue).toBe('2.3 blocks and 1.3 takeaways per 60');
    });

    it('should rank defense on the parts it has when one can\'t be worked out', () => {
      const rows = skaters();
      rows.players.find(row => row.playerId === 8477505).takeaways = null;
      const defense = trait(PlayerPercentileUtils.getPlayerTraits(rows, 8477505), 'defense');
      // Alexander Wennberg's blocks are ahead of 27 forwards
      expect(defense.value).toBeCloseTo(27.5 / 32 * 100, 10);
      expect(defense.formattedValue).toBe('2.3 blocks per 60');
    });

    it('should leave defense out when none of its parts can be worked out', () => {
      const rows = skaters();
      const player = rows.players.find(row => row.playerId === 8477505);
      player.takeaways = null;
      player.blockedShots = null;
      const defense = trait(PlayerPercentileUtils.getPlayerTraits(rows, 8477505), 'defense');
      expect(defense.value).toBeUndefined();
      expect(defense.percentile).toBeUndefined();
      expect(defense.formattedValue).toBe('-');
    });

    it('should rank a defenseman among the defensemen only', () => {
      const rows = skaters();
      const defenseman = rows.players.find(row => row.positionCode === 'D' && row.gamesPlayed >= 7);
      const traits = PlayerPercentileUtils.getPlayerTraits(rows, defenseman.playerId);
      expect(traits.group).toBe('D');
      expect(traits.poolSize).toBe(14);
    });

    it('should chart a player under the minimum against the pool, as a small sample', () => {
      // Vladislav Namestnikov, 6 games
      const traits = PlayerPercentileUtils.getPlayerTraits(skaters(), 8476480);
      expect(traits.gamesPlayed).toBe(6);
      expect(traits.isSmallSample).toBeTrue();
      expect(traits.poolSize).toBe(32);
      expect(traits.traits.every(item => item.percentile >= 0 && item.percentile <= 100)).toBeTrue();
    });

    it('should rank a goalie among the 14 goalies with at least 7 games', () => {
      const traits = PlayerPercentileUtils.getPlayerTraits(goalies(), 8476945);
      expect(traits.group).toBe('G');
      expect(traits.poolSize).toBe(14);
      expect(traits.traits.map(item => item.label))
          .toEqual(['Save %', 'Goals saved', 'Even strength', 'Penalty kill', 'Workload', 'Winning']);
      // 7th best save percentage of 14: ahead of 7
      expect(trait(traits, 'savePct').percentile).toBeCloseTo(7.5 / 14 * 100, 10);
      expect(trait(traits, 'savePct').formattedValue).toBe('.898');
      // 25 saves on 33 shots on the penalty kill (the stats API's pp split)
      expect(trait(traits, 'penaltyKill').value).toBeCloseTo(25 / 33, 10);
      // 8 wins in 9 decisions
      expect(trait(traits, 'winning').value).toBeCloseTo(8 / 9, 10);
      expect(trait(traits, 'workload').formattedValue).toBe('10 started');
    });

    it('should work out a goalie\'s goals saved above average per 60 from his saves by strength', () => {
      const traits = PlayerPercentileUtils.getPlayerTraits(goalies(), 8476945);
      const goalsSaved = (189 - 0.903 * 205) + (25 - 0.853 * 33) + (5 - 0.910 * 6);
      expect(trait(traits, 'goalsSaved').value).toBeCloseTo(goalsSaved * 3600 / 33179, 10);
    });

    it('should chart a goalie under the minimum above everyone he outplays', () => {
      // Igor Shesterkin: 5 games, a .9266 save percentage better than the 14 qualified goalies
      const traits = PlayerPercentileUtils.getPlayerTraits(goalies(), 8478048);
      expect(traits.isSmallSample).toBeTrue();
      expect(trait(traits, 'savePct').percentile).toBe(100);
    });

    it('should leave a stat out when it can\'t be worked out', () => {
      const rows = skaters();
      const player = rows.players.find(row => row.playerId === 8477934);
      player.satFor = 0;
      player.satAgainst = 0;
      player.hits = null;
      const traits = PlayerPercentileUtils.getPlayerTraits(rows, 8477934);
      expect(trait(traits, 'possession').value).toBeUndefined();
      expect(trait(traits, 'possession').percentile).toBeUndefined();
      expect(trait(traits, 'possession').formattedValue).toBe('-');
      expect(trait(traits, 'physical').percentile).toBeUndefined();
    });

    it('should give nothing for a player without a row, or without players', () => {
      expect(PlayerPercentileUtils.getPlayerTraits(skaters(), 1, {nstPlayers: mockNstPlayerRows()})).toBeUndefined();
      expect(PlayerPercentileUtils.getPlayerTraits(skaters(), 1)).toBeUndefined();
      expect(PlayerPercentileUtils.getPlayerTraits({players: [], mostTeamGames: 0}, 8477934)).toBeUndefined();
      expect(PlayerPercentileUtils.getPlayerTraits(undefined, 8477934)).toBeUndefined();
    });
  });

  describe('getPlayerTraits with Natural Stat Trick', () => {
    // Leon Draisaitl among the 32 forwards: his goals per 60 are ahead of 30, his ixG per 60 (1.43) of 26, his hits of
    // 7, his hits taken of 4, his blocks of 2, his takeaways of 22 and his 5v5 on-ice xGA per 60 (2.28, lower is
    // better) of 22, each tied with himself
    function draisaitl() {
      return PlayerPercentileUtils.getPlayerTraits(skaters(), 8477934, {nstPlayers: mockNstPlayerRows()});
    }

    it('should count ixG at half weight in Goals', () => {
      const goals = trait(draisaitl(), 'goals');
      expect(goals.value).toBeCloseTo((30.5 / 32 * 100 + 0.5 * 26.5 / 32 * 100) / 1.5, 10);
      expect(goals.formattedValue).toBe('2.41 goals and 1.43 ixG per 60');
      expect(goals.description).toBe('Goals and expected goals (ixG) per 60 minutes');
    });

    it('should count hits taken at half weight in Physical', () => {
      const physical = trait(draisaitl(), 'physical');
      expect(physical.value).toBeCloseTo((7.5 / 32 * 100 + 0.5 * 4.5 / 32 * 100) / 1.5, 10);
      expect(physical.formattedValue).toBe('1.3 hits and 2.0 hits taken per 60');
    });

    it('should rank Defense on blocks, takeaways and on-ice xGA at half weight, a lower xGA ranking higher', () => {
      const defense = trait(draisaitl(), 'defense');
      expect(defense.value).toBeCloseTo((2.5 + 22.5 + 0.5 * 22.5) / 2.5 / 32 * 100, 10);
      expect(defense.formattedValue).toBe('0.9 blocks and 0.9 takeaways per 60, 2.28 xGA per 60 at 5v5');
      // Cutter Gauthier allows the most xGA per 60 of them (3.60): behind everyone on that part
      const gauthier = PlayerPercentileUtils.getPlayerTraits(skaters(), 8483445, {nstPlayers: mockNstPlayerRows()});
      expect(trait(gauthier, 'defense').value).toBeCloseTo((7.5 + 1.5 + 0.5 * 0.5) / 2.5 / 32 * 100, 10);
    });

    it('should credit NST for a player with a row', () => {
      expect(draisaitl().usesNst).toBeTrue();
    });

    it('should leave his NST parts out for a player missing from NST, and not credit it', () => {
      const nstPlayers = mockNstPlayerRows().filter(row => row.playerId !== 8477934);
      const traits = PlayerPercentileUtils.getPlayerTraits(skaters(), 8477934, {nstPlayers});
      expect(traits.usesNst).toBeFalse();
      // The other forwards' ixG is still ranked, but his goals alone make his Goals
      expect(trait(traits, 'goals').value).toBeCloseTo(30.5 / 32 * 100, 10);
      expect(trait(traits, 'goals').formattedValue).toBe('2.41 goals per 60');
    });

    it('should leave Defense\'s xGA out without NST\'s on-ice page', () => {
      const nstPlayers = mockNstPlayerRows().map(row => ({...row, onIceTimeOnIce: null, onIceExpectedGoalsAgainst: null}));
      const defense = trait(PlayerPercentileUtils.getPlayerTraits(skaters(), 8477934, {nstPlayers}), 'defense');
      expect(defense.value).toBeCloseTo((2.5 + 22.5) / 2 / 32 * 100, 10);
      expect(defense.formattedValue).toBe('0.9 blocks and 0.9 takeaways per 60');
    });

    it('should ignore the sources for a goalie', () => {
      const traits = PlayerPercentileUtils.getPlayerTraits(goalies(), 8476945,
          {nstPlayers: mockNstPlayerRows(), edgeSeason: mockEdgeSeason()});
      expect(traits.traits.map(item => item.key))
          .toEqual(['savePct', 'goalsSaved', 'evenStrength', 'penaltyKill', 'workload', 'winning']);
      expect(traits.usesNst).toBeFalse();
      expect(traits.usesEdge).toBeFalse();
    });
  });

  describe('joinSkaterRows', () => {
    it('should join each row with his NST and EDGE rows by player ID', () => {
      const rows = PlayerPercentileUtils.joinSkaterRows(skaters().players,
          {nstPlayers: mockNstPlayerRows(), edgeSeason: mockEdgeSeason()});
      const draisaitl = rows.find(row => row.playerId === 8477934);
      expect(draisaitl.skaterFullName).toBe('Leon Draisaitl');
      expect(draisaitl.nst.expectedGoals).toBe(13.64);
      expect(draisaitl.edge.playerId).toBe(8477934);
    });

    it('should leave the rows as they are without either source', () => {
      const players = skaters().players;
      expect(PlayerPercentileUtils.joinSkaterRows(players, undefined)).toBe(players);
      expect(PlayerPercentileUtils.joinSkaterRows(players, {nstPlayers: [], edgeSeason: undefined})).toBe(players);
    });
  });

  describe('getPlayerTraits with the EDGE season file', () => {
    function withEdge(playerId: number) {
      return PlayerPercentileUtils.getPlayerTraits(skaters(), playerId,
          {nstPlayers: mockNstPlayerRows(), edgeSeason: mockEdgeSeason()});
    }

    it('should chart Speed and Possession for a skater in the file', () => {
      const traits = withEdge(8477934);
      expect(traits.traits.map(item => item.label))
          .toEqual(['Goals', 'Possession', 'Playmaking', 'Speed', 'Defense', 'Physical']);
      expect(traits.usesEdge).toBeTrue();
      expect(traits.edgeThroughDate).toBe('2026-11-24');
    });

    it('should rank top speed and bursts per 60 against the pool, top speed at half weight', () => {
      // Leon Draisaitl's 22.27 mph is ahead of 15 forwards, his 61 bursts in 27 games of 1320.4615 seconds of 16
      const speed = trait(withEdge(8477934), 'speed');
      expect(speed.value).toBeCloseTo((0.5 * 15.5 + 16.5) / 1.5 / 32 * 100, 10);
      expect(speed.formattedValue).toBe('6.2 bursts over 20 mph per 60, 22.3 mph top speed');
      // Connor McDavid is the fastest and bursts the most
      expect(trait(withEdge(8478402), 'speed').percentile).toBeCloseTo(31.5 / 32 * 100, 10);
    });

    it("should rank Possession on shot attempts per 60 and 5v5 Corsi For %", () => {
      // Leon Draisaitl: his 18.6 attempts per 60 are ahead of 24 forwards, his 57.9% Corsi For of 27
      const possession = trait(withEdge(8477934), 'possession');
      expect(possession.value).toBeCloseTo((24.5 + 27.5) / 2 / 32 * 100, 10);
      expect(possession.formattedValue).toBe('18.6 attempts per 60, 57.9% Corsi For');
    });

    it("should divide the bursts by EDGE's own games, at the league row's ice time per game", () => {
      const row = {...skaters().players.find(player => player.playerId === 8477934),
        edge: mockEdgeSeason().skaters.find(skater => skater.playerId === 8477934)};
      expect(PlayerPercentileUtils.getBurstsPer60(row)).toBeCloseTo(61 * 3600 / (1320.4615 * 27), 10);
      expect(PlayerPercentileUtils.getBurstsPer60({...row, edge: undefined})).toBeUndefined();
    });

    it('should go back to the axes without Speed for a skater missing from the file', () => {
      const edgeSeason = mockEdgeSeason();
      edgeSeason.skaters = edgeSeason.skaters.filter(skater => skater.playerId !== 8477934);
      const traits = PlayerPercentileUtils.getPlayerTraits(skaters(), 8477934, {edgeSeason});
      expect(traits.traits.map(item => item.key))
          .toEqual(['goals', 'shotAttempts', 'playmaking', 'possession', 'defense', 'physical']);
      expect(traits.usesEdge).toBeFalse();
      expect(traits.edgeThroughDate).toBeUndefined();
    });

    it('should go back to the axes without Speed without the file, like a season before 2021-22', () => {
      const traits = PlayerPercentileUtils.getPlayerTraits(skaters(), 8477934, {nstPlayers: mockNstPlayerRows()});
      expect(traits.traits.map(item => item.key))
          .toEqual(['goals', 'shotAttempts', 'playmaking', 'possession', 'defense', 'physical']);
      expect(traits.usesNst).toBeTrue();
    });
  });
});
