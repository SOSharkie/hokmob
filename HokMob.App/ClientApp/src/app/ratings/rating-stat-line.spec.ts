import { BoxscoreGoalie, GamePlayer } from '@shared/models/nhl-web-api/boxscore.model';
import { StatsUtils } from '@shared/utils/stats-utils';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { mockGameBoxscore, mockGameLanding, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { RatingStatLineUtils } from './rating-stat-line';

describe('RatingStatLineUtils', () => {

  /** The players of 2025021057 (STL @ WPG) as the game page builds them, with the play-by-play and landing loaded. */
  function gamePlayers(): GamePlayer[] {
    const playByPlay = mockGamePlayByPlay(2025021057);
    const rosterSpots = PlayByPlayUtils.getRosterSpotMap(playByPlay);
    const faceoffCounts = PlayByPlayUtils.getFaceoffCounts(playByPlay);
    const assistCounts = StatsUtils.getAssistCounts(mockGameLanding(2025021057));
    return [true, false].flatMap(isHome => StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), isHome,
        rosterSpots, faceoffCounts, assistCounts));
  }

  function player(playerId: number): GamePlayer {
    return gamePlayers().find(gamePlayer => gamePlayer.playerId === playerId);
  }

  describe('getQueryParams', () => {
    it("should hold a skater's name, rating and every stat of his line", () => {
      const scheifele = player(8476460);
      const params = RatingStatLineUtils.getQueryParams(scheifele);
      expect(params['subject']).toBe('skater');
      expect(params['name']).toBe('Mark Scheifele');
      expect(params['rating']).toBe(scheifele.hokmobRating);
      expect(params['goals']).toBe(scheifele.skaterStats.goals);
      expect(params['hits']).toBe(scheifele.skaterStats.hits);
      expect(params['faceoffsTaken']).toBe(scheifele.ratingContext.faceoffsTaken);
      expect(params['primaryAssists'] + params['secondaryAssists']).toBe(scheifele.skaterStats.assists);
    });

    it("should hold a goalie's shots and goals against", () => {
      const goalie = gamePlayers().find(gamePlayer => gamePlayer.goalieStats?.shotsAgainst > 0);
      const params = RatingStatLineUtils.getQueryParams(goalie);
      expect(params['subject']).toBe('goalie');
      expect(params['evenStrengthShots'] + params['penaltyKillShots'] + params['powerPlayShots'])
          .toBe(goalie.goalieStats.shotsAgainst);
      expect(params['evenStrengthGoals'] + params['penaltyKillGoals'] + params['powerPlayGoals'])
          .toBe(goalie.goalieStats.goalsAgainst);
      expect(params['goals']).toBeUndefined();
    });
  });

  describe('getSkaterLine', () => {
    it('should work out the draws won from the win percentage and the draws taken', () => {
      const center = gamePlayers().find(gamePlayer => gamePlayer.ratingContext?.faceoffsTaken > 5);
      const line = RatingStatLineUtils.getSkaterLine(center.skaterStats, center.ratingContext);
      expect(line['faceoffsTaken']).toBe(center.ratingContext.faceoffsTaken);
      expect(line['faceoffWins'] / line['faceoffsTaken']).toBeCloseTo(center.skaterStats.faceoffWinningPctg, 2);
    });

    it('should read every assist as primary, and no draws or power play assists, without the context', () => {
      const withAssist = gamePlayers().find(gamePlayer => gamePlayer.skaterStats?.assists > 0);
      const line = RatingStatLineUtils.getSkaterLine(withAssist.skaterStats);
      expect(line['primaryAssists']).toBe(withAssist.skaterStats.assists);
      expect(line['secondaryAssists']).toBe(0);
      expect(line['powerPlayAssists']).toBe(0);
      expect(line['faceoffsTaken']).toBe(0);
      expect(line['faceoffWins']).toBe(0);
    });

    it('should read a missing skater as an empty line', () => {
      expect(Object.values(RatingStatLineUtils.getSkaterLine(null)).every(value => value === 0)).toBeTrue();
    });
  });

  describe('getGoalieLine', () => {
    it('should split the shots by strength, the power play split being the penalty kill', () => {
      const goalie = {evenStrengthShotsAgainst: '20/22', powerPlayShotsAgainst: '4/5', shorthandedShotsAgainst: '1/1'};
      expect(RatingStatLineUtils.getGoalieLine(goalie as BoxscoreGoalie)).toEqual({evenStrengthShots: 22,
        evenStrengthGoals: 2, penaltyKillShots: 5, penaltyKillGoals: 1, powerPlayShots: 1, powerPlayGoals: 0});
    });

    it('should read a missing or unreadable split as no shots', () => {
      const goalie = {evenStrengthShotsAgainst: 'x', powerPlayShotsAgainst: undefined, shorthandedShotsAgainst: ''};
      expect(Object.values(RatingStatLineUtils.getGoalieLine(goalie as BoxscoreGoalie)).every(value => value === 0))
          .toBeTrue();
    });
  });
});
