import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import * as dayjs from 'dayjs';
import {NhlGameService} from "@shared/services/nhl-game.service";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";
import {ScoreGame} from "@shared/models/nhl-web-api/score.model";
import {NhlGameTypeEnum} from "@shared/enums/nhl-game-type.enum";
import {
  mockClubScheduleSeason,
  mockDraftPicks,
  mockGameBoxscore,
  mockGameLanding,
  mockGamePlayByPlay,
  mockGameRightRail,
  mockPlayerLanding,
  mockPlayoffScoreResponse,
  mockRegularSeasonScoreResponse,
  mockScoreResponse
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlGameService', () => {
  let service: NhlGameService;
  let httpMock: HttpTestingController;
  let getCurrentSeasonSpy: jasmine.Spy;

  /** Waits for pending microtasks (like the caching that follows a resolved getNhlGames promise) to settle. */
  function flushMicrotasks(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NhlGameService, NhlStatsApiService]
    });
    service = TestBed.inject(NhlGameService);
    httpMock = TestBed.inject(HttpTestingController);
    getCurrentSeasonSpy = spyOn(TestBed.inject(NhlStatsApiService), 'getCurrentSeason')
        .and.resolveTo({season: 20262027, isPlayoffMode: false});
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

  describe('getNhlGames day caching', () => {
    /** A day far enough in the past to have settled (past 1pm Eastern the next day) no matter when this runs. */
    function daysAgo(days: number): Date {
      return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    function urlFor(date: Date): string {
      return '/api/nhl/score/' + dayjs(date).format('YYYY-MM-DD');
    }

    /** Real games (see mockScoreResponse), overridden to look like a settled day of the given season. */
    function regularSeasonGames(season: number): ScoreGame[] {
      return mockScoreResponse().games.map(game => ({...game, season, gameType: NhlGameTypeEnum.REGULAR_SEASON}));
    }

    it('should serve a settled current-season day from the cache instead of requesting it again', async () => {
      const day = daysAgo(30);
      const url = urlFor(day);

      const first = service.getNhlGames(day);
      httpMock.expectOne(url).flush({...mockScoreResponse(), games: regularSeasonGames(20262027)});
      await first;
      await flushMicrotasks();

      const second = service.getNhlGames(day);
      expect((await second).length).toBe(3);
      httpMock.expectNone(url);
    });

    it('should not cache today, so it is always refetched', async () => {
      const today = new Date();
      const url = urlFor(today);

      const first = service.getNhlGames(today);
      httpMock.expectOne(url).flush({...mockScoreResponse(), games: regularSeasonGames(20262027)});
      await first;
      await flushMicrotasks();

      const second = service.getNhlGames(today);
      httpMock.expectOne(url).flush({...mockScoreResponse(), games: regularSeasonGames(20262027)});
      expect((await second).length).toBe(3);
    });

    it('should not cache a settled day of an earlier season', async () => {
      const day = daysAgo(30);
      const url = urlFor(day);

      const first = service.getNhlGames(day);
      httpMock.expectOne(url).flush({...mockScoreResponse(), games: regularSeasonGames(20252026)});
      await first;
      await flushMicrotasks();

      const second = service.getNhlGames(day);
      httpMock.expectOne(url).flush({...mockScoreResponse(), games: regularSeasonGames(20252026)});
      expect((await second).length).toBe(3);
    });

    it('should clear the cache when the current season changes', async () => {
      const day = daysAgo(30);
      const url = urlFor(day);

      const first = service.getNhlGames(day);
      httpMock.expectOne(url).flush({...mockScoreResponse(), games: regularSeasonGames(20262027)});
      await first;
      await flushMicrotasks();

      getCurrentSeasonSpy.and.resolveTo({season: 20272028, isPlayoffMode: false});
      const otherDay = daysAgo(31);
      const otherUrl = urlFor(otherDay);
      const triggerRequest = service.getNhlGames(otherDay);
      httpMock.expectOne(otherUrl).flush({...mockScoreResponse(), games: []});
      await triggerRequest;
      await flushMicrotasks();

      const second = service.getNhlGames(day);
      httpMock.expectOne(url).flush({...mockScoreResponse(), games: regularSeasonGames(20262027)});
      expect((await second).length).toBe(3);
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

  describe('getScoreGame', () => {
    it('should find a playoff game in the score for its date, with its series status and highlights', async () => {
      const scoreGame = service.getScoreGame(2025030414, '2026-06-09');
      httpMock.expectOne('/api/nhl/score/2026-06-09').flush(mockPlayoffScoreResponse());
      const game = await scoreGame;
      expect(game.seriesStatus).toEqual(jasmine.objectContaining({
        seriesTitle: 'Stanley Cup Final', topSeedTeamAbbrev: 'CAR', topSeedWins: 2, bottomSeedTeamAbbrev: 'VGK',
        bottomSeedWins: 2, gameNumberOfSeries: 4
      }));
      expect(game.threeMinRecap).toBe('/video/car-at-vgk-recap-6398034433112');
    });

    it('should resolve a regular season game without series status', async () => {
      const scoreGame = service.getScoreGame(2025021057, '2026-03-15');
      httpMock.expectOne('/api/nhl/score/2026-03-15').flush(mockRegularSeasonScoreResponse());
      const game = await scoreGame;
      expect(game.seriesStatus).toBeUndefined();
      expect(game.threeMinRecap).toBe('/video/stl-at-wpg-recap-6390989103112');
      expect(game.condensedGame).toBe('/video/stl-at-wpg-condensed-game-6390990355112');
    });

    it('should resolve undefined for a game missing from the score', async () => {
      const otherDay = service.getScoreGame(2025030414, '2026-03-01');
      httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
      expect(await otherDay).toBeUndefined();

      const noGames = service.getScoreGame(2025030414, '2026-06-09');
      httpMock.expectOne('/api/nhl/score/2026-06-09').flush({...mockPlayoffScoreResponse(), games: undefined});
      expect(await noGames).toBeUndefined();
    });

    it('should log and reject when the request fails', async () => {
      const scoreGame = service.getScoreGame(2025030414, '2026-06-09');
      const rejection = expectAsync(scoreGame).toBeRejected();
      httpMock.expectOne('/api/nhl/score/2026-06-09').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getPlayerLanding', () => {
    it('should request the player landing and resolve the bio', async () => {
      const playerLanding = service.getPlayerLanding(8476460);
      httpMock.expectOne('/api/nhl/player/8476460/landing').flush(mockPlayerLanding(8476460));
      expect(await playerLanding).toEqual(jasmine.objectContaining({
        playerId: 8476460, position: 'C', birthCountry: 'CAN', birthDate: '1993-03-15'
      }));
    });

    it('should resolve a player without optional bio fields', async () => {
      const response = mockPlayerLanding(8477480);
      delete response.birthStateProvince;
      delete response.draftDetails;
      const playerLanding = service.getPlayerLanding(8477480);
      httpMock.expectOne('/api/nhl/player/8477480/landing').flush(response);
      expect((await playerLanding).lastName.default).toBe('Comrie');
    });

    it('should log and reject when the request fails', async () => {
      const playerLanding = service.getPlayerLanding(1);
      const rejection = expectAsync(playerLanding).toBeRejectedWith(jasmine.objectContaining({status: 404}));
      httpMock.expectOne('/api/nhl/player/1/landing').flush('Not found', {status: 404, statusText: 'Not Found'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getDraftPicks', () => {
    it('should request the latest draft without a year', async () => {
      const draft = service.getDraftPicks();
      httpMock.expectOne('/api/nhl/draft/picks/now').flush(mockDraftPicks());
      const response = await draft;
      expect(response.draftYear).toBe(2026);
      expect(response.picks.length).toBe(32);
      expect(response.picks[0].firstName.default).toBe('Gavin');
      expect(response.selectableRounds).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should request a year and round', async () => {
      const draft = service.getDraftPicks(2015, 3);
      // Only round 1 is captured; the URL is what's checked here.
      httpMock.expectOne('/api/nhl/draft/picks/2015/3').flush(mockDraftPicks(2015));
      expect((await draft).draftYear).toBe(2015);
    });

    it('should request round 1 when only the year is given', async () => {
      const draft = service.getDraftPicks(2015);
      httpMock.expectOne('/api/nhl/draft/picks/2015/1').flush(mockDraftPicks(2015));
      expect((await draft).picks[0].lastName.default).toBe('McDavid');
    });

    it('should resolve a forfeited pick', async () => {
      const draft = service.getDraftPicks(2021, 1);
      httpMock.expectOne('/api/nhl/draft/picks/2021/1').flush(mockDraftPicks(2021));
      const forfeited = (await draft).picks.find(pick => pick.overallPick === 11);
      expect(forfeited.lastName.default).toBe('Forfeited');
      expect(forfeited.teamName.default).toBe('Arizona Coyotes');
    });

    it('should log and reject a year without picks', async () => {
      const draft = service.getDraftPicks(2027, 1);
      const rejection = expectAsync(draft).toBeRejectedWith(jasmine.objectContaining({status: 404}));
      httpMock.expectOne('/api/nhl/draft/picks/2027/1').flush('Not found', {status: 404, statusText: 'Not Found'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getTeamSchedule', () => {
    it('should resolve the real schedule of the current season', async () => {
      const schedule = service.getTeamSchedule('BOS');
      httpMock.expectOne('/api/nhl/club-schedule-season/BOS/now').flush(mockClubScheduleSeason('BOS', 20262027));
      const response = await schedule;
      expect(response.currentSeason).toBe(20262027);
      expect(response.previousSeason).toBe(20252026);
      expect(response.games[0].id).toBe(2026010013);
    });

    it('should log and reject when the request fails', async () => {
      const schedule = service.getTeamSchedule('BOS');
      const rejection = expectAsync(schedule).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne('/api/nhl/club-schedule-season/BOS/now')
          .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getTeamFormGames', () => {
    const scheduleUrl = '/api/nhl/club-schedule-season/';

    /** Waits for the service to make its next request. */
    function nextRequest(): Promise<void> {
      return new Promise(resolve => setTimeout(resolve));
    }

    it('should load the season of the game and resolve its last 5 finished games', async () => {
      const schedule = mockClubScheduleSeason('BOS', 20252026);
      const game = schedule.games.find(item => item.id === 2025030116);
      const formGames = service.getTeamFormGames('BOS', game);
      httpMock.expectOne(scheduleUrl + 'BOS/20252026').flush(schedule);
      expect((await formGames).map(item => item.id))
          .toEqual([2025030115, 2025030114, 2025030113, 2025030112, 2025030111]);
    });

    it('should fill in from the previous season before a real future game', async () => {
      const formGames = service.getTeamFormGames('UTA', mockGameLanding(2026020056));
      httpMock.expectOne(scheduleUrl + 'UTA/20262027').flush(mockClubScheduleSeason('UTA', 20262027));
      await nextRequest();
      httpMock.expectOne(scheduleUrl + 'UTA/20252026').flush(mockClubScheduleSeason('UTA', 20252026));

      const games = await formGames;
      expect(games.map(item => item.id)).toEqual([2025030176, 2025030175, 2025030174, 2025030173, 2025030172]);
      expect(games[0].homeTeam.abbrev).toBe('UTA');
      expect(games[0].awayTeam.score).toBe(5);
    });

    it('should resolve the games found when the previous season fails', async () => {
      const formGames = service.getTeamFormGames('BOS', mockGameLanding(2026020056));
      httpMock.expectOne(scheduleUrl + 'BOS/20262027').flush(mockClubScheduleSeason('BOS', 20262027));
      await nextRequest();
      httpMock.expectOne(scheduleUrl + 'BOS/20252026').flush('Not found', {status: 404, statusText: 'Not Found'});
      expect(await formGames).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });

    it('should resolve no games for a response without games or a previous season', async () => {
      const formGames = service.getTeamFormGames('BOS', mockGameLanding(2026020056));
      httpMock.expectOne(scheduleUrl + 'BOS/20262027')
          .flush({...mockClubScheduleSeason('BOS', 20262027), games: undefined, previousSeason: undefined});
      expect(await formGames).toEqual([]);
    });

    it('should use a schedule it is given instead of loading the season again', async () => {
      const schedule = mockClubScheduleSeason('BOS', 20252026);
      const reference = {season: 20252026, startTimeUTC: '2026-04-24T00:00:00Z'};
      const formGames = service.getTeamFormGames('BOS', reference, schedule);
      expect(await formGames).toEqual(jasmine.any(Array));
      expect((await formGames).map(item => item.id))
          .toEqual([2025030113, 2025030112, 2025030111, 2025021292, 2025021278]);
    });

    it('should fill in from the previous season of a schedule it is given', async () => {
      const schedule = mockClubScheduleSeason('BOS', 20262027);
      const reference = {season: 20262027, startTimeUTC: '2026-09-15T12:00:00Z'};
      const formGames = service.getTeamFormGames('BOS', reference, schedule);
      await nextRequest();
      httpMock.expectOne(scheduleUrl + 'BOS/20252026').flush(mockClubScheduleSeason('BOS', 20252026));
      expect((await formGames).map(item => item.id))
          .toEqual([2025030116, 2025030115, 2025030114, 2025030113, 2025030112]);
    });

    it('should log and reject when the season request fails', async () => {
      const formGames = service.getTeamFormGames('BOS', mockGameLanding(2026020056));
      const rejection = expectAsync(formGames).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne(scheduleUrl + 'BOS/20262027').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });
});
