import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlGameService} from "@shared/services/nhl-game.service";
import {
  mockGameBoxscore,
  mockGameLanding,
  mockGamePlayByPlay,
  mockGameRightRail,
  mockPlayoffScoreResponse,
  mockScoreResponse
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlGameService', () => {
  let service: NhlGameService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NhlGameService]
    });
    service = TestBed.inject(NhlGameService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getNhlGames', () => {
    it('should request the score for the date and resolve its games', async () => {
      const games = service.getNhlGames(new Date(2026, 2, 1, 12, 0));
      httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
      expect((await games).map(game => game.id)).toEqual([2025020947, 2025020950, 2025020952]);
    });

    it('should use the local date, even late in the evening', async () => {
      const games = service.getNhlGames(new Date(2026, 2, 1, 23, 59));
      httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
      expect((await games).length).toBe(3);
    });

    it('should resolve no games for a day without games', async () => {
      const emptyDay = service.getNhlGames(new Date(2026, 6, 15));
      httpMock.expectOne('/api/nhl/score/2026-07-15').flush({...mockScoreResponse(), games: []});
      expect(await emptyDay).toEqual([]);

      const missingGames = service.getNhlGames(new Date(2026, 6, 16));
      httpMock.expectOne('/api/nhl/score/2026-07-16').flush({...mockScoreResponse(), games: undefined});
      expect(await missingGames).toEqual([]);
    });

    it('should log and reject when the request fails', async () => {
      const games = service.getNhlGames(new Date(2026, 2, 1));
      const rejection = expectAsync(games).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl/score/2026-03-01').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getGameBundle', () => {
    const regulationUrl = '/api/nhl/gamecenter/2025021057';

    function serverError(status = 500): {status: number, statusText: string} {
      return {status, statusText: 'Server Error'};
    }

    it('should request the four gamecenter responses and resolve them together', async () => {
      const bundle = service.getGameBundle('2025021057');
      httpMock.expectOne(regulationUrl + '/landing').flush(mockGameLanding(2025021057));
      httpMock.expectOne(regulationUrl + '/play-by-play').flush(mockGamePlayByPlay(2025021057));
      httpMock.expectOne(regulationUrl + '/boxscore').flush(mockGameBoxscore(2025021057));
      httpMock.expectOne(regulationUrl + '/right-rail').flush(mockGameRightRail(2025021057));

      const result = await bundle;
      expect(result.landing.homeTeam.commonName.default).toBe('Jets');
      expect(result.landing.awayTeam.commonName.default).toBe('Blues');
      expect(result.playByPlay.plays.length).toBe(270);
      expect(result.boxscore.id).toBe(2025021057);
      expect(result.rightRail.teamGameStats.find(stat => stat.category === 'sog'))
          .toEqual(jasmine.objectContaining({homeValue: 16, awayValue: 31}));
    });

    it('should resolve a future game, whose responses have no summary or stats', async () => {
      const futureUrl = '/api/nhl/gamecenter/2026020056';
      const bundle = service.getGameBundle('2026020056');
      httpMock.expectOne(futureUrl + '/landing').flush(mockGameLanding(2026020056));
      httpMock.expectOne(futureUrl + '/play-by-play').flush(mockGamePlayByPlay(2026020056));
      httpMock.expectOne(futureUrl + '/boxscore').flush(mockGameBoxscore(2026020056));
      httpMock.expectOne(futureUrl + '/right-rail').flush(mockGameRightRail(2026020056));

      const result = await bundle;
      expect(result.landing.gameState).toBe('FUT');
      expect(result.landing.homeTeam.score).toBeUndefined();
      expect(result.landing.summary).toBeUndefined();
      expect(result.playByPlay.id).toBe(2026020056);
      expect(result.boxscore.playerByGameStats).toBeUndefined();
      expect(result.rightRail.teamGameStats).toBeUndefined();
    });

    it('should resolve without the optional responses whose requests fail', async () => {
      const bundle = service.getGameBundle('2025021057');
      httpMock.expectOne(regulationUrl + '/landing').flush(mockGameLanding(2025021057));
      httpMock.expectOne(regulationUrl + '/play-by-play').flush('Server error', serverError());
      httpMock.expectOne(regulationUrl + '/boxscore').flush(mockGameBoxscore(2025021057));
      httpMock.expectOne(regulationUrl + '/right-rail').flush('Not found', serverError(404));

      const result = await bundle;
      expect(result.landing.id).toBe(2025021057);
      expect(result.playByPlay).toBeUndefined();
      expect(result.boxscore.id).toBe(2025021057);
      expect(result.rightRail).toBeUndefined();
      expect(console.error).toHaveBeenCalledTimes(2);
    });

    it('should log and reject when the landing fails', async () => {
      const bundle = service.getGameBundle('2025021057');
      const rejection = expectAsync(bundle).toBeRejectedWith(jasmine.objectContaining({status: 503}));
      httpMock.expectOne(regulationUrl + '/landing').flush('Service unavailable', serverError(503));
      httpMock.expectOne(regulationUrl + '/play-by-play').flush(mockGamePlayByPlay(2025021057));
      httpMock.expectOne(regulationUrl + '/boxscore').flush(mockGameBoxscore(2025021057));
      httpMock.expectOne(regulationUrl + '/right-rail').flush(mockGameRightRail(2025021057));
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getSeriesStatus', () => {
    it('should find the game in the score for its date and resolve its series status', async () => {
      const seriesStatus = service.getSeriesStatus(2025030414, '2026-06-09');
      httpMock.expectOne('/api/nhl/score/2026-06-09').flush(mockPlayoffScoreResponse());
      expect(await seriesStatus).toEqual(jasmine.objectContaining({
        seriesTitle: 'Stanley Cup Final', topSeedTeamAbbrev: 'CAR', topSeedWins: 2, bottomSeedTeamAbbrev: 'VGK',
        bottomSeedWins: 2, gameNumberOfSeries: 4
      }));
    });

    it('should resolve undefined for a game without series status or missing from the score', async () => {
      const regularSeason = service.getSeriesStatus(2025020952, '2026-03-01');
      httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
      expect(await regularSeason).toBeUndefined();

      const otherDay = service.getSeriesStatus(2025030414, '2026-03-01');
      httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
      expect(await otherDay).toBeUndefined();

      const noGames = service.getSeriesStatus(2025030414, '2026-06-09');
      httpMock.expectOne('/api/nhl/score/2026-06-09').flush({...mockPlayoffScoreResponse(), games: undefined});
      expect(await noGames).toBeUndefined();
    });

    it('should log and reject when the request fails', async () => {
      const seriesStatus = service.getSeriesStatus(2025030414, '2026-06-09');
      const rejection = expectAsync(seriesStatus).toBeRejected();
      httpMock.expectOne('/api/nhl/score/2026-06-09').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });
});
