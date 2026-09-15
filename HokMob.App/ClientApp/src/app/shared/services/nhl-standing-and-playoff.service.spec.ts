import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlStandingAndPlayoffService} from "@shared/services/nhl-standing-and-playoff.service";
import {NhlStandingsTypeEnum} from "@shared/enums/nhl-standings-type.enum";
import {StandingsGroup} from "@shared/models/nhl-web-api/standings.model";
import {PlayoffCarousel} from "@shared/models/nhl-web-api/playoffs.model";
import {
  mockPlayoffBracket,
  mockPlayoffCarousel,
  mockPlayoffSeriesSchedule,
  mockStandingsResponse
} from "@shared/testing/nhl-api-mocks/nhl-api-mocks";

describe('NhlStandingAndPlayoffService', () => {
  let service: NhlStandingAndPlayoffService;
  let httpMock: HttpTestingController;

  const standingsUrl = '/api/nhl/standings/now';
  const carouselUrl = '/api/nhl/playoff-series/carousel/20252026/';
  const bracketUrl = '/api/nhl/playoff-bracket/2026';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NhlStandingAndPlayoffService]
    });
    service = TestBed.inject(NhlStandingAndPlayoffService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  function abbrevs(group: StandingsGroup): string[] {
    return group.teams.map(team => team.teamAbbrev.default);
  }

  describe('getNhlStandings', () => {
    function getStandings(standingsType: NhlStandingsTypeEnum): Promise<StandingsGroup[]> {
      const groups = service.getNhlStandings(standingsType);
      httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
      return groups;
    }

    it('should rank the whole league by league sequence', async () => {
      const groups = await getStandings(NhlStandingsTypeEnum.BY_LEAGUE);
      expect(groups.map(group => group.title)).toEqual(['NHL']);
      expect(groups[0].teams.length).toBe(32);
      expect(abbrevs(groups[0]).slice(0, 3)).toEqual(['COL', 'CAR', 'DAL']);
      expect(abbrevs(groups[0])[31]).toBe('VAN');
    });

    it('should group by conference, Eastern first, ranked by conference sequence', async () => {
      const groups = await getStandings(NhlStandingsTypeEnum.BY_CONFERENCE);
      expect(groups.map(group => group.title)).toEqual(['Eastern Conference', 'Western Conference']);
      expect(groups.map(group => group.teams.length)).toEqual([16, 16]);
      expect(abbrevs(groups[0]).slice(0, 3)).toEqual(['CAR', 'BUF', 'TBL']);
      expect(abbrevs(groups[1]).slice(0, 3)).toEqual(['COL', 'DAL', 'MIN']);
    });

    it('should group by division, ordered by conference then division name', async () => {
      const groups = await getStandings(NhlStandingsTypeEnum.BY_DIVISION);
      expect(groups.map(group => group.title))
          .toEqual(['Atlantic Division', 'Metropolitan Division', 'Central Division', 'Pacific Division']);
      expect(groups.map(group => group.teams.length)).toEqual([8, 8, 8, 8]);
      expect(groups.map(group => abbrevs(group)[0])).toEqual(['BUF', 'CAR', 'COL', 'VGK']);
    });

    it('should list each conference\'s division leaders, then its wild card teams', async () => {
      const groups = await getStandings(NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS);
      expect(groups.map(group => group.title)).toEqual(['Atlantic Leaders', 'Metropolitan Leaders', 'Eastern Wild Card',
        'Central Leaders', 'Pacific Leaders', 'Western Wild Card']);
      expect(abbrevs(groups[0])).toEqual(['BUF', 'TBL', 'MTL']);
      expect(abbrevs(groups[1])).toEqual(['CAR', 'PIT', 'PHI']);
      expect(abbrevs(groups[2]).length).toBe(10);
      expect(abbrevs(groups[2]).slice(0, 3)).toEqual(['BOS', 'OTT', 'WSH']);
      expect(abbrevs(groups[5]).slice(0, 2)).toEqual(['UTA', 'LAK']);
    });

    it('should use league standings for other standings types', async () => {
      const groups = await getStandings(NhlStandingsTypeEnum.REGULAR_SEASON);
      expect(groups.map(group => group.title)).toEqual(['NHL']);
      expect(groups[0].teams.length).toBe(32);
    });

    it('should handle a response without standings', async () => {
      const conferences = service.getNhlStandings(NhlStandingsTypeEnum.BY_CONFERENCE);
      httpMock.expectOne(standingsUrl).flush({...mockStandingsResponse(), standings: undefined});
      expect(await conferences).toEqual([]);

      const league = service.getNhlStandings(NhlStandingsTypeEnum.BY_LEAGUE);
      httpMock.expectOne(standingsUrl).flush({...mockStandingsResponse(), standings: []});
      expect(await league).toEqual([{title: 'NHL', teams: []}]);
    });

    it('should log and reject when the request fails', async () => {
      const groups = service.getNhlStandings(NhlStandingsTypeEnum.BY_LEAGUE);
      const rejection = expectAsync(groups).toBeRejected();
      httpMock.expectOne(standingsUrl).flush('Server error', {status: 500, statusText: 'Internal Server Error'});
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getNhlPlayoffs', () => {
    function seriesByLetter(carousel: PlayoffCarousel, seriesLetter: string) {
      return carousel.rounds.flatMap(round => round.series).find(series => series.seriesLetter === seriesLetter);
    }

    it('should load the carousel and bracket for the season and add seed ranks', async () => {
      const playoffs = service.getNhlPlayoffs('20252026');
      httpMock.expectOne(carouselUrl).flush(mockPlayoffCarousel());
      httpMock.expectOne(bracketUrl).flush(mockPlayoffBracket());
      const carousel = await playoffs;

      expect(carousel.currentRound).toBe(4);
      const seriesA = seriesByLetter(carousel, 'A');
      expect([seriesA.topSeed.abbrev, seriesA.topSeed.rank]).toEqual(['BUF', 1]);
      expect([seriesA.bottomSeed.abbrev, seriesA.bottomSeed.rank]).toEqual(['BOS', 4]);
      const final = seriesByLetter(carousel, 'O');
      expect([final.topSeed.rank, final.bottomSeed.rank]).toEqual([1, 1]);
      const allSeeds = carousel.rounds.flatMap(round => round.series).flatMap(series => [series.topSeed, series.bottomSeed]);
      expect(allSeeds.every(seed => seed.rank > 0)).toBeTrue();
    });

    it('should match ranks by team ID when the bracket lists the seeds the other way around', async () => {
      const bracket = mockPlayoffBracket();
      const bracketA = bracket.series.find(series => series.seriesLetter === 'A');
      [bracketA.topSeedTeam, bracketA.bottomSeedTeam] = [bracketA.bottomSeedTeam, bracketA.topSeedTeam];
      [bracketA.topSeedRank, bracketA.bottomSeedRank] = [bracketA.bottomSeedRank, bracketA.topSeedRank];

      const playoffs = service.getNhlPlayoffs('20252026');
      httpMock.expectOne(carouselUrl).flush(mockPlayoffCarousel());
      httpMock.expectOne(bracketUrl).flush(bracket);
      const seriesA = seriesByLetter(await playoffs, 'A');
      expect(seriesA.topSeed.rank).toBe(1);
      expect(seriesA.bottomSeed.rank).toBe(4);
    });

    it('should leave ranks unset for series missing from the bracket', async () => {
      const bracket = mockPlayoffBracket();
      bracket.series = bracket.series.filter(series => series.seriesLetter !== 'O');

      const playoffs = service.getNhlPlayoffs('20252026');
      httpMock.expectOne(carouselUrl).flush(mockPlayoffCarousel());
      httpMock.expectOne(bracketUrl).flush(bracket);
      const carousel = await playoffs;
      expect(seriesByLetter(carousel, 'O').topSeed.rank).toBeUndefined();
      expect(seriesByLetter(carousel, 'A').topSeed.rank).toBe(1);
    });

    it('should return the series without ranks when the bracket fails', async () => {
      const playoffs = service.getNhlPlayoffs('20252026');
      httpMock.expectOne(carouselUrl).flush(mockPlayoffCarousel());
      httpMock.expectOne(bracketUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
      const carousel = await playoffs;
      expect(carousel.rounds.length).toBe(4);
      expect(seriesByLetter(carousel, 'A').topSeed.rank).toBeUndefined();
    });

    it('should reject when the carousel fails', async () => {
      const playoffs = service.getNhlPlayoffs('20252026');
      const rejection = expectAsync(playoffs).toBeRejected();
      httpMock.expectOne(carouselUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
      httpMock.expectOne(bracketUrl).flush(mockPlayoffBracket());
      await rejection;
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getNhlPlayoffSeriesSchedule', () => {
    it('should request the series with a lower-case letter and resolve its games', async () => {
      const schedule = service.getNhlPlayoffSeriesSchedule(20252026, 'A');
      httpMock.expectOne('/api/nhl/schedule/playoff-series/20252026/a/').flush(mockPlayoffSeriesSchedule('A'));
      const result = await schedule;
      expect(result.topSeedTeam.abbrev).toBe('BUF');
      expect(result.games.length).toBe(6);
    });

    it('should reject when the request fails', async () => {
      const schedule = service.getNhlPlayoffSeriesSchedule('20252026', 'o');
      const rejection = expectAsync(schedule).toBeRejected();
      httpMock.expectOne('/api/nhl/schedule/playoff-series/20252026/o/')
          .flush('Server error', {status: 500, statusText: 'Internal Server Error'});
      await rejection;
    });
  });
});
