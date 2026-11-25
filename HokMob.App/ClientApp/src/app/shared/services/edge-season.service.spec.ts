import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {EdgeSeasonService} from '@shared/services/edge-season.service';
import {mockEdgeSeasonFile} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('EdgeSeasonService', () => {
  let service: EdgeSeasonService;
  let httpMock: HttpTestingController;

  const edgeUrl = 'assets/edge/20262027-2.json';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EdgeSeasonService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(EdgeSeasonService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load the season file as one row per skater, by NHL player ID', async () => {
    const edgeSeason = service.getEdgeSeason(20262027);
    httpMock.expectOne(edgeUrl).flush(mockEdgeSeasonFile());

    const season = await edgeSeason;
    expect(season.season).toBe(20262027);
    expect(season.throughDate).toBe('2026-11-24');
    expect(season.skaters.length).toBe(50);
    const draisaitl = season.skaters.find(row => row.playerId === 8477934);
    // Leon Draisaitl
    expect(draisaitl.speedMax).toBe(22.272);
    expect(draisaitl.burstsOver20).toBe(61);
    expect(draisaitl.gamesPlayed).toBe(27);
  });

  it('should keep a season for the session, so the next player does not load it again', async () => {
    const first = service.getEdgeSeason(20262027);
    httpMock.expectOne(edgeUrl).flush(mockEdgeSeasonFile());
    await first;
    expect((await service.getEdgeSeason(20262027)).skaters.length).toBeGreaterThan(0);
    httpMock.expectNone(edgeUrl);
  });

  it('should resolve undefined without asking for a season before EDGE', async () => {
    expect(EdgeSeasonService.hasSeason(20202021)).toBeFalse();
    expect(await service.getEdgeSeason(20202021)).toBeUndefined();
    httpMock.expectNone(() => true);
  });

  it('should list the seasons with a file, newest first, from the season in progress', () => {
    expect(EdgeSeasonService.seasons).toEqual([20262027, 20252026, 20242025, 20232024]);
  });

  it('should resolve no skaters for a file without them', async () => {
    const edgeSeason = service.getEdgeSeason(20262027);
    httpMock.expectOne(edgeUrl).flush({version: 1, season: 20262027, gameType: 2});
    expect((await edgeSeason).skaters).toEqual([]);
  });

  it('should reject and log when the file fails, and load it again next time', async () => {
    const edgeSeason = service.getEdgeSeason(20262027);
    httpMock.expectOne(edgeUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
    await expectAsync(edgeSeason).toBeRejected();
    expect(console.error).toHaveBeenCalled();
    service.getEdgeSeason(20262027);
    httpMock.expectOne(edgeUrl).flush(mockEdgeSeasonFile());
  });
});
