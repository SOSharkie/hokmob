import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlStatsApiService} from '@shared/services/nhl-stats-api.service';
import {mockTeamStats} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('NhlStatsApiService', () => {
  let service: NhlStatsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NhlStatsApiService]
    });
    service = TestBed.inject(NhlStatsApiService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTeamStats', () => {
    it('should resolve every real team of the season', async () => {
      const teamStats = service.getTeamStats(20252026);
      httpMock.expectOne('/api/nhl-stats/teams?season=20252026&gameType=2').flush(mockTeamStats());

      const teams = await teamStats;
      expect(teams.length).toBe(32);
      const bruins = teams.find(team => team.teamId === 6);
      expect(bruins.teamFullName).toBe('Boston Bruins');
      expect(bruins.seasonId).toBe(20252026);
      expect(bruins.gamesPlayed).toBe(82);
    });

    it('should ask for the playoffs when that game type is given', async () => {
      const teamStats = service.getTeamStats('20252026', 3);
      httpMock.expectOne('/api/nhl-stats/teams?season=20252026&gameType=3').flush({teams: []});
      expect(await teamStats).toEqual([]);
    });

    it('should resolve no teams for a season without games', async () => {
      const teamStats = service.getTeamStats(20262027);
      httpMock.expectOne('/api/nhl-stats/teams?season=20262027&gameType=2').flush(mockTeamStats(20262027));
      expect(await teamStats).toEqual([]);
    });

    it('should log and reject when the request fails', async () => {
      const teamStats = service.getTeamStats(20252026);
      const rejection = expectAsync(teamStats).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl-stats/teams?season=20252026&gameType=2')
          .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });
});
