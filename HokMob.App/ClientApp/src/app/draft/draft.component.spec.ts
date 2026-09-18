import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import {
  mockDraftPicks,
  mockDraftStats,
  MockDraftStatsYear
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { DraftComponent } from './draft.component';

describe('DraftComponent', () => {
  let component: DraftComponent;
  let fixture: ComponentFixture<DraftComponent>;
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: jasmine.Spy;

  const picksUrl = '/api/nhl/draft/picks/';
  const statsUrl = '/api/nhl-stats/draft';

  beforeEach(async () => {
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ DraftComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigate');
    spyOn(console, 'error');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  /** Opens the page with query parameters, like {year: '2015', round: '1'}. */
  function open(params: {[key: string]: string} = {}): void {
    queryParams.next(convertToParamMap(params));
    fixture = TestBed.createComponent(DraftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Opens a captured round 1 and answers both requests with its real responses. */
  async function openYear(year: MockDraftStatsYear): Promise<void> {
    open({year: String(year), round: '1'});
    httpMock.expectOne(picksUrl + year + '/1').flush(mockDraftPicks(year));
    httpMock.expectOne(statsUrl + '?year=' + year + '&round=1').flush(mockDraftStats(year));
    await settle();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.trim();
  }

  function rowElements(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.draft-pick-row'));
  }

  /** A row's cell texts: pick, team, (headshot), player, position, assists, goals, points. */
  function rowCells(overallPick: number): string[] {
    const row = rowElements().find(element => element.querySelector('.pick-cell').textContent.trim() === String(overallPick));
    return Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim());
  }

  function rowElement(overallPick: number): HTMLElement {
    return rowElements().find(element => element.querySelector('.pick-cell').textContent.trim() === String(overallPick));
  }

  /** The picker button: 'year' or 'round'. */
  function picker(name: 'year' | 'round'): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.' + name + '-picker');
  }

  /** Opens a picker's menu and returns its options. The menu renders in the overlay, outside the fixture. */
  function openMenu(name: 'year' | 'round'): HTMLButtonElement[] {
    picker(name).click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll('.pill-picker-menu.' + name + '-menu .pill-picker-option'));
  }

  function optionTexts(options: HTMLElement[]): string[] {
    return options.map(option => option.textContent.trim());
  }

  it('should show the latest draft round 1 by default, then its stats', async () => {
    open();
    httpMock.expectNone(req => req.url.startsWith(statsUrl));
    expect(component.isLoading).toBeTrue();
    expect(fixture.nativeElement.querySelector('.loading-container')).toBeTruthy();

    httpMock.expectOne(picksUrl + 'now').flush(mockDraftPicks('now'));
    await settle();
    expect(text('.draft-title')).toBe('2026 NHL Draft');
    expect(fixture.nativeElement.querySelector('.loading-container')).toBeNull();
    // The stats haven't come back yet, so their cells are empty rather than "-"
    expect(rowCells(1)).toEqual(['1', 'Toronto Maple Leafs', '', 'Gavin McKenna', 'LW', '', '', '']);

    httpMock.expectOne(statsUrl + '?year=2026&round=1').flush({players: []});
    await settle();
    expect(rowElements().length).toBe(32);
    expect(rowCells(2)).toEqual(['2', 'San Jose Sharks', '', 'Ivar Stenberg', 'LW', '-', '-', '-']);
    expect(rowElement(1).querySelector<HTMLImageElement>('.player-headshot').getAttribute('src'))
        .toBe('assets/blank_headshot.png');
    expect(rowElement(1).querySelector('a')).toBeNull();
  });

  it('should list the draft years from the latest back to 2006, newest first, and the year\'s rounds', async () => {
    open();
    httpMock.expectOne(picksUrl + 'now').flush(mockDraftPicks('now'));
    // The latest draft's stats wait for its year
    await settle();
    httpMock.expectOne(statsUrl + '?year=2026&round=1').flush({players: []});
    await settle();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(picker('year').textContent.trim()).toBe('2026');
    const years = openMenu('year');
    expect(years.length).toBe(21);
    expect(years[0].textContent.trim()).toBe('2026');
    expect(years[20].textContent.trim()).toBe('2006');
    const selected = years.filter(year => year.classList.contains('selected'));
    expect(optionTexts(selected)).toEqual(['2026']);
    expect(selected[0].getAttribute('role')).toBe('menuitemradio');
    expect(selected[0].getAttribute('aria-checked')).toBe('true');

    expect(picker('round').textContent.trim()).toBe('Round 1');
    expect(optionTexts(openMenu('round')))
        .toEqual(['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Round 6', 'Round 7']);
  });

  it('should show a year and round from the query parameters, with career stats, links and headshots', async () => {
    await openYear(2015);

    expect(text('.draft-title')).toBe('2015 NHL Draft');
    expect(rowElements().length).toBe(30);
    expect(rowCells(1)).toEqual(['1', 'Edmonton Oilers', '', 'Connor McDavid', 'C', '811', '409', '1220']);
    const mcDavid = rowElement(1);
    // app-team-logo isn't declared here, so the URL it was given is read off the element
    expect(mcDavid.querySelector<HTMLElement & {src: string}>('.team-logo').src)
        .toBe(mockDraftPicks(2015).picks[0].teamLogoLight);
    expect(mcDavid.querySelector('.player-headshot').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/latest/8478402.png');
    expect(mcDavid.querySelector('a.player-name').getAttribute('href')).toBe('/player/8478402');
  });

  it('should show a goalie\'s career assists, goals and points', async () => {
    await openYear(2015);
    expect(rowCells(22)).toEqual(['22', 'Washington Capitals', '', 'Ilya Samsonov', 'G', '5', '0', '5']);
  });

  it('should fill in an "F" position from the career stats', async () => {
    await openYear(2006);
    expect(rowCells(3)).toEqual(['3', 'Chicago Blackhawks', '', 'Jonathan Toews', 'C', '529', '383', '912']);
    expect(rowCells(10)[4]).toBe('RW');
    expect(rowCells(13)[4]).toBe('LW');
  });

  it('should show "-" and the blank headshot for a player who never played', async () => {
    await openYear(2006);
    expect(rowCells(19)).toEqual(['19', 'Anaheim Ducks', '', 'Mark Mitera', 'D', '-', '-', '-']);
    expect(rowElement(19).querySelector('.player-headshot').getAttribute('src')).toBe('assets/blank_headshot.png');
    expect(rowElement(19).querySelector('a')).toBeNull();
  });

  it('should keep a combined position and an "F" without stats as they are', async () => {
    open({year: '2006', round: '1'});
    const picks = mockDraftPicks(2006);
    picks.picks[0].positionCode = 'C/RW';
    picks.picks[18].positionCode = 'F';
    httpMock.expectOne(picksUrl + '2006/1').flush(picks);
    httpMock.expectOne(statsUrl + '?year=2006&round=1').flush(mockDraftStats(2006));
    await settle();
    expect(rowCells(1)[4]).toBe('C/RW');
    expect(rowCells(19)[4]).toBe('F');
  });

  it('should show a forfeited pick without a headshot, position or stats', async () => {
    open({year: '2021', round: '1'});
    httpMock.expectOne(picksUrl + '2021/1').flush(mockDraftPicks(2021));
    httpMock.expectOne(statsUrl + '?year=2021&round=1').flush({players: []});
    await settle();

    expect(rowCells(11)).toEqual(['11', 'Arizona Coyotes', '', 'Forfeited', '-', '-', '-', '-']);
    const forfeited = rowElement(11);
    expect(forfeited.classList).toContain('forfeited-row');
    expect(forfeited.querySelector('.player-headshot')).toBeNull();
  });

  it('should not match career stats with another last name', async () => {
    open({year: '2015', round: '1'});
    const stats = mockDraftStats(2015);
    stats.players[0].lastName = 'Eichel';
    httpMock.expectOne(picksUrl + '2015/1').flush(mockDraftPicks(2015));
    httpMock.expectOne(statsUrl + '?year=2015&round=1').flush(stats);
    await settle();

    expect(rowCells(1).slice(4)).toEqual(['C', '-', '-', '-']);
    expect(rowElement(1).querySelector('a')).toBeNull();
  });

  it('should match a last name that differs only in accents and case', async () => {
    open({year: '2015', round: '1'});
    const stats = mockDraftStats(2015);
    stats.players[0].lastName = 'MCDÁVID';
    httpMock.expectOne(picksUrl + '2015/1').flush(mockDraftPicks(2015));
    httpMock.expectOne(statsUrl + '?year=2015&round=1').flush(stats);
    await settle();
    expect(rowCells(1)[7]).toBe('1220');
  });

  it('should load the latest draft for a year before 2006, after this year or not a number', async () => {
    for (const year of ['2005', String(new Date().getFullYear() + 1), 'abc']) {
      open({year: year, round: '3'});
      httpMock.expectOne(picksUrl + 'now').flush(mockDraftPicks('now'));
      // The latest draft's stats wait for its year
      await settle();
      httpMock.expectOne(statsUrl + '?year=2026&round=1').flush({players: []});
      await settle();
      expect(component.requestedRound).toBe(1);
      fixture.destroy();
    }
  });

  it('should load round 1 for a round that isn\'t 1 to 7', async () => {
    open({year: '2015', round: '9'});
    httpMock.expectOne(picksUrl + '2015/1').flush(mockDraftPicks(2015));
    httpMock.expectOne(statsUrl + '?year=2015&round=1').flush(mockDraftStats(2015));
    await settle();
    expect(text('.draft-title')).toBe('2015 NHL Draft');
  });

  it('should keep the round when picking another year', async () => {
    open({year: '2015', round: '3'});
    // Only round 1 is captured; the requests are what's checked here.
    httpMock.expectOne(picksUrl + '2015/3').flush(mockDraftPicks(2015));
    httpMock.expectOne(statsUrl + '?year=2015&round=3').flush({players: []});
    await settle();

    expect(picker('round').textContent.trim()).toBe('Round 3');
    openMenu('year').find(option => option.textContent.trim() === '2006').click();
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {year: 2006, round: 3}}));
  });

  it('should keep the year shown when picking another round', async () => {
    open();
    httpMock.expectOne(picksUrl + 'now').flush(mockDraftPicks('now'));
    // The latest draft's stats wait for its year
    await settle();
    httpMock.expectOne(statsUrl + '?year=2026&round=1').flush({players: []});
    await settle();

    openMenu('round').find(option => option.textContent.trim() === 'Round 4').click();
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {year: 2026, round: 4}}));
  });

  it('should load the new year and round when the query parameters change', async () => {
    await openYear(2015);
    queryParams.next(convertToParamMap({year: '2006', round: '1'}));
    expect(rowElements().length).toBe(30);
    fixture.detectChanges();
    expect(rowElements().length).toBe(0);
    expect(text('.draft-title')).toBe('2006 NHL Draft');

    httpMock.expectOne(picksUrl + '2006/1').flush(mockDraftPicks(2006));
    httpMock.expectOne(statsUrl + '?year=2006&round=1').flush(mockDraftStats(2006));
    await settle();
    expect(rowCells(1)[3]).toBe('Erik Johnson');
  });

  it('should ignore late responses of a year picked before', async () => {
    open({year: '2015', round: '1'});
    const picks2015 = httpMock.expectOne(picksUrl + '2015/1');
    const stats2015 = httpMock.expectOne(statsUrl + '?year=2015&round=1');
    queryParams.next(convertToParamMap({year: '2006', round: '1'}));
    const picks2006 = httpMock.expectOne(picksUrl + '2006/1');
    const stats2006 = httpMock.expectOne(statsUrl + '?year=2006&round=1');

    picks2006.flush(mockDraftPicks(2006));
    stats2006.flush(mockDraftStats(2006));
    await settle();
    picks2015.flush(mockDraftPicks(2015));
    stats2015.flush(mockDraftStats(2015));
    await settle();

    expect(text('.draft-title')).toBe('2006 NHL Draft');
    expect(rowCells(1)).toEqual(['1', 'St. Louis Blues', '', 'Erik Johnson', 'D', '253', '95', '348']);
  });

  it('should still show the picks when the career stats fail', async () => {
    open({year: '2015', round: '1'});
    httpMock.expectOne(picksUrl + '2015/1').flush(mockDraftPicks(2015));
    httpMock.expectOne(statsUrl + '?year=2015&round=1').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();

    expect(rowElements().length).toBe(30);
    expect(rowCells(1)).toEqual(['1', 'Edmonton Oilers', '', 'Connor McDavid', 'C', '-', '-', '-']);
    expect(fixture.nativeElement.querySelector('.draft-message')).toBeNull();
  });

  it('should show an error and clear the loading state when the picks fail', async () => {
    open({year: '2015', round: '1'});
    httpMock.expectOne(picksUrl + '2015/1').flush('Server error', {status: 500, statusText: 'Internal Server Error'});
    httpMock.expectOne(statsUrl + '?year=2015&round=1').flush(mockDraftStats(2015));
    await settle();

    expect(component.isLoading).toBeFalse();
    expect(text('.draft-message')).toBe('The draft couldn\'t be loaded');
    expect(fixture.nativeElement.querySelector('.draft-picks-table')).toBeNull();
  });

  it('should show a message for a round without picks', async () => {
    open();
    const draft = mockDraftPicks('now');
    draft.picks = [];
    httpMock.expectOne(picksUrl + 'now').flush(draft);
    // The latest draft's stats wait for its year
    await settle();
    httpMock.expectOne(statsUrl + '?year=2026&round=1').flush({players: []});
    await settle();

    expect(text('.draft-message')).toBe('No picks yet');
    expect(fixture.nativeElement.querySelector('.draft-picks-table')).toBeNull();
  });

  it('should scroll an opened menu to the selected year', async () => {
    await openYear(2006);
    const scrollIntoView = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const years = openMenu('year');
    await new Promise(resolve => setTimeout(resolve));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.calls.mostRecent().object).toBe(years.find(year => year.textContent.trim() === '2006'));
  });

  it('should keep the pickers filled while another year loads', async () => {
    await openYear(2015);
    queryParams.next(convertToParamMap({year: '2006', round: '1'}));
    fixture.detectChanges();
    expect(picker('year').textContent.trim()).toBe('2006');
    expect(openMenu('year').length).toBe(21);
    httpMock.expectOne(picksUrl + '2006/1').flush(mockDraftPicks(2006));
    httpMock.expectOne(statsUrl + '?year=2006&round=1').flush(mockDraftStats(2006));
    await settle();
  });
});
