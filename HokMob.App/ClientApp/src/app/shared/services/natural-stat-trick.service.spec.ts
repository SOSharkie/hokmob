import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {NaturalStatTrickService} from '@shared/services/natural-stat-trick.service';
import {mockNstGameStats, mockNstPlayers, mockNstTeamGames} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
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

  describe('getPlayers', () => {
    const url = '/api/nst/players?season=20262027';

    it("should resolve every real skater's NST stats as one row each, by NHL player ID", async () => {
      const players = service.getPlayers(20262027);
      httpMock.expectOne(url).flush(mockNstPlayers());

      const rows = await players;
      expect(rows.length).toBe(50);
      expect(rows.find(row => row.playerId === 8477934)).toEqual({
        playerId: 8477934, gamesPlayed: 26, timeOnIce: 34332, expectedGoals: 13.64, highDangerAttempts: 29,
        rushAttempts: 3, reboundsCreated: 8, hitsTaken: 19, onIceTimeOnIce: 25460, onIceExpectedGoalsFor: 20.06,
        onIceExpectedGoalsAgainst: 16.09
      });
    });

    it('should keep the on-ice columns null when the backend had no on-ice page', async () => {
      const response = mockNstPlayers();
      response.players.onIceTimeOnIce = response.players.playerId.map(() => null);
      response.players.onIceExpectedGoalsAgainst = response.players.playerId.map(() => null);
      const players = service.getPlayers(20262027);
      httpMock.expectOne(url).flush(response);

      const draisaitl = (await players).find(row => row.playerId === 8477934);
      expect(draisaitl.onIceExpectedGoalsAgainst).toBeNull();
      expect(draisaitl.expectedGoals).toBe(13.64);
    });

    it('should reuse a season for a few minutes, so the next player does not ask again', async () => {
      const first = service.getPlayers(20262027);
      httpMock.expectOne(url).flush(mockNstPlayers());
      await first;
      expect((await service.getPlayers(20262027)).length).toBe(50);
      httpMock.expectNone(url);

      // Another season is its own request
      service.getPlayers(20252026);
      httpMock.expectOne('/api/nst/players?season=20252026').flush(mockNstPlayers());
    });

    it('should ask again once a season is older than its max age', async () => {
      const now = Date.now();
      const clock = spyOn(Date, 'now').and.returnValue(now);
      const first = service.getPlayers(20262027);
      httpMock.expectOne(url).flush(mockNstPlayers());
      await first;
      clock.and.returnValue(now + NaturalStatTrickService.playersMaxAge);
      service.getPlayers(20262027);
      httpMock.expectOne(url).flush(mockNstPlayers());
    });

    it('should resolve no skaters without logging when NST has none for the season yet', async () => {
      const players = service.getPlayers(20262027);
      httpMock.expectOne(url).flush('Not found', {status: 404, statusText: 'Not Found'});
      expect(await players).toEqual([]);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should resolve no skaters for a body without them', async () => {
      const players = service.getPlayers(20262027);
      httpMock.expectOne(url).flush({season: 20262027});
      expect(await players).toEqual([]);
    });

    it('should reject and log when the backend cannot ask NST, and ask again next time', async () => {
      const players = service.getPlayers(20262027);
      const rejection = expectAsync(players).toBeRejectedWith(jasmine.objectContaining({status: 503}));
      httpMock.expectOne(url).flush('Unavailable', {status: 503, statusText: 'Service Unavailable'});
      await rejection;
      expect(console.error).toHaveBeenCalled();

      service.getPlayers(20262027);
      httpMock.expectOne(url).flush(mockNstPlayers());
    });

    it('should reject when the request fails', async () => {
      const players = service.getPlayers(20262027);
      const rejection = expectAsync(players).toBeRejected();
      httpMock.expectOne(url).error(new ProgressEvent('error'));
      await rejection;
    });
  });

  describe('getTeamGames', () => {
    const teamGamesUrl = '/api/nst/team-games?season=20262027';

    it("should resolve every real team's expected goals per game, by NHL team ID", async () => {
      const teamGames = service.getTeamGames(20262027);
      httpMock.expectOne(teamGamesUrl).flush(mockNstTeamGames());

      const games = await teamGames;
      expect(games.length).toBe(650);
      expect(new Set(games.map(game => game.teamId)).size).toBe(32);
      // Carolina (12) hosted Florida (13) in the season's first game
      expect(games[0]).toEqual({gameId: 2026020001, teamId: 12, expectedGoalsFor: 0.34, expectedGoalsAgainst: 0.82});
      expect(games[1]).toEqual({gameId: 2026020001, teamId: 13, expectedGoalsFor: 0.82, expectedGoalsAgainst: 0.34});
      const sharks = games.filter(game => game.teamId === 28);
      expect(sharks.length).toBe(22);
      expect(sharks.reduce((total, game) => total + game.expectedGoalsFor, 0)).toBeCloseTo(36.56, 2);
      expect(sharks.reduce((total, game) => total + game.expectedGoalsAgainst, 0)).toBeCloseTo(55.96, 2);
    });

    it('should find St. Louis and Montréal, which NST spells without the period and the accent', async () => {
      const teamGames = service.getTeamGames(20262027);
      httpMock.expectOne(teamGamesUrl).flush(mockNstTeamGames());
      const teamIds = new Set((await teamGames).map(game => game.teamId));
      expect(teamIds.has(19)).toBeTrue();
      expect(teamIds.has(8)).toBeTrue();
    });

    it('should leave out the games of a team NST names in an unknown way', async () => {
      const response = mockNstTeamGames();
      const anaheimGames = response.games.team.filter(team => team === 0).length;
      response.teams[0] = 'Hartford Whalers';
      const teamGames = service.getTeamGames(20262027);
      httpMock.expectOne(teamGamesUrl).flush(response);

      const games = await teamGames;
      expect(anaheimGames).toBeGreaterThan(0);
      expect(games.length).toBe(650 - anaheimGames);
      expect(games.some(game => game.teamId === 24)).toBeFalse();
    });

    it('should resolve no games without logging when NST has none for the season yet', async () => {
      const teamGames = service.getTeamGames('20272028');
      httpMock.expectOne('/api/nst/team-games?season=20272028').flush('', {status: 404, statusText: 'Not Found'});
      expect(await teamGames).toEqual([]);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should resolve no games for a body without them', async () => {
      const teamGames = service.getTeamGames(20262027);
      httpMock.expectOne(teamGamesUrl).flush({season: 20262027});
      expect(await teamGames).toEqual([]);
    });

    it('should reject and log when the backend cannot ask NST', async () => {
      const teamGames = service.getTeamGames(20262027);
      const rejected = expectAsync(teamGames).toBeRejected();
      httpMock.expectOne(teamGamesUrl).flush('', {status: 503, statusText: 'Service Unavailable'});
      await rejected;
      expect(console.error).toHaveBeenCalled();
    });
  });
});
