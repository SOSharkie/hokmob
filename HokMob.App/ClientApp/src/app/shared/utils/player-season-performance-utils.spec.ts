import {PlayerSeasonPerformanceUtils, SeasonPerformance, SeasonPerformanceRow} from './player-season-performance-utils';
import {
  mockEdgeGoalieDetail,
  mockEdgeSkaterDetail,
  mockLeagueGoalies,
  mockLeaguePlayerRows,
  mockLeagueSkaters,
  mockNstPlayerRows
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {LeagueGoalieStats, LeaguePlayers, LeagueSkaterStats} from '@shared/models/nhl-stats-api/league-players.model';

describe('PlayerSeasonPerformanceUtils', () => {

  // The captured 2026-27 season through 26 games: 7 games make the pool, which has 32 forwards, 14 defensemen and
  // 14 goalies. Leon Draisaitl (8477934) is a forward with 26 games.
  const draisaitl = 8477934;

  function skaters(): LeaguePlayers<LeagueSkaterStats> {
    return mockLeaguePlayerRows(mockLeagueSkaters());
  }

  function goalies(): LeaguePlayers<LeagueGoalieStats> {
    return mockLeaguePlayerRows(mockLeagueGoalies());
  }

  function row(performance: SeasonPerformance, key: string): SeasonPerformanceRow {
    return performance.groups.flatMap(group => group.rows).find(item => item.key === key);
  }

  function groupTitles(performance: SeasonPerformance): string[] {
    return performance.groups.map(group => group.title);
  }

  describe('a skater', () => {
    it('should rank his season totals among the forwards with the minimum games', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total',
          mockNstPlayerRows(), mockEdgeSkaterDetail());
      expect(performance.group).toBe('F');
      expect(performance.gamesPlayed).toBe(26);
      expect(performance.poolSize).toBe(32);
      expect(performance.minGames).toBe(7);
      expect(performance.isSmallSample).toBeFalse();

      // 23 goals lead the forwards, 24 assists are 3rd and 47 points 2nd
      expect(row(performance, 'goals')).toEqual(jasmine.objectContaining({value: '23', rank: '1st', rankTier: 'elite'}));
      expect(row(performance, 'goals').description).toBe('Goals. 1st of 32 forwards with 7+ games');
      expect(row(performance, 'assists')).toEqual(jasmine.objectContaining({value: '24', rank: '3rd'}));
      expect(row(performance, 'points')).toEqual(jasmine.objectContaining({value: '47', rank: '2nd'}));
    });

    it('should give each group its stats, in two columns', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total',
          mockNstPlayerRows(), mockEdgeSkaterDetail());
      expect(groupTitles(performance)).toEqual(
          ['Scoring', 'Shooting', 'Possession', 'Defense and physical', 'Discipline', 'Usage', 'Skating']);
      expect(performance.groups.map(group => group.column)).toEqual([0, 0, 0, 1, 1, 1, 1]);
      expect(performance.groups.find(group => group.title === 'Scoring').rows.map(item => item.label)).toEqual(
          ['Goals', 'Assists', 'Primary assists', 'Secondary assists', 'Points', 'Power play points']);
      expect(performance.groups.find(group => group.title === 'Shooting').rows.map(item => item.label)).toEqual(
          ['Shots on goal', 'Shooting %', 'Shot attempts', 'Expected goals', 'High danger attempts']);
    });

    it('should make the bar as long as his percentile', () => {
      const goals = row(PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total'), 'goals');
      // Ahead of 31 of the 32, and tied with himself
      expect(goals.barWidth).toBeCloseTo(31.5 / 32 * 100, 5);
    });

    it('should turn counting stats into rates of his ice time per 60, and rank those', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'per60',
          mockNstPlayerRows());
      // 23 goals in 34332 seconds
      expect(row(performance, 'goals')).toEqual(jasmine.objectContaining({value: '2.41', rank: '2nd'}));
      expect(row(performance, 'goals').description).toBe('Goals, per 60 minutes. 2nd of 32 forwards with 7+ games');
      expect(row(performance, 'expectedGoals').value).toBe((13.64 * 3600 / 34332).toFixed(2));
    });

    it('should keep shares and ice time per game as they are per 60', () => {
      const total = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total');
      const per60 = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'per60');
      ['corsi', 'fenwick', 'faceoffs', 'timeOnIce', 'ppTimeOnIce', 'shootingPct'].forEach(key => {
        expect(row(per60, key).value).withContext(key).toBe(row(total, key).value);
        expect(row(per60, key).rank).withContext(key).toBe(row(total, key).rank);
      });
      expect(row(total, 'timeOnIce').value).toBe('22:00');
    });

    it('should rank faceoffs among the forwards who take enough of them, with his record in the tooltip', () => {
      const faceoffs = row(PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total'), 'faceoffs');
      expect(faceoffs.value).toBe('57.2%');
      expect(faceoffs.rank).toBe('2nd');
      expect(faceoffs.description).toBe(
          'Faceoffs won, of the ones he took: 234 won, 175 lost. 2nd of 16 forwards with 7+ games and 35+ faceoffs');
    });

    it('should leave faceoffs out for a player who takes none', () => {
      expect(row(PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), 8478398, 'total'), 'faceoffs'))
          .toBeUndefined();
      expect(row(PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), 8470613, 'total'), 'faceoffs'))
          .toBeUndefined();
    });

    it('should rank giveaways and penalty minutes lower first', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total');
      // 48 giveaways: only 2 forwards have more
      expect(row(performance, 'giveaways')).toEqual(jasmine.objectContaining({value: '48', rank: '30th', rankTier: 'poor'}));
      expect(row(performance, 'penaltyDiff').value).toBe('+2');
    });

    it('should add Natural Stat Trick\'s stats when it has his row', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total',
          mockNstPlayerRows());
      expect(performance.hasNst).toBeTrue();
      expect(row(performance, 'expectedGoals')).toEqual(jasmine.objectContaining({value: '13.6', rank: '2nd'}));
      expect(row(performance, 'highDangerAttempts').value).toBe('29');
      expect(row(performance, 'reboundsCreated').value).toBe('8');
      expect(row(performance, 'rushAttempts').value).toBe('3');
    });

    it('should never color hits taken, which are neither good nor bad', () => {
      const hitsTaken = row(PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total',
          mockNstPlayerRows()), 'hitsTaken');
      expect(hitsTaken.value).toBe('19');
      expect(hitsTaken.rank).not.toBe('');
      expect(hitsTaken.rankTier).toBe('middle');
    });

    it('should show the NHL\'s stats alone without Natural Stat Trick', () => {
      [undefined, [], mockNstPlayerRows().filter(nst => nst.playerId !== draisaitl)].forEach(nstPlayers => {
        const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total', nstPlayers);
        expect(performance.hasNst).toBeFalse();
        ['expectedGoals', 'highDangerAttempts', 'reboundsCreated', 'rushAttempts', 'hitsTaken'].forEach(key => expect(row(performance, key)).withContext(key).toBeUndefined());
        expect(row(performance, 'goals').rank).toBe('1st');
      });
    });

    it('should show NHL EDGE\'s stats with the NHL\'s percentile', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total', undefined,
          mockEdgeSkaterDetail());
      expect(performance.hasEdge).toBeTrue();
      const skating = performance.groups.find(group => group.title === 'Skating');
      expect(skating.isEdge).toBeTrue();
      expect(skating.rows.map(item => [item.label, item.value, item.rank])).toEqual([
        ['Top speed', '22.3 mph', '66%'],
        ['Bursts over 20 mph', '61', '91%'],
        ['Top shot speed', '82.5 mph', '49%']
      ]);
      expect(row(performance, 'offensiveZone')).toEqual(jasmine.objectContaining({value: '49.1%', rank: '99%',
        rankTier: 'elite', isEdge: true}));
      expect(row(performance, 'topSpeed').description)
          .toBe('His fastest skating speed (NHL EDGE). NHL EDGE percentile among forwards: 66%');
      expect(row(performance, 'bursts').barWidth).toBeCloseTo(91.26, 5);
      expect(row(performance, 'distance')).toBeUndefined();
    });

    it('should leave EDGE\'s stats out without them, like a season before EDGE', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), draisaitl, 'total');
      expect(performance.hasEdge).toBeFalse();
      expect(groupTitles(performance)).not.toContain('Skating');
      expect(row(performance, 'offensiveZone')).toBeUndefined();
      expect(performance.groups.find(group => group.title === 'Usage').rows.length).toBe(3);
    });

    it('should leave out a stat nobody has that season', () => {
      const leaguePlayers = skaters();
      leaguePlayers.players.forEach(player => player.totalShotAttempts = null);
      expect(row(PlayerSeasonPerformanceUtils.getSeasonPerformance(leaguePlayers, draisaitl, 'total'), 'shotAttempts'))
          .toBeUndefined();
    });

    it('should show a stat he has no value for as "-" without a rank', () => {
      const leaguePlayers = skaters();
      leaguePlayers.players.find(player => player.playerId === draisaitl).satFor = null;
      leaguePlayers.players.find(player => player.playerId === draisaitl).satAgainst = null;
      const corsi = row(PlayerSeasonPerformanceUtils.getSeasonPerformance(leaguePlayers, draisaitl, 'total'), 'corsi');
      expect(corsi).toEqual(jasmine.objectContaining({value: '-', rank: '', rankTier: 'middle', barWidth: 0}));
    });

    it('should rank a player under the minimum games against the pool', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), 8476480, 'total');
      expect(performance.isSmallSample).toBeTrue();
      expect(performance.gamesPlayed).toBe(6);
      expect(performance.poolSize).toBe(32);
      expect(row(performance, 'goals').description).toContain('of 32 forwards with 7+ games');
    });

    it('should rank a defenseman among the defensemen', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), 8470613, 'total');
      expect(performance.group).toBe('D');
      expect(performance.poolSize).toBe(14);
      expect(row(performance, 'goals').description).toContain('of 14 defensemen with 7+ games');
    });
  });

  describe('a goalie', () => {
    it('should rank his season among the goalies, with his own groups', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(goalies(), 8476945, 'total', undefined,
          mockEdgeGoalieDetail());
      expect(performance.group).toBe('G');
      expect(performance.gamesPlayed).toBe(10);
      expect(performance.gamesStarted).toBe(10);
      expect(performance.poolSize).toBe(14);
      expect(groupTitles(performance)).toEqual(['Goaltending', 'By strength', 'Workload', 'Tracking']);
      expect(row(performance, 'savePct').rank).toBe('7th');
      expect(row(performance, 'savePct').description).toBe('Save percentage. 7th of 14 goalies with 7+ games');
      expect(row(performance, 'goalsAgainstAverage')).toEqual(jasmine.objectContaining({value: '2.71', rank: '6th'}));
      expect(row(performance, 'wins').value).toBe('8');
      expect(row(performance, 'shutouts').value).toBe('1');
    });

    it('should show his NHL EDGE stats', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(goalies(), 8476945, 'total', undefined,
          mockEdgeGoalieDetail());
      expect(row(performance, 'highDanger')).toEqual(jasmine.objectContaining({value: '.815', rank: '65%'}));
      expect(row(performance, 'gamesAbove900')).toEqual(jasmine.objectContaining({value: '60%', rank: '87%'}));
    });

    it('should keep his stats as they are per 60', () => {
      const total = PlayerSeasonPerformanceUtils.getSeasonPerformance(goalies(), 8476945, 'total');
      const per60 = PlayerSeasonPerformanceUtils.getSeasonPerformance(goalies(), 8476945, 'per60');
      expect(per60.groups).toEqual(total.groups);
    });

    it('should rank a goalie under the minimum games against the pool', () => {
      const performance = PlayerSeasonPerformanceUtils.getSeasonPerformance(goalies(), 8478048, 'total');
      expect(performance.isSmallSample).toBeTrue();
      // His .9266 is better than all 14
      expect(row(performance, 'savePct').rank).toBe('1st');
    });
  });

  it('should have no performance for a player without a row', () => {
    expect(PlayerSeasonPerformanceUtils.getSeasonPerformance(skaters(), 1, 'total')).toBeUndefined();
    expect(PlayerSeasonPerformanceUtils.getSeasonPerformance(undefined, draisaitl, 'total')).toBeUndefined();
  });

  describe('formatSigned', () => {
    it('should sign a positive number, and not a zero', () => {
      expect(PlayerSeasonPerformanceUtils.formatSigned(9.36, 1)).toBe('+9.4');
      expect(PlayerSeasonPerformanceUtils.formatSigned(-1.24, 1)).toBe('-1.2');
      expect(PlayerSeasonPerformanceUtils.formatSigned(0, 0)).toBe('0');
      expect(PlayerSeasonPerformanceUtils.formatSigned(0.004, 2)).toBe('0.00');
      expect(PlayerSeasonPerformanceUtils.formatSigned(-0.004, 2)).toBe('0.00');
    });
  });
});
