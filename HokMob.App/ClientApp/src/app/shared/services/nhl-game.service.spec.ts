import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlGameService} from "@shared/services/nhl-game.service";
import {mockScoreResponse} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

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
});
