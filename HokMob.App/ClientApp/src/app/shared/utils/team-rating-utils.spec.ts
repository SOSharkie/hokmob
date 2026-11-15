import {TeamRatingUtils} from './team-rating-utils';
import {TeamGameStats} from "@shared/models/nhl-stats-api/team-games.model";
import {mockTeamGameRows} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('TeamRatingUtils', () => {
  /** San Jose: 22 games, 20 points, 56 goals for and 77 against through 2026-11-14 in the fixture. */
  const sharks = 28;

  let games: TeamGameStats[];

  beforeEach(() => {
    games = mockTeamGameRows();
  });

  /** A team's games in the fixture, oldest first. */
  function teamGames(teamId: number): TeamGameStats[] {
    return games.filter(game => game.teamId === teamId);
  }

  function sum(rows: TeamGameStats[], field: keyof TeamGameStats): number {
    return rows.reduce((total, row) => total + (row[field] as number), 0);
  }

  describe('metrics', () => {
    it('should weigh the rated stats to a whole rating', () => {
      expect(TeamRatingUtils.ratedMetrics.map(metric => [metric.id, metric.weight])).toEqual([
        ['pointPct', 0.3], ['goalDiff', 0.2], ['corsi', 0.3], ['specialTeams', 0.2]
      ]);
      const total = TeamRatingUtils.metrics.reduce((weights, metric) => weights + metric.weight, 0);
      expect(total).toBeCloseTo(1, 10);
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

    it('should give zeros without games', () => {
      const totals = TeamRatingUtils.getTotals(null);
      expect(totals.gamesPlayed).toBe(0);
      expect(totals.goalsFor).toBe(0);
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
      // San Jose, 26th through 2026-11-14
      expect(TeamRatingUtils.formatRating(ratings.find(rating => rating.teamId === sharks).rating)).toBe('3.7');
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
      // Gives San Jose a 10-0 win in each of its games
      const dominant = games.map(game => game.teamId === sharks
          ? {...game, points: 2, goalsFor: 10, goalsAgainst: 0, satFor: 90, satAgainst: 5, ppGoalsFor: 5}
          : game);
      const team = TeamRatingUtils.getLeagueRatings(dominant).find(rating => rating.teamId === sharks);
      expect(team.rank).toBe(1);
      expect(team.ranks.pointPct).toBe(1);
      expect(team.ranks.corsi).toBe(1);
      expect(team.scores.corsi).toBeGreaterThan(TeamRatingUtils.averageRating);
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
        satAgainst: 20, ppGoalsFor: 0, shGoalsFor: 0, ppGoalsAgainst: 0, shGoalsAgainst: 0}));
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
