import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlLeadersService} from '@shared/services/nhl-leaders.service';
import {mockGoalieStatsLeaders, mockSkaterStatsLeaders} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('NhlLeadersService', () => {
  let service: NhlLeadersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NhlLeadersService]
    });
    service = TestBed.inject(NhlLeadersService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getSkaterLeaders', () => {
    it('should resolve the real regular season skater leaders of the categories asked for', async () => {
      const leaders = service.getSkaterLeaders(20252026, 2, ['points', 'goals', 'assists', 'toi']);
      httpMock.expectOne('/api/nhl/skater-stats-leaders/20252026/2?limit=5&categories=points,goals,assists,toi')
          .flush(mockSkaterStatsLeaders(2));

      const skaters = await leaders;
      expect(skaters.points.length).toBe(5);
      expect(skaters.points[0].id).toBe(8478402);
      expect(skaters.points[0].lastName.default).toBe('McDavid');
      expect(skaters.points[0].value).toBe(138);
      expect(skaters.points[0].teamAbbrev).toBe('EDM');
      expect(skaters.toi[0].value).toBe(1664.2568);
    });

    it('should ask the playoffs of the season for all categories when none are given', async () => {
      const leaders = service.getSkaterLeaders(20252026, 3);
      httpMock.expectOne('/api/nhl/skater-stats-leaders/20252026/3?limit=5').flush(mockSkaterStatsLeaders(3));

      const skaters = await leaders;
      expect(skaters.points[0].lastName.default).toBe('Marner');
      expect(skaters.points[0].value).toBe(29);
    });

    it('should ask for the number of leaders given', async () => {
      const leaders = service.getSkaterLeaders(20252026, 2, ['points'], 10);
      httpMock.expectOne('/api/nhl/skater-stats-leaders/20252026/2?limit=10&categories=points')
          .flush(mockSkaterStatsLeaders(2));
      await leaders;
    });

    it('should resolve an empty response as no categories', async () => {
      const leaders = service.getSkaterLeaders(20262027, 3, ['points']);
      httpMock.expectOne('/api/nhl/skater-stats-leaders/20262027/3?limit=5&categories=points').flush({});
      expect(await leaders).toEqual({});
    });

    it('should log and reject when the request fails', async () => {
      const leaders = service.getSkaterLeaders(20252026, 2, ['points']);
      const rejection = expectAsync(leaders).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl/skater-stats-leaders/20252026/2?limit=5&categories=points')
          .flush('Bad Gateway', {status: 502, statusText: 'Bad Gateway'});

      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getGoalieLeaders', () => {
    it('should resolve the real regular season goalie leaders', async () => {
      const leaders = service.getGoalieLeaders(20252026, 2, ['savePctg', 'goalsAgainstAverage', 'wins']);
      httpMock.expectOne('/api/nhl/goalie-stats-leaders/20252026/2?limit=5&categories=savePctg,goalsAgainstAverage,wins')
          .flush(mockGoalieStatsLeaders(2));

      const goalies = await leaders;
      expect(goalies.savePctg[0].lastName.default).toBe('Wedgewood');
      expect(goalies.savePctg[0].value).toBe(0.921317);
      expect(goalies.goalsAgainstAverage[0].value).toBe(2.02427);
      expect(goalies.wins[0].lastName.default).toBe('Vasilevskiy');
      expect(goalies.wins[0].value).toBe(39);
    });

    it('should resolve the real playoff goalie leaders, where a category can have fewer leaders', async () => {
      const leaders = service.getGoalieLeaders(20252026, 3);
      httpMock.expectOne('/api/nhl/goalie-stats-leaders/20252026/3?limit=5').flush(mockGoalieStatsLeaders(3));

      const goalies = await leaders;
      expect(goalies.wins[0].lastName.default).toBe('Hart');
      expect(goalies.shutouts.length).toBe(4);
    });

    it('should log and reject when the request fails', async () => {
      const leaders = service.getGoalieLeaders(20252026, 2, ['wins']);
      const rejection = expectAsync(leaders).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl/goalie-stats-leaders/20252026/2?limit=5&categories=wins')
          .flush('Bad Gateway', {status: 502, statusText: 'Bad Gateway'});

      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });
});
