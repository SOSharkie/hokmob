import {SeasonHistoryService} from '@shared/services/season-history.service';
import {RatedSeason} from '@shared/models/nhl-history/season-history.model';
import {derivedSeasonHistoryInProgress, mockSeasonHistory} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {PlayerSeasonRatingUtils} from '@shared/utils/player-season-rating-utils';
import {StatsUtils} from '@shared/utils/stats-utils';

describe('PlayerSeasonRatingUtils', () => {

  let ratedSeason: RatedSeason;

  beforeEach(() => {
    ratedSeason = SeasonHistoryService.rateSeason(mockSeasonHistory());
  });

  function ratingsOf(playerId: number): number[] {
    return ratedSeason.ratedGames.filter(game => game.player.id === playerId).map(game => game.rating);
  }

  describe('getPlayerSeasonRating', () => {
    it('should average a skater\'s game ratings and sum his 5v5 shot attempts', () => {
      // Ivan Barbashev's one game, 2025021290, has 11 shot attempts for and 5 against
      const seasonRating = PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8477964);
      expect(seasonRating.gamesRated).toBe(1);
      expect(seasonRating.averageRating).toBe(ratingsOf(8477964)[0]);
      expect(seasonRating.corsiForPct).toBeCloseTo(11 / 16, 10);
      expect(seasonRating.goalsSavedAboveAverage).toBeUndefined();
      expect(seasonRating.throughDate).toBeUndefined();
    });

    it('should average every game of a skater with several', () => {
      // Elias Lindholm plays 2025021237 and 2025021292
      const ratings = ratingsOf(8477496);
      expect(ratings.length).toBe(2);
      const seasonRating = PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8477496);
      expect(seasonRating.gamesRated).toBe(2);
      expect(seasonRating.averageRating).toBeCloseTo((ratings[0] + ratings[1]) / 2, 10);
    });

    it('should sum a goalie\'s goals saved above average, with no Corsi', () => {
      // Connor Hellebuyck in 2025021290: 18 of 21 at even strength, 13 of 15 on the penalty kill, 1 of 2 shorthanded
      const seasonRating = PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8476945);
      expect(seasonRating.gamesRated).toBe(1);
      expect(seasonRating.goalsSavedAboveAverage).toBeCloseTo(
          18 - StatsUtils.leagueEvenStrengthSavePctg * 21 +
          13 - StatsUtils.leaguePenaltyKillSavePctg * 15 +
          1 - StatsUtils.leaguePowerPlaySavePctg * 2, 10);
      expect(seasonRating.corsiForPct).toBeUndefined();
    });

    it('should count both of a goalie\'s games', () => {
      // Brandon Bussi plays 2025021237 and 2025021292
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8483548).gamesRated).toBe(2);
    });

    it('should keep how far a season in progress goes', () => {
      const inProgress = SeasonHistoryService.rateSeason(derivedSeasonHistoryInProgress());
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating(inProgress, 8477964).throughDate).toBe('2026-04-14');
    });

    it('should have nothing for a player without a rated game', () => {
      // Patrice Bergeron isn't in the file, and Pyotr Kochetkov's one game is left out, as he faced no shots
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8470638)).toBeUndefined();
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8481611)).toBeUndefined();
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating({...ratedSeason, ratedGames: []}, 8477964)).toBeUndefined();
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating(undefined, 8477964)).toBeUndefined();
    });

    it('should have no Corsi For % for a skater without a 5v5 shot attempt', () => {
      ratedSeason.ratedGames.filter(game => game.player.id === 8477964).forEach(game => {
        game.satFor = 0;
        game.satAgainst = 0;
      });
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8477964).corsiForPct).toBeUndefined();
    });
  });

  describe('getTeamSeasonRatings', () => {
    it('should rate every player of a team, skaters and goalies', () => {
      // Boston plays 2025021237 and 2025021292
      const ratings = PlayerSeasonRatingUtils.getTeamSeasonRatings(ratedSeason, 6);
      expect(ratings.size).toBe(22);
      // David Pastrnak plays both games, both for Boston, so his team rating is his season rating
      expect(ratings.get(8477956)).toEqual(PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8477956));
      expect(ratings.get(8477956).gamesRated).toBe(2);
      // Jeremy Swayman is a goalie: goals saved above average, no Corsi
      expect(ratings.get(8480280).goalsSavedAboveAverage).toBeDefined();
      expect(ratings.get(8480280).corsiForPct).toBeUndefined();
      // Connor Hellebuyck never plays Boston's games
      expect(ratings.has(8476945)).toBeFalse();
    });

    it('should only count a traded player\'s games for the team', () => {
      // Nic Dowd plays 2025021259 for Washington and 2025021290 for Vegas
      expect(PlayerSeasonRatingUtils.getPlayerSeasonRating(ratedSeason, 8475343).gamesRated).toBe(2);
      const vegasRating = PlayerSeasonRatingUtils.getTeamSeasonRatings(ratedSeason, 54).get(8475343);
      expect(vegasRating.gamesRated).toBe(1);
      const vegasGame = ratedSeason.ratedGames.find(game => game.player.id === 8475343 && game.teamId === 54);
      expect(vegasRating.averageRating).toBe(vegasGame.rating);
    });

    it('should keep how far a season in progress goes', () => {
      const inProgress = SeasonHistoryService.rateSeason(derivedSeasonHistoryInProgress());
      expect(PlayerSeasonRatingUtils.getTeamSeasonRatings(inProgress, 6).get(8477956).throughDate).toBe('2026-04-14');
    });

    it('should have no ratings for a team without games, or without a season', () => {
      // Seattle (55) isn't in any of the 7 games
      expect(PlayerSeasonRatingUtils.getTeamSeasonRatings(ratedSeason, 55).size).toBe(0);
      expect(PlayerSeasonRatingUtils.getTeamSeasonRatings(undefined, 6).size).toBe(0);
    });
  });

  describe('formatting', () => {
    it('should show an average rating with two decimals, colored by its shown value', () => {
      expect(PlayerSeasonRatingUtils.formatAverageRating(7.123)).toBe('7.12');
      expect(PlayerSeasonRatingUtils.formatAverageRating(null)).toBe('-');
      expect(PlayerSeasonRatingUtils.getAverageRatingColor(6.996)).toBe(StatsUtils.hokmobRatingGreen);
      expect(PlayerSeasonRatingUtils.getAverageRatingColor(8.5)).toBe(StatsUtils.hokmobRatingBlue);
      expect(PlayerSeasonRatingUtils.getAverageRatingColor(null)).toBeUndefined();
    });

    it('should show a Corsi For % with one decimal', () => {
      expect(PlayerSeasonRatingUtils.formatCorsiForPct(11 / 16)).toBe('68.8%');
      expect(PlayerSeasonRatingUtils.formatCorsiForPct(undefined)).toBe('-');
    });

    it('should show goals saved above average with a sign', () => {
      expect(PlayerSeasonRatingUtils.formatGoalsSavedAboveAverage(4.24)).toBe('+4.2');
      expect(PlayerSeasonRatingUtils.formatGoalsSavedAboveAverage(-1.578)).toBe('-1.6');
      expect(PlayerSeasonRatingUtils.formatGoalsSavedAboveAverage(-0.04)).toBe('0.0');
      expect(PlayerSeasonRatingUtils.formatGoalsSavedAboveAverage(null)).toBe('-');
    });
  });
});
