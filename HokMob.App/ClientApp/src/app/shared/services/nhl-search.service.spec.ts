import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NhlSearchService} from '@shared/services/nhl-search.service';
import {SearchResultTypeEnum} from '@shared/enums/search-result-type.enum';
import {NhlPlayerHeadshotUtils} from '@shared/utils/nhl-player-headshot-utils';
import {mockPlayerSearchResults} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

describe('NhlSearchService', () => {
  let service: NhlSearchService;
  let httpMock: HttpTestingController;

  const macUrl = '/api/nhl-search/player?q=mac&limit=10&active=true';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NhlSearchService]
    });
    service = TestBed.inject(NhlSearchService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('searchTeams', () => {
    it('should match a team abbreviation, ignoring case, without a request', () => {
      const results = service.searchTeams('bos');
      expect(results.length).toBe(1);
      expect(results[0].resultType).toBe(SearchResultTypeEnum.TEAM);
      expect(results[0].teamId).toBe('6');
      expect(results[0].teamName).toBe('Boston Bruins');
      expect(results[0].displayValue).toBe('Boston Bruins');
      expect(results[0].link).toBe('team/6');
      httpMock.expectNone(() => true);
    });

    it('should match the full name, place name and team name', () => {
      expect(service.searchTeams('New York').map(result => result.teamId)).toEqual(['2', '3']);
      expect(service.searchTeams('ny ').map(result => result.teamName))
          .toEqual(['New York Islanders', 'New York Rangers']);
      expect(service.searchTeams('MAPLE').map(result => result.teamName)).toEqual(['Toronto Maple Leafs']);
      expect(service.searchTeams('utah').map(result => result.teamId)).toEqual(['68']);
    });

    it('should leave out former teams', () => {
      expect(service.searchTeams('ari')).toEqual([]);
      expect(service.searchTeams('coyotes')).toEqual([]);
    });

    it('should return nothing for an empty query or no match', () => {
      expect(service.searchTeams('')).toEqual([]);
      expect(service.searchTeams('   ')).toEqual([]);
      expect(service.searchTeams(null)).toEqual([]);
      expect(service.searchTeams('zz')).toEqual([]);
    });
  });

  describe('searchPlayers', () => {
    it('should search active players through the proxy and convert the real results', async () => {
      const search = service.searchPlayers('mac');
      httpMock.expectOne(macUrl).flush(mockPlayerSearchResults());

      const results = await search;
      expect(results.length).toBe(10);
      expect(results[1].resultType).toBe(SearchResultTypeEnum.PLAYER);
      expect(results[1].displayValue).toBe('Macklin Celebrini');
      expect(results[1].playerId).toBe('8484801');
      expect(results[1].teamId).toBe('28');
      expect(results[1].positionCode).toBe('C');
      expect(results[1].link).toBe('player/8484801');
      expect(results[1].headshot).toBe('https://assets.nhle.com/mugs/nhl/20262027/SJS/8484801.png');
    });

    it('should give a player without a last season the blank headshot', async () => {
      const search = service.searchPlayers('mac');
      httpMock.expectOne(macUrl).flush(mockPlayerSearchResults());

      const machu = (await search).find(result => result.displayValue === 'Tomas Machu');
      expect(machu.headshot).toBe(NhlPlayerHeadshotUtils.blankHeadshot);
    });

    it('should trim and encode the query and pass the limit', async () => {
      const search = service.searchPlayers(' st. louis & co ', 7);
      httpMock.expectOne('/api/nhl-search/player?q=st.%20louis%20%26%20co&limit=7&active=true').flush([]);
      expect(await search).toEqual([]);
    });

    it('should resolve an empty response as no players', async () => {
      const search = service.searchPlayers('zz');
      httpMock.expectOne('/api/nhl-search/player?q=zz&limit=10&active=true').flush(null);
      expect(await search).toEqual([]);
    });

    it('should log and reject when the request fails', async () => {
      const search = service.searchPlayers('mac');
      const rejection = expectAsync(search).toBeRejectedWith(jasmine.objectContaining({status: 502}));
      httpMock.expectOne(macUrl).flush('Bad Gateway', {status: 502, statusText: 'Bad Gateway'});

      await rejection;
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });
});
