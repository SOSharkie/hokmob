import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlStatsApiService} from '@shared/services/nhl-stats-api.service';
import {
  mockHitsAndShotsLeaders,
  mockPlayerStats,
  mockTeamStats
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {
  GoalieGameStats,
  SkaterGameStats,
  SkaterSeasonStats
} from '@shared/models/nhl-stats-api/player-stats.model';

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

  describe('getPlayerStats', () => {
    it('should resolve the real seasons of a skater, with a traded season as one row', async () => {
      const playerStats = service.getPlayerStats(8477496);
      httpMock.expectOne('/api/nhl-stats/player/8477496?position=skater').flush(mockPlayerStats(8477496));

      const stats = await playerStats;
      expect(stats.regularSeasons.length).toBe(13);
      const latest = stats.regularSeasons[0] as SkaterSeasonStats;
      expect(latest.seasonId).toBe(20252026);
      expect(latest.skaterFullName).toBe('Elias Lindholm');
      const tradedSeason = (stats.regularSeasons as SkaterSeasonStats[])
          .find(season => season.seasonId === 20232024);
      expect(tradedSeason.teamAbbrevs).toBe('CGY,VAN');
      expect(tradedSeason.gamesPlayed).toBe(75);
      expect(tradedSeason.points).toBe(44);
      expect(tradedSeason.hits).toBe(89);
    });

    it('should resolve the last 10 real games of a skater, newest first, with hits and scores', async () => {
      const playerStats = service.getPlayerStats(8477964, false);
      httpMock.expectOne('/api/nhl-stats/player/8477964?position=skater').flush(mockPlayerStats(8477964));

      const games = (await playerStats).recentGames as SkaterGameStats[];
      expect(games.length).toBe(10);
      expect(games[0].gameId).toBe(2025030416);
      expect(games[0].gameDate).toBe('2026-06-14');
      expect(games[0].opponentTeamAbbrev).toBe('CAR');
      expect(games[0].hits).toBe(3);
      expect(games[0].homeScore).toBe(0);
      expect(games[0].visitingScore).toBe(3);
    });

    it('should ask for the goalie reports for a goalie', async () => {
      const playerStats = service.getPlayerStats(8476945, true);
      httpMock.expectOne('/api/nhl-stats/player/8476945?position=goalie').flush(mockPlayerStats(8476945));

      const games = (await playerStats).recentGames as GoalieGameStats[];
      expect(games[0].goalieFullName).toBe('Connor Hellebuyck');
      expect(games[0].evSaves).toBe(18);
      expect(games[0].evShotsAgainst).toBe(21);
    });

    it('should resolve empty lists for a player without NHL stats', async () => {
      const playerStats = service.getPlayerStats(8477964);
      httpMock.expectOne('/api/nhl-stats/player/8477964?position=skater').flush({});
      expect(await playerStats).toEqual({regularSeasons: [], playoffSeasons: [], recentGames: []});
    });

    it('should log and reject when the request fails', async () => {
      const playerStats = service.getPlayerStats(8477964);
      const rejection = expectAsync(playerStats).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl-stats/player/8477964?position=skater')
          .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getHitsAndShotsLeaders', () => {
    it('should resolve the real hits and shots leaders of a season', async () => {
      const leaders = service.getHitsAndShotsLeaders(20252026, 2, 5);
      httpMock.expectOne('/api/nhl-stats/leaders?season=20252026&gameType=2&limit=5')
          .flush(mockHitsAndShotsLeaders());

      const hitsAndShots = await leaders;
      expect(hitsAndShots.hits.length).toBe(5);
      expect(hitsAndShots.hits[0].skaterFullName).toBe('Yakov Trenin');
      expect(hitsAndShots.hits[0].hits).toBe(413);
      expect(hitsAndShots.hits[0].teamAbbrevs).toBe('MIN');
      expect(hitsAndShots.shots[0].skaterFullName).toBe('Nathan MacKinnon');
      expect(hitsAndShots.shots[0].shots).toBe(350);
    });

    it('should ask for the regular season and five leaders by default', async () => {
      const leaders = service.getHitsAndShotsLeaders('20252026');
      httpMock.expectOne('/api/nhl-stats/leaders?season=20252026&gameType=2&limit=5')
          .flush(mockHitsAndShotsLeaders());
      await leaders;
    });

    it('should resolve empty lists for a season without stats', async () => {
      const leaders = service.getHitsAndShotsLeaders(20262027, 3);
      httpMock.expectOne('/api/nhl-stats/leaders?season=20262027&gameType=3&limit=5').flush({});
      expect(await leaders).toEqual({hits: [], shots: []});
    });

    it('should log and reject when the request fails', async () => {
      const leaders = service.getHitsAndShotsLeaders(20252026, 2);
      const rejection = expectAsync(leaders).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl-stats/leaders?season=20252026&gameType=2&limit=5')
          .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
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
