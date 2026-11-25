import {PlayerPercentileUtils} from './player-percentile-utils';
import {
  mockLeagueGoalies,
  mockLeaguePlayerRows,
  mockLeagueSkaters
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
      // Second in goals per 60, behind Cutter Gauthier: ahead of 30 and tied with himself
      expect(trait(traits, 'goals').percentile).toBeCloseTo(30.5 / 32 * 100, 10);
      // 23 goals in 26 games of 1320.4615 seconds
      expect(trait(traits, 'goals').value).toBeCloseTo(23 * 3600 / (26 * 1320.4615), 10);
      expect(trait(traits, 'goals').formattedValue).toBe('2.41 per 60');
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
      expect(defense.description).toContain('each ranked on its own and averaged');
    });

    it('should put the forward who does both best at the top of defense', () => {
      // Alexander Wennberg: 11 blocks and 6 takeaways
      const defense = trait(PlayerPercentileUtils.getPlayerTraits(skaters(), 8477505), 'defense');
      expect(defense.percentile).toBeCloseTo(31.5 / 32 * 100, 10);
      expect(defense.formattedValue).toBe('2.3 blocks and 1.3 takeaways per 60');
    });

    it('should leave defense out when one of its parts can\'t be worked out', () => {
      const rows = skaters();
      rows.players.find(row => row.playerId === 8477505).takeaways = null;
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
      expect(PlayerPercentileUtils.getPlayerTraits(skaters(), 1)).toBeUndefined();
      expect(PlayerPercentileUtils.getPlayerTraits({players: [], mostTeamGames: 0}, 8477934)).toBeUndefined();
      expect(PlayerPercentileUtils.getPlayerTraits(undefined, 8477934)).toBeUndefined();
    });
  });
});
