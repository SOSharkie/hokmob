import {TeamRatingUtils} from './team-rating-utils';
import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {
  mockNstTeamGameRows,
  mockRatedTeamGameRows,
  mockTeamGameRows
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('TeamRatingUtils', () => {
  /**
   * San Jose: 22 games, 20 points, 56 goals for and 77 against through 2026-11-14 in the fixture, and 36.56 xG for and
   * 55.96 against at 5v5 from Natural Stat Trick.
   */
  const sharks = 28;

  /** Every team's games with NST's expected goals, as a page rates them when NST answers. */
  let games: TeamGameStats[];

  /** The same games without expected goals, as when NST can't be asked. */
  let nhlGames: TeamGameStats[];

  beforeEach(() => {
    games = mockRatedTeamGameRows();
    nhlGames = mockTeamGameRows();
  });

  /** A team's games in the fixture, oldest first. */
  function teamGames(teamId: number): TeamGameStats[] {
    return games.filter(game => game.teamId === teamId);
  }

  function sum(rows: TeamGameStats[], field: keyof TeamGameStats): number {
    return rows.reduce((total, row) => total + (row[field] as number), 0);
  }

  describe('metrics', () => {
    it('should weigh the rated stats to a whole rating, with expected goals', () => {
      const weights = TeamRatingUtils.expectedGoalsWeights;
      expect(TeamRatingUtils.getRatedMetrics().map(metric => [metric.id, weights[metric.id]])).toEqual([
        ['corsi', 0.3], ['expectedGoals', 0.15], ['shooting5v5', 0.15], ['save5v5', 0.1], ['powerPlay', 0.2],
        ['penaltyDiff', 0.1]
      ]);
      expect(Object.values(weights).reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 10);
    });

    it('should weigh the NHL\'s stats to a whole rating, without expected goals', () => {
      const weights = TeamRatingUtils.nhlWeights;
      expect(TeamRatingUtils.getRatedMetrics(weights).map(metric => [metric.id, weights[metric.id]])).toEqual([
        ['corsi', 0.45], ['shooting5v5', 0.15], ['save5v5', 0.1], ['powerPlay', 0.2], ['penaltyDiff', 0.1]
      ]);
      expect(Object.values(weights).reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 10);
    });

    it('should rate nothing from the standings', () => {
      [TeamRatingUtils.expectedGoalsWeights, TeamRatingUtils.nhlWeights].forEach(weights => {
        const rated = TeamRatingUtils.getRatedMetrics(weights).map(metric => metric.id);
        expect(rated).not.toContain('pointPct');
        expect(rated).not.toContain('goalDiff');
      });
    });

    it('should give each chart metric its own color', () => {
      const colors = TeamRatingUtils.chartMetrics.map(metric => metric.color);
      expect(colors.length).toBe(8);
      expect(new Set(colors).size).toBe(8);
    });

    it('should format each kind of value', () => {
      expect(TeamRatingUtils.getMetric('pointPct').format(20 / 44)).toBe('45.5%');
      expect(TeamRatingUtils.getMetric('goalDiff').format(-21 / 22)).toBe('-0.95');
      expect(TeamRatingUtils.getMetric('goalDiff').format(0.45)).toBe('+0.45');
      expect(TeamRatingUtils.getMetric('goalDiff').format(0.001)).toBe('0.00');
      expect(TeamRatingUtils.getMetric('goalDiff').format(-0.001)).toBe('0.00');
      expect(TeamRatingUtils.getMetric('pdo').format(97.44)).toBe('97.4');
      expect(TeamRatingUtils.getMetric('expectedGoals').format(36.56 / (36.56 + 55.96))).toBe('39.5%');
      expect(TeamRatingUtils.getMetric('penaltyDiff').format(5 / 22)).toBe('+0.23');
    });

    it('should have no value without games or shots', () => {
      const totals = TeamRatingUtils.getTotals([]);
      TeamRatingUtils.metrics.forEach(metric => expect(metric.getValue(totals)).withContext(metric.id).toBeNull());
    });
  });

  describe('getTotals', () => {
    it('should add up a team\'s real games', () => {
      const totals = TeamRatingUtils.getTotals(teamGames(sharks));
      expect(totals.gamesPlayed).toBe(22);
      expect(totals.points).toBe(20);
      expect(totals.goalsFor).toBe(56);
      expect(totals.goalsAgainst).toBe(77);
      expect(totals.usatFor).toBe(sum(teamGames(sharks), 'usatFor'));
    });

    it('should count a missing count as 0', () => {
      const game = {...teamGames(sharks)[0], goalsFor5v5: null};
      expect(TeamRatingUtils.getTotals([game]).goalsFor5v5).toBe(0);
    });

    it('should add up the expected goals of the games that have them', () => {
      const totals = TeamRatingUtils.getTotals(teamGames(sharks));
      expect(totals.expectedGoalsFor5v5).toBeCloseTo(36.56, 2);
      expect(totals.expectedGoalsAgainst5v5).toBeCloseTo(55.96, 2);
      expect(TeamRatingUtils.getTotals(nhlGames.filter(game => game.teamId === sharks)).expectedGoalsFor5v5).toBe(0);
    });

    it('should give zeros without games', () => {
      const totals = TeamRatingUtils.getTotals(null);
      expect(totals.gamesPlayed).toBe(0);
      expect(totals.goalsFor).toBe(0);
    });
  });

  describe('withExpectedGoals', () => {
    it('should add NST\'s expected goals to each game, by game and team', () => {
      const nstGames = mockNstTeamGameRows();
      const merged = TeamRatingUtils.withExpectedGoals(nhlGames, nstGames);
      expect(merged.length).toBe(nhlGames.length);
      const game = merged.find(row => row.teamId === sharks);
      const nstGame = nstGames.find(row => row.gameId === game.gameId && row.teamId === sharks);
      expect(game.expectedGoalsFor5v5).toBe(nstGame.expectedGoalsFor);
      expect(game.expectedGoalsAgainst5v5).toBe(nstGame.expectedGoalsAgainst);
      // The opponent's row of the same game has the mirrored 5v5 xG
      const opponent = merged.find(row => row.gameId === game.gameId && row.teamId !== sharks);
      expect(opponent.expectedGoalsFor5v5).toBe(game.expectedGoalsAgainst5v5);
      expect(merged.every(row => row.expectedGoalsFor5v5 !== undefined)).toBeTrue();
    });

    it('should leave a game NST doesn\'t have as it is', () => {
      const firstGameId = nhlGames[0].gameId;
      const nstGames = mockNstTeamGameRows().filter(row => row.gameId !== firstGameId);
      const merged = TeamRatingUtils.withExpectedGoals(nhlGames, nstGames);
      expect(merged[0]).toBe(nhlGames[0]);
      expect(merged[0].expectedGoalsFor5v5).toBeUndefined();
      expect(merged[merged.length - 1].expectedGoalsFor5v5).toBeDefined();
    });

    it('should return the games untouched without expected goals', () => {
      expect(TeamRatingUtils.withExpectedGoals(nhlGames, [])).toBe(nhlGames);
      expect(TeamRatingUtils.withExpectedGoals(nhlGames, null)).toBe(nhlGames);
      expect(TeamRatingUtils.withExpectedGoals(null, null)).toEqual([]);
    });
  });

  describe('getLeagueRatings', () => {
    it('should rate all 32 teams, best first', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games);
      expect(ratings.length).toBe(32);
      expect(ratings[0].rank).toBe(1);
      ratings.slice(1).forEach((rating, i) => expect(rating.rating).toBeLessThanOrEqual(ratings[i].rating));
      // Deviations from the league average cancel out
      const mean = ratings.reduce((total, rating) => total + rating.rating, 0) / ratings.length;
      expect(mean).toBeCloseTo(TeamRatingUtils.averageRating, 0);
    });

    it('should rate on a 0 to 10 scale, like a player rating', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games);
      ratings.forEach(rating => {
        expect(rating.rating).toBeGreaterThanOrEqual(0);
        expect(rating.rating).toBeLessThanOrEqual(10);
        Object.values(rating.scores).forEach(score => expect(score).toBeLessThanOrEqual(10));
      });
      // San Jose, 30th through 2026-11-14
      const team = ratings.find(rating => rating.teamId === sharks);
      expect(TeamRatingUtils.formatRating(team.rating)).toBe('2.9');
      expect(team.rank).toBe(30);
    });

    it('should count expected goals when every team has them', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games);
      ratings.forEach(rating => {
        expect(rating.hasExpectedGoals).toBeTrue();
        expect(rating.weights).toBe(TeamRatingUtils.expectedGoalsWeights);
      });
    });

    it('should fall back to the NHL\'s stats without expected goals', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(nhlGames);
      expect(ratings.length).toBe(32);
      ratings.forEach(rating => {
        expect(rating.hasExpectedGoals).toBeFalse();
        expect(rating.weights).toBe(TeamRatingUtils.nhlWeights);
        expect(rating.values.expectedGoals).toBeNull();
        expect(rating.ranks.expectedGoals).toBeNull();
        expect(rating.scores.expectedGoals).toBe(TeamRatingUtils.averageRating);
      });
      // San Jose, 28th through 2026-11-14 on the NHL's stats alone
      const team = ratings.find(rating => rating.teamId === sharks);
      expect(TeamRatingUtils.formatRating(team.rating)).toBe('3.4');
      expect(team.rank).toBe(28);
    });

    it('should fall back for every team when one team has no expected goals', () => {
      const withoutSharks = games.map(game => game.teamId === sharks ? nhlGames.find(row =>
          row.gameId === game.gameId && row.teamId === sharks) : game);
      const ratings = TeamRatingUtils.getLeagueRatings(withoutSharks);
      ratings.forEach(rating => expect(rating.hasExpectedGoals).toBeFalse());
      // The same rating as without any expected goals, so the teams are all rated on the same stats
      const nhlRatings = TeamRatingUtils.getLeagueRatings(nhlGames);
      ratings.forEach(rating => expect(rating.rating)
          .toBeCloseTo(nhlRatings.find(other => other.teamId === rating.teamId).rating, 10));
    });

    it('should still count expected goals when a team\'s latest game has none yet', () => {
      const lastGame = teamGames(sharks)[21];
      const lagging = games.map(game => game === lastGame ? nhlGames.find(row =>
          row.gameId === game.gameId && row.teamId === sharks) : game);
      const team = TeamRatingUtils.getLeagueRatings(lagging).find(rating => rating.teamId === sharks);
      expect(team.hasExpectedGoals).toBeTrue();
      expect(team.gamesPlayed).toBe(22);
      const counted = teamGames(sharks).slice(0, 21);
      const expectedFor = sum(counted, 'expectedGoalsFor5v5');
      expect(team.values.expectedGoals).toBeCloseTo(expectedFor / (expectedFor + sum(counted, 'expectedGoalsAgainst5v5')), 10);
    });

    it('should work out a team\'s stats from its real games', () => {
      const team = TeamRatingUtils.getLeagueRatings(games).find(rating => rating.teamId === sharks);
      const sharkGames = teamGames(sharks);
      expect(team.gamesPlayed).toBe(22);
      expect(team.values.pointPct).toBeCloseTo(20 / 44, 10);
      expect(team.values.goalDiff).toBeCloseTo(-21 / 22, 10);
      const usatFor = sum(sharkGames, 'usatFor');
      expect(team.values.fenwick).toBeCloseTo(usatFor / (usatFor + sum(sharkGames, 'usatAgainst')), 10);
      const specialTeams = sum(sharkGames, 'ppGoalsFor') + sum(sharkGames, 'shGoalsFor')
          - sum(sharkGames, 'ppGoalsAgainst') - sum(sharkGames, 'shGoalsAgainst');
      expect(team.values.specialTeams).toBeCloseTo(specialTeams / 22, 10);
      const shooting = sum(sharkGames, 'goalsFor5v5') / sum(sharkGames, 'shots5v5For');
      const saves = 1 - sum(sharkGames, 'goalsAgainst5v5') / sum(sharkGames, 'shots5v5Against');
      expect(team.values.pdo).toBeCloseTo((shooting + saves) * 100, 10);
      expect(team.values.shooting5v5).toBeCloseTo(shooting, 10);
      expect(team.values.save5v5).toBeCloseTo(saves, 10);
      expect(team.values.powerPlay).toBeCloseTo(
          (sum(sharkGames, 'ppGoalsFor') - sum(sharkGames, 'shGoalsAgainst')) / sum(sharkGames, 'ppOpportunities'), 10);
      expect(team.values.penaltyDiff).toBeCloseTo(
          (sum(sharkGames, 'ppOpportunities') - sum(sharkGames, 'timesShorthanded')) / 22, 10);
    });

    it('should work out a team\'s xGF% from NST\'s real games', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games);
      const team = ratings.find(rating => rating.teamId === sharks);
      // 36.56 xG for and 55.96 against at 5v5
      expect(team.values.expectedGoals).toBeCloseTo(36.56 / (36.56 + 55.96), 4);
      expect(TeamRatingUtils.getMetric('expectedGoals').format(team.values.expectedGoals)).toBe('39.5%');
      const higher = ratings.filter(rating => rating.values.expectedGoals > team.values.expectedGoals + 1e-9).length;
      expect(team.ranks.expectedGoals).toBe(higher + 1);
      expect(team.scores.expectedGoals).toBeLessThan(TeamRatingUtils.averageRating);
    });

    it('should not rate the penalty kill', () => {
      // The same play with every penalty killed or none of them rates the same
      const rate = (ppGoalsAgainst: number) => TeamRatingUtils.getLeagueRatings(
          games.map(game => game.teamId === sharks ? {...game, ppGoalsAgainst, shGoalsFor: 0} : game))
          .find(rating => rating.teamId === sharks);
      expect(rate(0).rating).toBeCloseTo(rate(4).rating, 10);
      expect(rate(0).values.specialTeams).toBeGreaterThan(rate(4).values.specialTeams);
    });

    it('should rank a stat by how many teams are better at it', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games);
      const team = ratings.find(rating => rating.teamId === sharks);
      const better = ratings.filter(rating => rating.values.pointPct > team.values.pointPct + 1e-9).length;
      expect(team.ranks.pointPct).toBe(better + 1);
    });

    it('should give teams with the same value the same rank', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games);
      const byPoints = new Map<number, number[]>();
      ratings.forEach(rating => {
        const key = Math.round(rating.values.pointPct * 1e6);
        byPoints.set(key, [...(byPoints.get(key) ?? []), rating.ranks.pointPct]);
      });
      const tied = [...byPoints.values()].filter(ranks => ranks.length > 1);
      expect(tied.length).toBeGreaterThan(0);
      tied.forEach(ranks => expect(new Set(ranks).size).toBe(1));
    });

    it('should rate a team with the best of every rated stat first', () => {
      // Gives San Jose every shot, chance and goal in each of its games
      const dominant = games.map(game => game.teamId === sharks
          ? {...game, satFor: 90, satAgainst: 5, shots5v5For: 40, shots5v5Against: 5, goalsFor5v5: 8, goalsAgainst5v5: 0,
            ppGoalsFor: 3, ppOpportunities: 5, shGoalsAgainst: 0, timesShorthanded: 1, expectedGoalsFor5v5: 6,
            expectedGoalsAgainst5v5: 0.3}
          : game);
      const team = TeamRatingUtils.getLeagueRatings(dominant).find(rating => rating.teamId === sharks);
      expect(team.rank).toBe(1);
      TeamRatingUtils.getRatedMetrics(team.weights).forEach(metric => {
        expect(team.ranks[metric.id]).withContext(metric.id).toBe(1);
        expect(team.scores[metric.id]).withContext(metric.id).toBeGreaterThan(TeamRatingUtils.averageRating);
      });
    });

    it('should not rate a team by its record', () => {
      // The same play with every game won 10-0 or lost 0-10 rates the same
      const rate = (points: number, goalsFor: number, goalsAgainst: number) => TeamRatingUtils.getLeagueRatings(
          games.map(game => game.teamId === sharks ? {...game, points, wins: points / 2, goalsFor, goalsAgainst} : game))
          .find(rating => rating.teamId === sharks);
      const winner = rate(2, 10, 0);
      const loser = rate(0, 0, 10);
      expect(winner.values.pointPct).toBe(1);
      expect(loser.values.pointPct).toBe(0);
      expect(winner.rating).toBeCloseTo(loser.rating, 10);
    });

    it('should count only the games up to a day', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games, {throughDate: '2026-10-10'});
      const team = ratings.find(rating => rating.teamId === sharks);
      expect(team.gamesPlayed).toBe(teamGames(sharks).filter(game => game.gameDate <= '2026-10-10').length);
    });

    it('should count only each team\'s last games', () => {
      const ratings = TeamRatingUtils.getLeagueRatings(games, {lastGames: 10});
      const team = ratings.find(rating => rating.teamId === sharks);
      const lastTen = teamGames(sharks).slice(-10);
      expect(team.gamesPlayed).toBe(10);
      expect(team.values.pointPct).toBeCloseTo(sum(lastTen, 'points') / 20, 10);
    });

    it('should rate no one without games', () => {
      expect(TeamRatingUtils.getLeagueRatings([])).toEqual([]);
      expect(TeamRatingUtils.getLeagueRatings(null)).toEqual([]);
    });

    it('should rate every team as average when all their stats are the same', () => {
      const even = games.slice(0, 2).map(game => ({...game, points: 1, goalsFor: 2, goalsAgainst: 2, satFor: 20,
        satAgainst: 20, shots5v5For: 20, shots5v5Against: 20, goalsFor5v5: 2, goalsAgainst5v5: 2, ppGoalsFor: 0,
        shGoalsFor: 0, ppGoalsAgainst: 0, shGoalsAgainst: 0, ppOpportunities: 2, timesShorthanded: 2,
        expectedGoalsFor5v5: 2, expectedGoalsAgainst5v5: 2}));
      const ratings = TeamRatingUtils.getLeagueRatings(even);
      expect(ratings.length).toBe(2);
      ratings.forEach(rating => {
        expect(rating.rating).toBe(TeamRatingUtils.averageRating);
        expect(rating.rank).toBe(1);
      });
    });
  });

  describe('getTimeline', () => {
    it('should rate a team after each of its games from its 3rd', () => {
      const points = TeamRatingUtils.getTimeline(games, [sharks]).get(sharks);
      const dates = teamGames(sharks).map(game => game.gameDate);
      expect(points.length).toBe(22 - 2);
      expect(points.map(point => point.date)).toEqual(dates.slice(2));
      expect(points.map(point => point.gamesPlayed)).toEqual(dates.slice(2).map((date, i) => i + 3));
    });

    it('should end on the season rating', () => {
      const points = TeamRatingUtils.getTimeline(games, [sharks]).get(sharks);
      const season = TeamRatingUtils.getLeagueRatings(games).find(rating => rating.teamId === sharks);
      expect(points[points.length - 1].rating).toBeCloseTo(season.rating, 10);
      expect(points[points.length - 1].rank).toBe(season.rank);
    });

    it('should rate each day as the league stood that night', () => {
      const points = TeamRatingUtils.getTimeline(games, [sharks]).get(sharks);
      const point = points[4];
      const thatNight = TeamRatingUtils.getLeagueRatings(games, {throughDate: point.date})
          .find(rating => rating.teamId === sharks);
      expect(point.rating).toBeCloseTo(thatNight.rating, 10);
      expect(point.values.pointPct).toBeCloseTo(thatNight.values.pointPct, 10);
    });

    it('should fall back on the days a team has no expected goals', () => {
      // NST's games stop before San Jose's 6th game, so its last 10 games later on have no expected goals
      const cutoff = teamGames(sharks)[5].gameDate;
      const dates = new Map(nhlGames.map(game => [game.gameId, game.gameDate]));
      const partial = TeamRatingUtils.withExpectedGoals(nhlGames,
          mockNstTeamGameRows().filter(row => dates.get(row.gameId) < cutoff));
      const points = TeamRatingUtils.getTimeline(partial, [sharks], {lastGames: 10}).get(sharks);
      expect(points[0].hasExpectedGoals).toBeTrue();
      expect(points[0].weights).toBe(TeamRatingUtils.expectedGoalsWeights);
      expect(points[points.length - 1].hasExpectedGoals).toBeFalse();
      expect(points[points.length - 1].weights).toBe(TeamRatingUtils.nhlWeights);
    });

    it('should rate the last games only, with lastGames', () => {
      const points = TeamRatingUtils.getTimeline(games, [sharks], {lastGames: 10}).get(sharks);
      const lastTen = TeamRatingUtils.getLeagueRatings(games, {lastGames: 10}).find(rating => rating.teamId === sharks);
      expect(points[points.length - 1].gamesPlayed).toBe(10);
      expect(points[points.length - 1].rating).toBeCloseTo(lastTen.rating, 10);
    });

    it('should chart several teams at once', () => {
      const timeline = TeamRatingUtils.getTimeline(games, [sharks, 6]);
      expect(timeline.get(sharks).length).toBe(20);
      expect(timeline.get(6).length).toBe(teamGames(6).length - 2);
    });

    it('should chart nothing without games', () => {
      expect(TeamRatingUtils.getTimeline([], [sharks]).get(sharks)).toEqual([]);
      expect(TeamRatingUtils.getTimeline(null, null).size).toBe(0);
    });
  });

  describe('getRatingColor', () => {
    it('should use the HokMob rating colors', () => {
      expect(TeamRatingUtils.getRatingColor(7.2)).toBe('#0e87e0');
      expect(TeamRatingUtils.getRatingColor(7)).toBe('#0e87e0');
      expect(TeamRatingUtils.getRatingColor(5.5)).toBe('#1ec854');
      expect(TeamRatingUtils.getRatingColor(5)).toBe('#e68122');
      expect(TeamRatingUtils.getRatingColor(3.99)).toBe('#e55b5b');
    });
  });

  describe('formatRating', () => {
    it('should show one decimal, or a dash without a rating', () => {
      expect(TeamRatingUtils.formatRating(3.649)).toBe('3.6');
      expect(TeamRatingUtils.formatRating(null)).toBe('-');
    });
  });

  describe('getOrdinal', () => {
    it('should add the right suffix', () => {
      expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 32, 101, 111].map(rank => TeamRatingUtils.getOrdinal(rank)))
          .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '32nd', '101st', '111th']);
    });

    it('should be empty without a rank', () => {
      expect(TeamRatingUtils.getOrdinal(null)).toBe('');
    });
  });
});
