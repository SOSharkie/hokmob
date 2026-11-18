import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';
import { NaturalStatTrickService } from '@shared/services/natural-stat-trick.service';
import {
  mockNstTeamGames,
  mockRatedTeamGameRows,
  mockTeamGameRows,
  mockTeamGames
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamRatingService } from './team-rating.service';

describe('TeamRatingService', () => {
  let service: TeamRatingService;
  let httpMock: HttpTestingController;

  const teamGamesUrl = '/api/nhl-stats/team-games?season=20262027&gameType=2';
  const nstTeamGamesUrl = '/api/nst/team-games?season=20262027';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TeamRatingService, NhlStatsApiService, NaturalStatTrickService, provideHttpClient(), provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(TeamRatingService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load the season\'s games with Natural Stat Trick\'s expected goals', async () => {
    const games = service.getRatedGames(20262027);
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    expect(await games).toEqual(mockRatedTeamGameRows());
  });

  it('should load the games without expected goals when Natural Stat Trick fails', async () => {
    const games = service.getRatedGames(20262027);
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    httpMock.expectOne(nstTeamGamesUrl).flush('Unavailable', {status: 503, statusText: 'Service Unavailable'});
    const rows = await games;
    expect(rows).toEqual(mockTeamGameRows());
    expect(rows.some(row => row.expectedGoalsFor5v5 != null)).toBeFalse();
  });

  it('should load a season once for every page that asks for it', async () => {
    const first = service.getRatedGames(20262027);
    const second = service.getRatedGames(20262027);
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    expect(second).toBe(first);
    await first;
    service.getRatedGames(20262027);
    httpMock.expectNone(teamGamesUrl);
  });

  it('should load a season again once it has been kept for a while, for its new games', async () => {
    const now = spyOn(Date, 'now').and.returnValue(1_000_000);
    const first = service.getRatedGames(20262027);
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    await first;
    now.and.returnValue(1_000_000 + TeamRatingService.cacheTime);
    service.getRatedGames(20262027);
    httpMock.expectOne(teamGamesUrl);
    httpMock.expectOne(nstTeamGamesUrl);
  });

  it('should reject when the games fail, and try again on the next call', async () => {
    const games = service.getRatedGames(20262027);
    httpMock.expectOne(teamGamesUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    await expectAsync(games).toBeRejected();
    service.getRatedGames(20262027);
    httpMock.expectOne(teamGamesUrl);
    httpMock.expectOne(nstTeamGamesUrl);
  });
});
