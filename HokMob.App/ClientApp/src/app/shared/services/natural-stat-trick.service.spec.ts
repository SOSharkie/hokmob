import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {NaturalStatTrickService} from '@shared/services/natural-stat-trick.service';
import {mockNstGameStats, mockNstTeamTable} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {provideHttpClient} from '@angular/common/http';

describe('NaturalStatTrickService', () => {
  let service: NaturalStatTrickService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NaturalStatTrickService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(NaturalStatTrickService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getGameStats', () => {
    it("should resolve a real game's team and skater expected goals and Corsi", async () => {
      const gameStats = service.getGameStats('2026020010');
      httpMock.expectOne('/api/nst/game/2026020010').flush(mockNstGameStats(2026020010));

      const stats = await gameStats;
      expect(stats.isFinal).toBeTrue();
      expect(stats.homeTeam.name).toBe('Rangers');
      expect(stats.homeTeam.corsiFor).toBe(52);
      expect(stats.homeTeam.expectedGoalsFor).toBe(4.85);
      expect(stats.awayTeam.name).toBe('Lightning');
      expect(stats.awayTeam.players.length).toBe(18);
      const holmberg = stats.awayTeam.players.find(player => player.playerId === 8480995);
      expect(holmberg.name).toBe('Pontus Holmberg');
      expect(holmberg.individualExpectedGoals).toBe(0.91);
    });

    it('should resolve undefined without logging when NST has no stats for the game yet', async () => {
      const gameStats = service.getGameStats(2026020119);
      httpMock.expectOne('/api/nst/game/2026020119').flush('', {status: 404, statusText: 'Not Found'});

      expect(await gameStats).toBeUndefined();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should resolve undefined for a body without both teams', async () => {
      const gameStats = service.getGameStats(2026020010);
      httpMock.expectOne('/api/nst/game/2026020010').flush({gameId: 2026020010});

      expect(await gameStats).toBeUndefined();
    });

    it('should reject and log when the backend cannot ask NST', async () => {
      const gameStats = service.getGameStats(2026020010);
      const rejected = expectAsync(gameStats).toBeRejected();
      httpMock.expectOne('/api/nst/game/2026020010').flush('', {status: 503, statusText: 'Service Unavailable'});

      await rejected;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getTeamStats', () => {
    const teamsUrl = '/api/nst/teams?season=20262027';

    it("should resolve every real team's 5v5 xG", async () => {
      const teamStats = service.getTeamStats(20262027);
      httpMock.expectOne(teamsUrl).flush(mockNstTeamTable());

      const teams = await teamStats;
      expect(teams.length).toBe(32);
      expect(teams[0].name).toBe('Florida Panthers');
      expect(teams.find(team => team.name === 'San Jose Sharks'))
          .toEqual({name: 'San Jose Sharks', gamesPlayed: 22, expectedGoalsFor: 36.54, expectedGoalsAgainst: 55.97});
    });

    it('should resolve no teams without logging when NST has no table for the season', async () => {
      const teamStats = service.getTeamStats('20272028');
      httpMock.expectOne('/api/nst/teams?season=20272028').flush('', {status: 404, statusText: 'Not Found'});
      expect(await teamStats).toEqual([]);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should resolve no teams for a body without them', async () => {
      const teamStats = service.getTeamStats(20262027);
      httpMock.expectOne(teamsUrl).flush({season: 20262027});
      expect(await teamStats).toEqual([]);
    });

    it('should reject and log when the backend cannot ask NST', async () => {
      const teamStats = service.getTeamStats(20262027);
      const rejected = expectAsync(teamStats).toBeRejected();
      httpMock.expectOne(teamsUrl).flush('', {status: 503, statusText: 'Service Unavailable'});
      await rejected;
      expect(console.error).toHaveBeenCalled();
    });
  });
});
