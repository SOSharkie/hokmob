import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { DateTimeUtils } from '@shared/utils/date-time-utils';
import { MockBracketYear, mockPlayoffBracket } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayoffsComponent } from './playoffs.component';

describe('PlayoffsComponent', () => {
  let component: PlayoffsComponent;
  let fixture: ComponentFixture<PlayoffsComponent>;
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: jasmine.Spy;
  let currentSeason: jasmine.Spy;

  const bracketUrl = '/api/nhl/playoff-bracket/';

  beforeEach(async () => {
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayoffsComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigate');
    spyOn(console, 'error');
    // Pinned to the 2026-27 season, whose bracket has no series yet, instead of depending on the date
    currentSeason = spyOn(DateTimeUtils, 'getCurrentNhlSeason').and.returnValue('20262027');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  /** Opens the page, optionally with a season query parameter. */
  function open(season?: string): void {
    queryParams.next(convertToParamMap(season ? {season} : {}));
    fixture = TestBed.createComponent(PlayoffsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Answers the bracket request of a year with its real response. */
  async function flushBracket(year: MockBracketYear): Promise<void> {
    httpMock.expectOne(bracketUrl + year).flush(mockPlayoffBracket(year));
    await settle();
  }

  /** Opens the default page, which falls back from the empty 2027 bracket to 2026. */
  async function openDefault(): Promise<void> {
    open();
    await flushBracket(2027);
    await flushBracket(2026);
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.trim();
  }

  /** The letters of the desktop tree's cards, left to right (West round 1 to East round 1). */
  function desktopCardLetters(): string {
    return Array.from(fixture.nativeElement.querySelectorAll('.standard-playoffs-tree app-playoff-series'))
        .map((card: any) => card.seriesData?.seriesLetter ?? '-').join(' ');
  }

  function desktopSeriesTitles(): string[] {
    const titles: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.standard-playoffs-tree .series-title'));
    return titles.map(title => title.textContent.trim());
  }

  function selectElement(): HTMLSelectElement {
    return fixture.nativeElement.querySelector('.season-picker');
  }

  it('should show the latest bracket with series, falling back from the empty 2026-27 bracket', async () => {
    await openDefault();
    httpMock.expectNone(bracketUrl + '2025');

    expect(text('.playoffs-title')).toBe('2025-26 Playoffs');
    expect(component.isLoading).toBeFalse();
    expect(fixture.nativeElement.querySelector('.loading-container')).toBeNull();
    expect(desktopCardLetters()).toBe('E F G H K L N O M I J A B C D');
    expect(fixture.nativeElement.querySelectorAll('.mobile-playoffs-tree app-playoff-series').length).toBe(15);
    const cards: any[] = Array.from(fixture.nativeElement.querySelectorAll('app-playoff-series'));
    expect(cards.every(card => card.season === 20252026)).toBeTrue();
    expect(text('.qualifying-round-note')).toBeUndefined();
  });

  it('should list the seasons from the latest with series back to 2013-14, newest first', async () => {
    await openDefault();
    await fixture.whenStable();
    fixture.detectChanges();

    const options = Array.from(selectElement().options);
    expect(options.length).toBe(13);
    expect([options[0].value, options[0].textContent.trim()]).toEqual(['20252026', '2025-26']);
    expect([options[12].value, options[12].textContent.trim()]).toEqual(['20132014', '2013-14']);
    expect(selectElement().value).toBe('20252026');
  });

  it('should not fall back when the current season has series', async () => {
    currentSeason.and.returnValue('20252026');
    open();
    await flushBracket(2026);
    expect(text('.playoffs-title')).toBe('2025-26 Playoffs');
    expect(component.seasonOptions[0].value).toBe('20252026');
  });

  it('should show the Western final on the left, the Eastern final on the right and the labels of the bracket',
      async () => {
    await openDefault();
    expect(desktopSeriesTitles()).toEqual(['Western Conference Finals', 'Stanley Cup Final', 'Eastern Conference Finals']);
  });

  it('should load the season of the query parameter', async () => {
    open('20222023');
    httpMock.expectNone(bracketUrl + '2027');
    await flushBracket(2023);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('.playoffs-title')).toBe('2022-23 Playoffs');
    expect(selectElement().value).toBe('20222023');
    expect(desktopCardLetters()).toBe('E F G H K L N O M I J A B C D');
    const final: any = fixture.nativeElement.querySelector('.stanley-cup-final app-playoff-series');
    expect([final.seriesData.topSeed.abbrev, final.seriesData.bottomSeed.abbrev]).toEqual(['VGK', 'FLA']);
    expect(final.season).toBe(20222023);
  });

  it('should hide the 2020 qualifying round behind a note', async () => {
    open('20192020');
    await flushBracket(2020);
    expect(text('.qualifying-round-note')).toBe('2020 also had a qualifying round.');
    expect(fixture.nativeElement.querySelectorAll('.standard-playoffs-tree app-playoff-series').length).toBe(15);
    // Reseeded after round 1: C (WSH-NYI) is under I, next to A
    expect(desktopCardLetters()).toBe('E H F G K L N O M I J A C B D');
  });

  it('should label 2021 from the bracket, without conferences', async () => {
    open('20202021');
    await flushBracket(2021);
    expect(desktopSeriesTitles()).toEqual(['Stanley Cup Semifinals', 'Stanley Cup Final', 'Stanley Cup Semifinals']);
    // M (VGK-MTL) was fed by K and L, so it's on the left
    expect(desktopCardLetters()).toBe('E F G H K L M O N I J A B C D');
  });

  for (const season of ['20122013', 'abc', '20232025', '20272028']) {
    it(`should fall back to the default for the season parameter "${season}"`, async () => {
      open(season);
      await flushBracket(2027);
      await flushBracket(2026);
      expect(text('.playoffs-title')).toBe('2025-26 Playoffs');
    });
  }

  it('should set the season query parameter when a season is picked', async () => {
    await openDefault();
    await fixture.whenStable();
    const select = selectElement();
    select.value = '20222023';
    select.dispatchEvent(new Event('change'));
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {season: '20222023'}}));
  });

  it('should clear the bracket and show the loading state when the season changes', async () => {
    await openDefault();
    queryParams.next(convertToParamMap({season: '20222023'}));
    fixture.detectChanges();

    expect(component.bracket).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.loading-container')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.standard-playoffs-tree')).toBeNull();
    expect(text('.playoffs-title')).toBe('2022-23 Playoffs');

    await flushBracket(2023);
    expect(fixture.nativeElement.querySelector('.loading-container')).toBeNull();
    expect(text('.playoffs-title')).toBe('2022-23 Playoffs');
  });

  it('should ignore a late response of a season picked before', async () => {
    open('20222023');
    const request2023 = httpMock.expectOne(bracketUrl + '2023');
    queryParams.next(convertToParamMap({season: '20202021'}));
    const request2021 = httpMock.expectOne(bracketUrl + '2021');

    request2021.flush(mockPlayoffBracket(2021));
    await settle();
    request2023.flush(mockPlayoffBracket(2023));
    await settle();

    expect(text('.playoffs-title')).toBe('2020-21 Playoffs');
    expect(desktopSeriesTitles()[0]).toBe('Stanley Cup Semifinals');
  });

  it('should show a message for a season without series', async () => {
    open('20222023');
    httpMock.expectOne(bracketUrl + '2023').flush(mockPlayoffBracket(2027));
    await settle();
    expect(text('.playoffs-message')).toBe('No playoff series yet');
    expect(fixture.nativeElement.querySelector('.standard-playoffs-tree')).toBeNull();
  });

  it('should show an error and clear the loading state when the bracket fails', async () => {
    open('20222023');
    httpMock.expectOne(bracketUrl + '2023').flush('Server error', {status: 500, statusText: 'Internal Server Error'});
    await settle();
    expect(component.isLoading).toBeFalse();
    expect(text('.playoffs-message')).toBe("The playoff bracket couldn't be loaded");
    expect(fixture.nativeElement.querySelector('.loading-container')).toBeNull();
  });

  it('should show TBD slots for series the bracket does not list yet', async () => {
    open('20222023');
    const bracket = mockPlayoffBracket(2023);
    bracket.series = bracket.series.filter(series => series.playoffRound === 1);
    httpMock.expectOne(bracketUrl + '2023').flush(bracket);
    await settle();
    expect(desktopCardLetters()).toBe('E F G H - - - - - - - A B C D');
    expect(desktopSeriesTitles()).toEqual(['', '', '']);
  });
});
