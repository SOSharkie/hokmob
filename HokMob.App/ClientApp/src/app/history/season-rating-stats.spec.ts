import {SeasonRatingStatsUtils} from "@app/history/season-rating-stats";
import {SeasonHistoryService} from "@shared/services/season-history.service";
import {mockSeasonHistory} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";
import {RatedGame} from "@shared/models/nhl-history/season-history.model";

describe('SeasonRatingStatsUtils', () => {

  /** The rated games of the 7 game fixture. */
  function ratedGames(): RatedGame[] {
    return SeasonHistoryService.rateSeason(mockSeasonHistory()).ratedGames;
  }

  /**
   * Real rated games, a forward from each game in game order, with their ratings replaced, for the edge cases the
   * fixture doesn't have. Up to 7.
   */
  function withRatings(ratings: number[]): RatedGame[] {
    const forwards = ratedGames().filter(game => game.position === 'F');
    return forwards.filter((game, index) => forwards.findIndex(other => other.game.id === game.game.id) === index)
        .slice(0, ratings.length)
        .map((game, index) => ({...game, rating: ratings[index]}));
  }

  describe('getDistribution', () => {
    it('should bin every rated game of a position group, from 0 to 10 in 0.5 steps', () => {
      const distribution = SeasonRatingStatsUtils.getDistribution(ratedGames(), 'F');
      expect(distribution.bins.length).toBe(20);
      expect(distribution.bins[0]).toEqual(jasmine.objectContaining({from: 0, to: 0.5}));
      expect(distribution.bins[19]).toEqual(jasmine.objectContaining({from: 9.5, to: 10}));
      expect(distribution.total).toBe(168);
      expect(distribution.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(168);
    });

    it('should add up to each position group\'s games', () => {
      const games = ratedGames();
      (['F', 'D', 'G'] as const).forEach(position => {
        const distribution = SeasonRatingStatsUtils.getDistribution(games, position);
        const count = games.filter(game => game.position === position).length;
        expect(distribution.total).withContext(position).toBe(count);
        expect(distribution.bins.reduce((sum, bin) => sum + bin.count, 0)).withContext(position).toBe(count);
      });
      // Every goalie but the one who faced no shots
      expect(SeasonRatingStatsUtils.getDistribution(games, 'G').total).toBe(15);
    });

    it('should work out the mean, median and green and blue shares', () => {
      const games = ratedGames().filter(game => game.position === 'D');
      const distribution = SeasonRatingStatsUtils.getDistribution(games, 'D');
      const ratings = games.map(game => game.rating).sort((a, b) => a - b);
      expect(distribution.mean).toBeCloseTo(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length, 10);
      // 84 games, so the median is between the 42nd and 43rd
      expect(distribution.median).toBeCloseTo((ratings[41] + ratings[42]) / 2, 10);
      expect(distribution.greenShare).toBeCloseTo(ratings.filter(rating => rating >= 7).length / 84, 10);
      expect(distribution.blueShare).toBeCloseTo(ratings.filter(rating => rating >= 8.5).length / 84, 10);
    });

    it('should put a rating on a bin edge in the bin it starts, and 10 and below 0 in the end bins', () => {
      const distribution = SeasonRatingStatsUtils.getDistribution(withRatings([7, 6.9, 8.5, 10, -0.4, 0.5]), 'F');
      const countFrom = (from: number) => distribution.bins.find(bin => bin.from === from).count;
      expect(countFrom(7)).toBe(1);
      expect(countFrom(6.5)).toBe(1);
      expect(countFrom(8.5)).toBe(1);
      expect(countFrom(9.5)).toBe(1);
      expect(countFrom(0)).toBe(1);
      expect(countFrom(0.5)).toBe(1);
      // 7, 8.5 and 10 are green, 8.5 and 10 are blue
      expect(distribution.greenShare).toBeCloseTo(3 / 6, 10);
      expect(distribution.blueShare).toBeCloseTo(2 / 6, 10);
    });

    it('should take the middle rating of an odd count as the median', () => {
      expect(SeasonRatingStatsUtils.getDistribution(withRatings([6, 9, 5.5]), 'F').median).toBe(6);
    });

    it('should give empty bins and 0s without games', () => {
      [[], null].forEach(games => {
        const distribution = SeasonRatingStatsUtils.getDistribution(games, 'G');
        expect(distribution.total).toBe(0);
        expect(distribution.bins.every(bin => bin.count === 0)).toBeTrue();
        expect(distribution.mean).toBe(0);
        expect(distribution.median).toBe(0);
        expect(distribution.greenShare).toBe(0);
      });
    });
  });

  describe('getAverageLeaders', () => {
    it('should list the best averages first, among players with the minimum games', () => {
      const games = ratedGames();
      const leaders = SeasonRatingStatsUtils.getAverageLeaders(games, {minGames: 3, limit: 50});
      // Carolina played 3 of the games
      expect(leaders.length).toBeGreaterThan(0);
      leaders.forEach(leader => {
        expect(leader.gamesPlayed).toBeGreaterThanOrEqual(3);
        const ratings = games.filter(game => game.player.id === leader.player.id).map(game => game.rating);
        expect(leader.averageRating).toBeCloseTo(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length, 10);
      });
      const averages = leaders.map(leader => leader.averageRating);
      expect(averages).toEqual([...averages].sort((a, b) => b - a));
      expect(leaders.some(leader => leader.player.name === 'Taylor Hall')).toBeFalse();
      expect(leaders.some(leader => leader.player.name === 'Nikolaj Ehlers')).toBeTrue();
    });

    it('should leave out every player under the minimum', () => {
      expect(SeasonRatingStatsUtils.getAverageLeaders(ratedGames(), {minGames: 20, limit: 25})).toEqual([]);
    });

    it('should filter by position group and cap the list', () => {
      const goalies = SeasonRatingStatsUtils.getAverageLeaders(ratedGames(), {position: 'G', minGames: 1, limit: 50});
      // 15 games by 13 goalies
      expect(goalies.length).toBe(13);
      expect(goalies.every(leader => leader.player.position === 'G')).toBeTrue();
      expect(goalies.find(leader => leader.player.name === 'Brandon Bussi').gamesPlayed).toBe(2);
      expect(SeasonRatingStatsUtils.getAverageLeaders(ratedGames(), {position: 'D', minGames: 1, limit: 5}).length)
          .toBe(5);
    });

    it('should only count a player\'s games for the team, and show that team', () => {
      const games = ratedGames();
      const vegas = SeasonRatingStatsUtils.getAverageLeaders(games, {teamId: 54, minGames: 1, limit: 50});
      expect(vegas.every(leader => leader.teamId === 54)).toBeTrue();
      const dowdForVegas = vegas.find(leader => leader.player.name === 'Nic Dowd');
      expect(dowdForVegas.gamesPlayed).toBe(1);
      expect(dowdForVegas.averageRating)
          .toBe(games.find(game => game.player.name === 'Nic Dowd' && game.teamId === 54).rating);

      // Without a team, both games count, with the team of the last one
      const dowd = SeasonRatingStatsUtils.getAverageLeaders(games, {minGames: 1, limit: 300})
          .find(leader => leader.player.name === 'Nic Dowd');
      expect(dowd.gamesPlayed).toBe(2);
      expect(dowd.teamId).toBe(54);
    });

    it('should break a tie with the player who played more games', () => {
      const games = ratedGames().filter(game => ['Jordan Martinook', 'Taylor Hall'].includes(game.player.name))
          .map(game => ({...game, rating: 7}));
      const leaders = SeasonRatingStatsUtils.getAverageLeaders(games, {minGames: 1, limit: 5});
      expect(leaders.map(leader => [leader.player.name, leader.gamesPlayed]))
          .toEqual([['Jordan Martinook', 3], ['Taylor Hall', 2]]);
    });

    it('should list nobody without games', () => {
      expect(SeasonRatingStatsUtils.getAverageLeaders(null, {minGames: 1, limit: 5})).toEqual([]);
    });
  });

  describe('getBestGames', () => {
    it('should list the best rated games first, capped at the limit', () => {
      const bestGames = SeasonRatingStatsUtils.getBestGames(ratedGames(), null, 10);
      expect(bestGames.length).toBe(10);
      const ratings = bestGames.map(game => game.rating);
      expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
      expect(ratings[0]).toBe(Math.max(...ratedGames().map(game => game.rating)));
    });

    it('should filter by position group', () => {
      const goalies = SeasonRatingStatsUtils.getBestGames(ratedGames(), 'G', 50);
      expect(goalies.length).toBe(15);
      expect(goalies.every(game => game.position === 'G')).toBeTrue();
    });

    it('should rank the games capped at 10 by their uncapped rating, then the earlier game first', () => {
      const [first, second, third] = withRatings([10, 10, 10]);
      first.uncappedRating = 10.4;
      second.uncappedRating = 11.2;
      third.uncappedRating = 10.4;
      expect(SeasonRatingStatsUtils.getBestGames([third, first, second], null, 3)).toEqual([second, first, third]);
    });

    it('should list nothing without games', () => {
      expect(SeasonRatingStatsUtils.getBestGames(undefined, 'F', 5)).toEqual([]);
    });
  });
});
