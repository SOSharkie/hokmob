import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlStatsApiService} from '@shared/services/nhl-stats-api.service';
import {
  mockDraftStats,
  mockHitsAndShotsLeaders,
  mockPlayerStats,
  mockSeasonDates,
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

  describe('getDraftStats', () => {
    it('should resolve the real career stats of a round, sorted by overall pick', async () => {
      const draftStats = service.getDraftStats(2015, 1);
      httpMock.expectOne('/api/nhl-stats/draft?year=2015&round=1').flush(mockDraftStats(2015));

      const players = await draftStats;
      expect(players.length).toBe(30);
      expect(players[0]).toEqual(jasmine.objectContaining({
        draftOverall: 1, playerId: 8478402, name: 'Connor McDavid', positionCode: 'C', goals: 409, assists: 811,
        points: 1220
      }));
      expect(players[21]).toEqual(jasmine.objectContaining({
        draftOverall: 22, name: 'Ilya Samsonov', positionCode: 'G', goals: 0, assists: 5, points: 5
      }));
    });

    it('should resolve a round with players who never played, without their rows', async () => {
      const draftStats = service.getDraftStats(2006, 1);
      httpMock.expectOne('/api/nhl-stats/draft?year=2006&round=1').flush(mockDraftStats(2006));

      const players = await draftStats;
      expect(players.length).toBe(27);
      expect(players.find(player => player.draftOverall === 19)).toBeUndefined();
      expect(players.find(player => player.draftOverall === 3)).toEqual(jasmine.objectContaining({
        name: 'Jonathan Toews', positionCode: 'C', assists: 529, goals: 383, points: 912
      }));
    });

    it('should resolve an empty list for a round without NHL players or a missing list', async () => {
      const draftStats = service.getDraftStats(2026, 1);
      httpMock.expectOne('/api/nhl-stats/draft?year=2026&round=1').flush({players: []});
      expect(await draftStats).toEqual([]);

      const noList = service.getDraftStats(2026, 2);
      httpMock.expectOne('/api/nhl-stats/draft?year=2026&round=2').flush({});
      expect(await noList).toEqual([]);
    });

    it('should log and reject when the request fails', async () => {
      const draftStats = service.getDraftStats(2015, 1);
      const rejection = expectAsync(draftStats).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl-stats/draft?year=2015&round=1')
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

  describe('getSeasonDates and getCurrentSeason', () => {
    const seasonsUrl = '/api/nhl-stats/seasons';

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    /** Pins today to a local day. The month is 1-based. */
    function setToday(year: number, month: number, date: number): void {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(year, month - 1, date, 12));
    }

    it('should resolve the real seasons, newest first', async () => {
      const seasonDates = service.getSeasonDates();
      httpMock.expectOne(seasonsUrl).flush(mockSeasonDates());
      const seasons = await seasonDates;
      expect(seasons.map(season => season.id)).toEqual([20262027, 20252026]);
      expect(seasons[1].firstPlayoffGameDate).toBe('2026-04-18');
    });

    it('should share one request between callers', async () => {
      const first = service.getCurrentSeason();
      const second = service.getSeasonDates();
      httpMock.expectOne(seasonsUrl).flush(mockSeasonDates());
      await Promise.all([first, second]);
      await service.getCurrentSeason();
      httpMock.expectNone(seasonsUrl);
    });

    it('should ask again after an hour', async () => {
      setToday(2026, 9, 16);
      const first = service.getSeasonDates();
      httpMock.expectOne(seasonsUrl).flush(mockSeasonDates());
      await first;
      jasmine.clock().tick(60 * 60 * 1000);
      const second = service.getSeasonDates();
      httpMock.expectOne(seasonsUrl).flush(mockSeasonDates());
      await second;
    });

    it('should resolve the new season outside playoff mode on the day the fixture was captured', async () => {
      setToday(2026, 9, 16);
      const currentSeason = service.getCurrentSeason();
      httpMock.expectOne(seasonsUrl).flush(mockSeasonDates());
      expect(await currentSeason).toEqual({season: 20262027, isPlayoffMode: false});
    });

    it('should resolve the previous season in playoff mode during its playoffs', async () => {
      setToday(2026, 5, 1);
      const currentSeason = service.getCurrentSeason();
      httpMock.expectOne(seasonsUrl).flush(mockSeasonDates());
      expect(await currentSeason).toEqual({season: 20252026, isPlayoffMode: true});
    });

    it('should reject when no season is listed', async () => {
      const currentSeason = service.getCurrentSeason();
      const rejection = expectAsync(currentSeason).toBeRejected();
      httpMock.expectOne(seasonsUrl).flush({seasons: []});
      await rejection;
    });

    it('should log, reject and not reuse a failed request', async () => {
      const currentSeason = service.getCurrentSeason();
      const rejection = expectAsync(currentSeason).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne(seasonsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();

      const retry = service.getSeasonDates();
      httpMock.expectOne(seasonsUrl).flush(mockSeasonDates());
      expect((await retry).length).toBe(2);
    });
  });
});
