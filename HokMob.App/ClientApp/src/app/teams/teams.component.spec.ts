import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { ActivatedRoute, convertToParamMap, ParamMap, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import {
  mockNstTeamGames,
  mockRatedTeamGameRows,
  mockStandingsResponse,
  mockTeamGameRows,
  mockTeamGames,
  mockTeamStats
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { StandingsResponse } from '@shared/models/nhl-web-api/standings.model';
import { TeamRatingUtils } from '@shared/utils/team-rating-utils';
import { ScrollDirectionService } from '@shared/services/scroll-direction.service';

import { TeamsComponent } from './teams.component';

describe('TeamsComponent', () => {
  let component: TeamsComponent;
  let fixture: ComponentFixture<TeamsComponent>;
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ParamMap>;
  /** The page's URL with its query, which the test Location (SpyLocation) leaves out of path() unlike the browser's. */
  let currentUrl: string;
  let replaceState: jasmine.Spy;
  /** Whether the page is scrolling up, which shows the app's phone menu. */
  let scrollingUp: BehaviorSubject<boolean>;

  const standingsUrl = '/api/nhl/standings/now';

  /** San Jose: 22 games and 20 points into 2026-27 in the games fixture. */
  const sharks = 28;
  /** Colorado: the best points % of 2025-26 (121 points in 82 games). */
  const avalanche = 21;
  /** Vancouver: the worst points % of 2025-26. */
  const canucks = 23;

  beforeEach(async () => {
    fixture = undefined;
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    scrollingUp = new BehaviorSubject<boolean>(true);
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamsComponent ],
      providers: [
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}},
        {provide: ScrollDirectionService, useValue: {scrollingUp$: scrollingUp}}
      ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    currentUrl = '';
    const location = TestBed.inject(Location);
    replaceState = spyOn(location, 'replaceState').and.callFake((path: string, query?: string) => {
      currentUrl = path + (query ? '?' + query : '');
    });
    spyOn(location, 'path').and.callFake(() => currentUrl);
  });

  afterEach(() => {
    // A test that only reads the columns never opens the page
    fixture?.destroy();
    httpMock.verify();
  });

  /** Opens the page with its URL's query parameters, as a link or a reload does. */
  function open(params: Params = {}): void {
    currentUrl = '/teams' + (Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '');
    queryParams.next(convertToParamMap(params));
    fixture = TestBed.createComponent(TeamsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve));
    }
    fixture.detectChanges();
  }

  /** The real standings, moved to 2026-27 to match the games fixture (the standings fixture is from 2025-26). */
  function standingsIn(season: number): StandingsResponse {
    const response = mockStandingsResponse();
    response.standings.forEach(team => team.seasonId = season);
    return response;
  }

  function urls(season: number): {stats: string, games: string, nst: string} {
    return {
      stats: '/api/nhl-stats/teams?season=' + season + '&gameType=2',
      games: '/api/nhl-stats/team-games?season=' + season + '&gameType=2',
      nst: '/api/nst/team-games?season=' + season
    };
  }

  /**
   * Opens 2026-27 with every team's real games and their expected goals from NST, and the season's (still empty) stats
   * API rows.
   */
  async function openCurrentSeason(params: Params = {}): Promise<void> {
    open(params);
    httpMock.expectOne(standingsUrl).flush(standingsIn(20262027));
    await settle();
    const {stats, games, nst} = urls(20262027);
    httpMock.expectOne(stats).flush(mockTeamStats(20262027));
    httpMock.expectOne(games).flush(mockTeamGames());
    httpMock.expectOne(nst).flush(mockNstTeamGames());
    await settle();
  }

  /** Opens 2025-26 with its real stats API rows, and the games and NST failing. */
  async function openWithStatsOnly(params: Params = {}): Promise<void> {
    open(params);
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    await settle();
    const {stats, games, nst} = urls(20252026);
    httpMock.expectOne(stats).flush(mockTeamStats(20252026));
    httpMock.expectOne(games).flush('error', {status: 502, statusText: 'Bad Gateway'});
    httpMock.expectOne(nst).flush('error', {status: 503, statusText: 'Service Unavailable'});
    await settle();
  }

  function teamIds(): number[] {
    return component.rows.map(row => row.teamId);
  }

  function headers(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.stat-header .sort-button'))
        .map((button: HTMLElement) => button.textContent.trim());
  }

  function cell(rowIndex: number, columnId: string): string {
    const row = fixture.nativeElement.querySelectorAll('.team-row')[rowIndex];
    return row.querySelector('.' + columnId + '-column').textContent.trim();
  }

  function clickHeader(label: string): void {
    const button = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.stat-header .sort-button'))
        .find(item => item.textContent.trim() === label);
    button.click();
    fixture.detectChanges();
  }

  it('should show a spinner while the season loads', () => {
    open();
    expect(fixture.nativeElement.querySelector('.loading-container app-loading-spinner')).not.toBeNull();
    httpMock.expectOne(standingsUrl);
  });

  it('should list every team by power rating, from the season\'s real games and expected goals', async () => {
    await openCurrentSeason();

    const expected = TeamRatingUtils.getLeagueRatings(mockRatedTeamGameRows()).map(rating => rating.teamId);
    expect(component.rows.length).toBe(32);
    expect(teamIds()).toEqual(expected);
    expect(fixture.nativeElement.querySelectorAll('.team-row').length).toBe(32);
    expect(fixture.nativeElement.querySelector('.table-season').textContent).toContain('2026-2027 Regular Season');
    expect(component.sortColumn.id).toBe('rating');
    expect(fixture.nativeElement.querySelector('th.rating-column').getAttribute('aria-sort')).toBe('descending');
    // The positions follow the order
    expect(fixture.nativeElement.querySelector('.team-row .team-position').textContent.trim()).toBe('1');
  });

  it('should fill the record from the games when the stats API has no rows yet', async () => {
    await openCurrentSeason();

    const index = teamIds().indexOf(sharks);
    const row = fixture.nativeElement.querySelectorAll('.team-row')[index];
    expect(row.querySelector('.team-name').textContent).toBe('San Jose Sharks');
    expect(row.querySelector('.team-tricode').textContent).toBe('SJS');
    expect(row.querySelector('.team-link').getAttribute('href')).toBe('/team/28');
    // The logo comes from app-team-logo, which fits it in its box. It isn't declared here, so its inputs are read off
    // the element
    expect(row.querySelector('app-team-logo').teamId).toBe(sharks);
    expect(row.querySelector('app-team-logo').size).toBe(32);
    expect(cell(index, 'gp')).toBe('22');
    expect(cell(index, 'w')).toBe('9');
    expect(cell(index, 'pts')).toBe('20');
    // The stats API's own columns have nothing to fall back on
    expect(cell(index, 'pp')).toBe('-');
    expect(cell(index, 'rating')).toMatch(/^\d+\.\d$/);
    expect(row.querySelector('.rating-badge')).not.toBeNull();
  });

  it('should show NST\'s xGF% with its credit', async () => {
    await openCurrentSeason();

    expect(headers()).toContain('xGF%');
    // Florida: 38.64 xGF against 35.74 xGA over its games on NST
    expect(cell(teamIds().indexOf(13), 'xg')).toBe('51.9%');
    expect(fixture.nativeElement.querySelector('.stats-source').textContent).toContain('Natural Stat Trick');
  });

  it('should rate on the NHL\'s stats alone, without the xGF% column, when NST fails', async () => {
    open();
    httpMock.expectOne(standingsUrl).flush(standingsIn(20262027));
    await settle();
    const {stats, games, nst} = urls(20262027);
    httpMock.expectOne(stats).flush(mockTeamStats(20262027));
    httpMock.expectOne(games).flush(mockTeamGames());
    httpMock.expectOne(nst).flush('error', {status: 503, statusText: 'Service Unavailable'});
    await settle();

    expect(component.hasError).toBeFalse();
    expect(component.hasRatingError).toBeFalse();
    expect(teamIds()).toEqual(TeamRatingUtils.getLeagueRatings(mockTeamGameRows()).map(rating => rating.teamId));
    // San Jose, 3.4 on the NHL's stats alone and 2.9 with NST's expected goals
    expect(cell(teamIds().indexOf(sharks), 'rating')).toBe('3.4');
    expect(headers()).not.toContain('xGF%');
    expect(fixture.nativeElement.querySelector('.stats-source')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-note')).toBeNull();
  });

  it('should wait for NST before it shows the table, so the rating doesn\'t change under the reader', async () => {
    open();
    httpMock.expectOne(standingsUrl).flush(standingsIn(20262027));
    await settle();
    const {stats, games, nst} = urls(20262027);
    httpMock.expectOne(stats).flush(mockTeamStats(20262027));
    httpMock.expectOne(games).flush(mockTeamGames());
    const nstRequest = httpMock.expectOne(nst);
    await settle();
    expect(component.isLoading).toBeTrue();

    nstRequest.flush(mockNstTeamGames());
    await settle();
    expect(component.isLoading).toBeFalse();
    expect(cell(teamIds().indexOf(sharks), 'rating')).toBe('2.9');
  });

  it('should explain the rating without the standings in its tooltip', () => {
    expect(TeamsComponent.getColumn('rating').title).toContain('Nothing in it comes from the standings');
    expect(TeamsComponent.getColumn('rating').title).not.toContain('points %');
  });

  it('should group the columns under the section headers', async () => {
    await openCurrentSeason();

    const groups = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.group-header'))
        .map((header: HTMLElement) => [header.textContent.trim(), header.getAttribute('colspan')]);
    expect(groups).toEqual([['', '1'], ['Record', '6'], ['Scoring', '5'], ['Special Teams', '4'], ['Possession', '4'],
      ['5v5', '4']]);
  });

  describe('sections', () => {
    function pills(): HTMLElement[] {
      return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.section-picker button'));
    }

    function pill(label: string): HTMLElement {
      return pills().find(item => item.textContent.trim() === label);
    }

    /** The headers a narrower screen shows: the CSS hides the rest. */
    function sectionHeaders(): string[] {
      return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.stat-header:not(.out-of-section)'))
          .map(header => header.textContent.trim());
    }

    function selectSection(label: string): void {
      pill(label).click();
      fixture.detectChanges();
    }

    it('should offer every section, with Record and the rating shown first', async () => {
      await openCurrentSeason();

      expect(pills().map(item => item.textContent.trim()))
          .toEqual(['Record', 'Scoring', 'Special Teams', 'Possession', '5v5']);
      expect(pill('Record').getAttribute('aria-pressed')).toBe('true');
      expect(pill('Scoring').getAttribute('aria-pressed')).toBe('false');
      expect(sectionHeaders()).toEqual(['Rating', 'GP', 'W', 'L', 'OTL', 'PTS', 'P%']);
      // The other sections' cells are hidden too
      const row = fixture.nativeElement.querySelector('.team-row');
      expect(row.querySelector('.corsi-column').classList).toContain('out-of-section');
      expect(row.querySelector('.pts-column').classList).not.toContain('out-of-section');
      expect(row.querySelector('.rating-column').classList).not.toContain('out-of-section');
      expect(row.querySelector('.team-cell')).not.toBeNull();
    });

    it('should show another section and save it in the URL', async () => {
      await openCurrentSeason();

      selectSection('Possession');
      expect(sectionHeaders()).toEqual(['Rating', 'CF%', 'FF%', 'xGF%', 'SF%']);
      expect(pill('Possession').getAttribute('aria-pressed')).toBe('true');
      expect(currentUrl).toBe('/teams?section=possession');

      selectSection('5v5');
      expect(sectionHeaders()).toEqual(['Rating', 'GF%', 'SH%', 'SV%', 'PDO']);
      expect(currentUrl).toBe('/teams?section=fiveOnFive');

      selectSection('Record');
      expect(currentUrl).toBe('/teams');
    });

    it('should sort by the rating when the section hides the sorted column', async () => {
      await openWithStatsOnly();
      clickHeader('PTS');
      expect(currentUrl).toBe('/teams?sort=pts');

      selectSection('Special Teams');
      expect(component.sortColumn.id).toBe('rating');
      expect(sectionHeaders()).toEqual(['Rating', 'PP%', 'PK%', 'STD/GP', 'FO%']);
      expect(currentUrl).toBe('/teams?section=specialTeams');
    });

    it('should keep a sort by the rating when the section changes', async () => {
      await openCurrentSeason();
      clickHeader('Rating');
      expect(component.sortDirection).toBe('ascending');

      selectSection('Scoring');
      expect(component.sortColumn.id).toBe('rating');
      expect(component.sortDirection).toBe('ascending');
      expect(currentUrl).toBe('/teams?order=asc&section=scoring');
    });

    it('should show the section of the sorted column, which the URL leaves out', async () => {
      await openWithStatsOnly();

      clickHeader('GA/GP');
      expect(component.selectedSection).toBe('scoring');
      expect(pill('Scoring').getAttribute('aria-pressed')).toBe('true');
      expect(currentUrl).toBe('/teams?sort=ga');
    });

    it('should open with the section of the sorted column', async () => {
      await openWithStatsOnly({sort: 'pk'});

      expect(component.selectedSection).toBe('specialTeams');
      expect(sectionHeaders()).toContain('PK%');
    });

    it('should open with the section in the URL', async () => {
      await openCurrentSeason({section: 'fiveOnFive'});

      expect(component.selectedSection).toBe('fiveOnFive');
      expect(component.sortColumn.id).toBe('rating');
      expect(sectionHeaders()).toEqual(['Rating', 'GF%', 'SH%', 'SV%', 'PDO']);
    });

    it('should show Record for an unknown section', async () => {
      await openCurrentSeason({section: 'nope'});

      expect(component.selectedSection).toBe('record');
    });
  });

  it('should sort by a column, best first, and save it in the URL', async () => {
    await openWithStatsOnly();
    replaceState.calls.reset();

    clickHeader('GA/GP');
    expect(teamIds()[0]).toBe(avalanche);
    expect(cell(0, 'ga')).toBe('2.40');
    expect(currentUrl).toBe('/teams?sort=ga');

    clickHeader('GA/GP');
    expect(component.sortDirection).toBe('descending');
    expect(currentUrl).toBe('/teams?sort=ga&order=desc');

    clickHeader('PTS');
    expect(teamIds()[0]).toBe(avalanche);
    expect(cell(0, 'pts')).toBe('121');
    expect(currentUrl).toBe('/teams?sort=pts');

    clickHeader('Rating');
    expect(currentUrl).toBe('/teams');
    expect(replaceState).toHaveBeenCalledTimes(4);
  });

  it('should keep other query parameters when it saves the sort', async () => {
    await openWithStatsOnly({utm_source: 'share'});

    clickHeader('PTS');
    expect(currentUrl).toBe('/teams?utm_source=share&sort=pts');
  });

  it('should open with the sort in the URL', async () => {
    await openWithStatsOnly({sort: 'ptsPct', order: 'asc'});

    expect(component.sortColumn.id).toBe('ptsPct');
    expect(component.sortDirection).toBe('ascending');
    expect(teamIds()[0]).toBe(canucks);
    expect(fixture.nativeElement.querySelector('th.ptsPct-column').getAttribute('aria-sort')).toBe('ascending');
  });

  it('should sort by the power rating for an unknown sort', async () => {
    await openCurrentSeason({sort: 'nope'});

    expect(component.sortColumn.id).toBe('rating');
    expect(teamIds()).toEqual(TeamRatingUtils.getLeagueRatings(mockRatedTeamGameRows()).map(rating => rating.teamId));
  });

  it('should fall back to points % without the games, and say the rating failed', async () => {
    await openWithStatsOnly();

    expect(component.rows.length).toBe(32);
    expect(teamIds()[0]).toBe(avalanche);
    expect(teamIds()[31]).toBe(canucks);
    expect(cell(0, 'rating')).toBe('-');
    expect(cell(0, 'corsi')).toBe('-');
    expect(cell(0, 'ptsPct')).toBe('73.8%');
    expect(headers()).not.toContain('xGF%');
    expect(fixture.nativeElement.querySelector('.table-note').textContent).toContain('couldn\'t be loaded');
    expect(fixture.nativeElement.querySelector('.stats-source')).toBeNull();
  });

  it('should show an error when the stats and the games both fail', async () => {
    open();
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    await settle();
    const {stats, games, nst} = urls(20252026);
    httpMock.expectOne(stats).flush('error', {status: 500, statusText: 'Server Error'});
    httpMock.expectOne(games).flush('error', {status: 502, statusText: 'Bad Gateway'});
    httpMock.expectOne(nst).flush('error', {status: 503, statusText: 'Service Unavailable'});
    await settle();

    expect(component.hasError).toBeTrue();
    expect(fixture.nativeElement.querySelector('.teams-message').textContent).toContain('couldn\'t be loaded');
    expect(fixture.nativeElement.querySelector('.teams-table')).toBeNull();
  });

  it('should show an error when the standings fail', async () => {
    open();
    httpMock.expectOne(standingsUrl).flush('error', {status: 500, statusText: 'Server Error'});
    await settle();

    expect(component.hasError).toBeTrue();
    expect(fixture.nativeElement.querySelector('.teams-message')).not.toBeNull();
  });

  it('should say so when the season has no stats yet', async () => {
    open();
    httpMock.expectOne(standingsUrl).flush(standingsIn(20262027));
    await settle();
    const {stats, games, nst} = urls(20262027);
    httpMock.expectOne(stats).flush(mockTeamStats(20262027));
    httpMock.expectOne(games).flush({games: {}});
    httpMock.expectOne(nst).flush('error', {status: 404, statusText: 'Not Found'});
    await settle();

    expect(component.hasError).toBeFalse();
    expect(fixture.nativeElement.querySelector('.teams-message').textContent).toContain('No team stats yet');
  });

  describe('sticky scrollbar', () => {
    /** Waits for the scroll events and the ResizeObserver, which fire on a later frame. */
    async function nextFrames(): Promise<void> {
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }

    function tableScroll(): HTMLElement {
      return fixture.nativeElement.querySelector('.table-scroll-container');
    }

    function scrollbar(): HTMLElement {
      return fixture.nativeElement.querySelector('.sticky-scrollbar');
    }

    beforeEach(() => {
      // Narrower than the table, so it scrolls sideways at either layout (one section below 1200px, all columns above)
      document.body.style.width = '300px';
    });

    afterEach(() => {
      document.body.style.width = '';
    });

    it('should be as wide as the table, and only shown while the table overflows', async () => {
      await openCurrentSeason();
      await nextFrames();

      const content = scrollbar().querySelector('.sticky-scrollbar-content') as HTMLElement;
      expect(tableScroll().scrollWidth).toBeGreaterThan(tableScroll().clientWidth);
      expect(content.style.width).toBe(tableScroll().scrollWidth + 'px');
      expect(scrollbar().classList).toContain('overflowing');
      expect(getComputedStyle(scrollbar()).position).toBe('sticky');
    });

    it('should scroll the table, and follow it', async () => {
      await openCurrentSeason();
      await nextFrames();

      scrollbar().scrollLeft = 200;
      await nextFrames();
      expect(tableScroll().scrollLeft).toBe(200);

      tableScroll().scrollLeft = 50;
      await nextFrames();
      expect(scrollbar().scrollLeft).toBe(50);
    });

    it('should hide when the table fits', async () => {
      document.body.style.width = '3000px';
      await openCurrentSeason();
      await nextFrames();

      expect(scrollbar().classList).not.toContain('overflowing');
      expect(getComputedStyle(scrollbar()).display).toBe('none');
    });

    it('should follow the phone menu down when it slides off', async () => {
      await openCurrentSeason();
      expect(scrollbar().classList).not.toContain('menu-hidden');

      scrollingUp.next(false);
      fixture.detectChanges();
      expect(scrollbar().classList).toContain('menu-hidden');

      scrollingUp.next(true);
      fixture.detectChanges();
      expect(scrollbar().classList).not.toContain('menu-hidden');
    });

    it('should stop following the table when the page closes', async () => {
      await openCurrentSeason();
      await nextFrames();
      const table = tableScroll();
      const bar = scrollbar();
      fixture.destroy();

      table.scrollLeft = 120;
      await nextFrames();
      expect(bar.scrollLeft).toBe(0);
      expect(scrollingUp.observed).toBeFalse();
    });
  });
});
