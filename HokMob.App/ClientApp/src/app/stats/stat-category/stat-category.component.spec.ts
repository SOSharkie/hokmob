import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { By, DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { registerLucideIcons } from '@shared/icons/lucide-icons';
import { ActivatedRoute, convertToParamMap, ParamMap, Router, RouterLink } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { NhlTeamUtils } from '@shared/utils/nhl-team-utils';
import { StatCategoryUtils } from '@shared/utils/stat-category-utils';
import {
  mockGoalieSavePctgLeaders25,
  mockGoalieStatsLeaders,
  mockHitsAndShotsLeaders,
  mockSeasonPlayersGoalieSavePctg,
  mockSeasonPlayersSkaterPoints,
  mockSkaterPointsLeaders25,
  mockStandingsResponse
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { StatCategoryComponent } from './stat-category.component';

describe('StatCategoryComponent', () => {
  let component: StatCategoryComponent;
  let fixture: ComponentFixture<StatCategoryComponent>;
  let httpMock: HttpTestingController;
  let params: BehaviorSubject<ParamMap>;
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: jasmine.Spy;
  let currentSeason: jasmine.Spy;

  const standingsUrl = '/api/nhl/standings/now';
  const skaterLeadersUrl = '/api/nhl/skater-stats-leaders/20252026/';
  const goalieLeadersUrl = '/api/nhl/goalie-stats-leaders/20252026/';
  const hitsAndShotsUrl = '/api/nhl-stats/leaders?season=20252026&gameType=';
  const seasonPlayersUrl = '/api/nhl-stats/season-players?season=20252026&gameType=';

  const pointsIds = mockSkaterPointsLeaders25().points.map(leader => leader.id).join(',');
  const savePctgIds = mockGoalieSavePctgLeaders25().savePctg.map(leader => leader.id).join(',');

  beforeEach(async () => {
    params = new BehaviorSubject<ParamMap>(convertToParamMap({category: 'points'}));
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ StatCategoryComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {paramMap: params, queryParamMap: queryParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    registerLucideIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
    httpMock = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigate');
    spyOn(console, 'error');
    // The page defaults to the playoffs during playoff mode, so the tests pin it instead of depending on the date
    currentSeason = spyOn(TestBed.inject(NhlStatsApiService), 'getCurrentSeason')
        .and.resolveTo({season: 20262027, isPlayoffMode: false});
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  /** Opens the table of a category, optionally with a gameType query parameter ("R" or "P"), and waits for playoff mode. */
  async function open(category: string = 'points', gameType?: string): Promise<void> {
    params.next(convertToParamMap({category}));
    queryParams.next(convertToParamMap(gameType ? {gameType} : {}));
    fixture = TestBed.createComponent(StatCategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }

  /** Waits for the component's promises to settle and renders the result. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Answers the standings request with the real final 2025-26 standings. */
  async function flushStandings(): Promise<void> {
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    await settle();
  }

  /** Opens the points table and answers every request with the real regular season top 25. */
  async function openPoints(): Promise<void> {
    await open('points', 'R');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '2?limit=25&categories=points').flush(mockSkaterPointsLeaders25());
    await settle();
    httpMock.expectOne(seasonPlayersUrl + '2&position=skater&ids=' + pointsIds).flush(mockSeasonPlayersSkaterPoints());
    await settle();
  }

  function text(element: Element): string {
    return element?.textContent.replace(/\s+/g, ' ').trim();
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.stat-category-row'));
  }

  function headers(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.stat-header'));
  }

  /** A row's stat values, in column order. */
  function values(row: HTMLElement): string[] {
    return Array.from(row.querySelectorAll('.stat-cell')).map(cell => text(cell));
  }

  function rowOf(name: string): HTMLElement {
    return rows().find(row => text(row.querySelector('.player-name')) === name);
  }

  function message(): string {
    return text(fixture.nativeElement.querySelector('.stat-category-message'));
  }

  it('should show a spinner until the table loads', async () => {
    await open('points', 'R');
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeTruthy();

    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '2?limit=25&categories=points').flush(mockSkaterPointsLeaders25());
    await settle();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeTruthy();
    expect(rows().length).toBe(0);

    httpMock.expectOne(seasonPlayersUrl + '2&position=skater&ids=' + pointsIds).flush(mockSeasonPlayersSkaterPoints());
    await settle();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeNull();
    expect(rows().length).toBe(25);
  });

  it('should show the real top 25 in points, in the leaders\' order', async () => {
    await openPoints();

    expect(text(fixture.nativeElement.querySelector('.stat-category-title'))).toBe('Points');
    expect(text(fixture.nativeElement.querySelector('.stat-category-subtitle'))).toBe('2025-2026 Regular Season');
    const names = rows().map(row => text(row.querySelector('.player-name')));
    expect(names.length).toBe(25);
    expect(names[0]).toBe('Connor McDavid');
    expect(names[1]).toBe('Nikita Kucherov');
    expect(names[24]).toBe('Sebastian Aho');
  });

  it('should show the related stats beside the category\'s own, from the season rows', async () => {
    await openPoints();

    expect(headers().map(header => text(header))).toEqual(['GP', 'G', 'A', '+/-', 'P/GP', 'P']);
    expect(headers().map(header => header.title))
        .toEqual(['Games played', 'Goals', 'Assists', 'Plus/minus', 'Points per game', 'Points']);
    expect(values(rowOf('Connor McDavid'))).toEqual(['82', '48', '90', '+17', '1.68', '138']);
    expect(text(rowOf('Connor McDavid').querySelector('.player-team-label'))).toBe('EDM');
  });

  it('should make the category\'s own stat stand out and sort the table', async () => {
    await openPoints();

    const selectedHeaders = headers().filter(header => header.classList.contains('selected-column'));
    expect(selectedHeaders.map(header => text(header))).toEqual(['P']);
    expect(headers()[headers().length - 1]).toBe(selectedHeaders[0]);
    expect(selectedHeaders[0].getAttribute('aria-sort')).toBe('descending');
    expect(headers()[0].getAttribute('aria-sort')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.sort-indicator').length).toBe(1);
    expect(selectedHeaders[0].querySelector('.sort-indicator').classList).not.toContain('ascending');
    const selectedCells = rows()[0].querySelectorAll('.stat-cell.selected-column');
    expect(selectedCells.length).toBe(1);
    expect(text(selectedCells[0])).toBe('138');
    expect(rows()[0].lastElementChild).toBe(selectedCells[0]);
  });

  it('should put the leader\'s own stat in their team color', async () => {
    await openPoints();

    const leaderValues = fixture.nativeElement.querySelectorAll('.leader-value');
    expect(leaderValues.length).toBe(1);
    expect(text(leaderValues[0])).toBe('138');
    const edmontonColor = NhlTeamColorUtils.getTeamPrimaryColor(NhlTeamUtils.getTeamIdByAbbrev('EDM'));
    const probe = document.createElement('span');
    probe.style.backgroundColor = edmontonColor;
    expect(leaderValues[0].style.backgroundColor).toBe(probe.style.backgroundColor);
    expect(rows()[0].classList).toContain('leader-row');
    expect(rows()[1].classList).not.toContain('leader-row');
  });

  it('should rank tied players together', async () => {
    await openPoints();

    const ranks = rows().map(row => text(row.querySelector('.rank-cell')));
    expect(ranks.slice(0, 9)).toEqual(['1', '2', '3', '4', '5', '6', 'T-7', 'T-7', '9']);
    expect(text(rowOf('Clayton Keller').querySelector('.rank-cell'))).toBe('T-15');
    expect(text(rowOf('Sebastian Aho').querySelector('.rank-cell'))).toBe('25');
  });

  it('should hide the less important columns on a phone, never the category\'s own', async () => {
    await openPoints();

    const phoneHidden = headers().filter(header => header.classList.contains('phone-hidden'));
    expect(phoneHidden.map(header => text(header))).toEqual(['+/-', 'P/GP']);
    expect(rows()[0].querySelectorAll('.stat-cell.phone-hidden').length).toBe(2);
  });

  it('should show a traded player with the team he leads for', async () => {
    await openPoints();

    // Artemi Panarin's season row is "NYR,LAK", and the web API's leader has him with Los Angeles
    expect(text(rowOf('Artemi Panarin').querySelector('.player-team-label'))).toBe('LAK');
  });

  it('should link every player to their page, and the back button to the stats page', async () => {
    await openPoints();

    const playerLink = fixture.debugElement.query(By.css('.player-link')).injector.get(RouterLink);
    expect(playerLink.urlTree.toString()).toBe('/player/8478402');
    const backLink = fixture.debugElement.query(By.css('.back-link')).injector.get(RouterLink);
    expect(backLink.urlTree.toString()).toBe('/stats');
    expect(backLink.queryParamsHandling).toBe('preserve');
  });

  it('should show a goalie category from the goalie leaders and goalie season rows', async () => {
    await open('save-percentage', 'R');
    await flushStandings();
    httpMock.expectOne(goalieLeadersUrl + '2?limit=25&categories=savePctg').flush(mockGoalieSavePctgLeaders25());
    await settle();
    httpMock.expectOne(seasonPlayersUrl + '2&position=goalie&ids=' + savePctgIds)
        .flush(mockSeasonPlayersGoalieSavePctg());
    await settle();

    expect(text(fixture.nativeElement.querySelector('.stat-category-title'))).toBe('Save Percentage');
    expect(headers().map(header => text(header))).toEqual(['GP', 'GS', 'W', 'GAA', 'SA', 'SO', 'SV%']);
    expect(text(rows()[0].querySelector('.player-name'))).toBe('Scott Wedgewood');
    expect(values(rows()[0])).toEqual(['45', '43', '31', '2.02', '1093', '4', '.921']);
    expect(text(rows()[24].querySelector('.player-name'))).toBe('Dustin Wolf');
  });

  it('should sort a goals against average lowest first', async () => {
    await open('goals-against-average', 'R');
    await flushStandings();
    httpMock.expectOne(goalieLeadersUrl + '2?limit=25&categories=goalsAgainstAverage').flush(mockGoalieStatsLeaders());
    await settle();
    const leaderIds = mockGoalieStatsLeaders().goalsAgainstAverage.map(leader => leader.id).join(',');
    httpMock.expectOne(seasonPlayersUrl + '2&position=goalie&ids=' + leaderIds).flush(mockSeasonPlayersGoalieSavePctg());
    await settle();

    const selectedHeader = headers().find(header => header.classList.contains('selected-column'));
    expect(text(selectedHeader)).toBe('GAA');
    expect(selectedHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(selectedHeader.querySelector('.sort-indicator').classList).toContain('ascending');
    expect(text(rows()[0].querySelector('.stat-cell.selected-column'))).toBe('2.02');
  });

  it('should show the hits leaders from the stats API, with a dash for a player without a season row', async () => {
    await open('hits', 'R');
    await flushStandings();
    httpMock.expectOne(hitsAndShotsUrl + '2&limit=25').flush(mockHitsAndShotsLeaders());
    await settle();
    const hitsIds = mockHitsAndShotsLeaders().hits.map(row => row.playerId).join(',');
    httpMock.expectOne(seasonPlayersUrl + '2&position=skater&ids=' + hitsIds).flush({players: []});
    await settle();

    expect(rows().length).toBe(5);
    expect(text(rows()[0].querySelector('.player-name'))).toBe('Yakov Trenin');
    expect(headers().map(header => text(header))).toEqual(['GP', 'BLK', 'TK', 'GV', 'Hits']);
    expect(values(rows()[0])).toEqual(['-', '-', '-', '-', '413']);
  });

  it('should still show the leaders with their own stat when the season rows fail', async () => {
    await open('points', 'R');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '2?limit=25&categories=points').flush(mockSkaterPointsLeaders25());
    await settle();
    httpMock.expectOne(seasonPlayersUrl + '2&position=skater&ids=' + pointsIds)
        .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();

    expect(rows().length).toBe(25);
    expect(values(rows()[0])).toEqual(['-', '-', '-', '-', '-', '138']);
    expect(message()).toBeUndefined();
  });

  it('should say the stats couldn\'t be loaded when the leaders fail', async () => {
    await open('points', 'R');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '2?limit=25&categories=points')
        .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();

    expect(message()).toBe('The stats couldn\'t be loaded');
    expect(rows().length).toBe(0);
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeNull();
  });

  it('should say the stats couldn\'t be loaded when the standings fail', async () => {
    await open('points', 'R');
    httpMock.expectOne(standingsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();

    expect(message()).toBe('The stats couldn\'t be loaded');
  });

  it('should show that there are no stats yet without asking for season rows', async () => {
    // The playoff leaders before the playoffs start have no categories
    await open('points', 'P');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '3?limit=25&categories=points').flush({});
    await settle();

    httpMock.expectNone(request => request.url.startsWith('/api/nhl-stats/season-players'));
    expect(message()).toBe('No stats yet');
    expect(fixture.nativeElement.querySelector('.stat-category-table')).toBeNull();
  });

  it('should go back to the stats page for an unknown category, without any request', async () => {
    await open('faceoffs', 'P');

    expect(navigate).toHaveBeenCalledWith(['/stats'], {queryParamsHandling: 'preserve', replaceUrl: true});
    httpMock.expectNone(standingsUrl);
  });

  it('should default to the playoffs during playoff mode and show the game type picker', async () => {
    currentSeason.and.resolveTo({season: 20252026, isPlayoffMode: true});
    await open('points');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '3?limit=25&categories=points').flush({});
    await settle();

    expect(component.playoffsSelected).toBeTrue();
    expect(text(fixture.nativeElement.querySelector('.stat-category-subtitle'))).toBe('2025-2026 Playoffs');
    expect(text(fixture.nativeElement.querySelector('.game-type-picker'))).toBe('Playoffs');
  });

  it('should hide the game type picker outside playoff mode, and when the season dates fail', async () => {
    currentSeason.and.rejectWith(new Error('No season'));
    await open('points');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '2?limit=25&categories=points').flush({});
    await settle();

    expect(component.playoffsSelected).toBeFalse();
    expect(fixture.nativeElement.querySelector('.game-type-picker')).toBeNull();
    expect(text(fixture.nativeElement.querySelector('.category-picker'))).toBe('Points');
  });

  it('should switch the game type through the query parameter', async () => {
    await open('points', 'P');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '3?limit=25&categories=points').flush({});
    await settle();

    component.selectGameType(true);
    expect(navigate).not.toHaveBeenCalled();
    component.selectGameType(false);
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {gameType: 'R'}}));

    // The router would push the new parameter; the season isn't asked for again
    queryParams.next(convertToParamMap({gameType: 'R'}));
    await settle();
    httpMock.expectNone(standingsUrl);
    httpMock.expectOne(skaterLeadersUrl + '2?limit=25&categories=points').flush({});
    await settle();
    expect(component.playoffsSelected).toBeFalse();
  });

  it('should open another category, keeping the game type', async () => {
    await openPoints();

    component.selectCategory(StatCategoryUtils.getCategory('points'));
    expect(navigate).not.toHaveBeenCalled();
    component.selectCategory(StatCategoryUtils.getCategory('wins'));
    expect(navigate).toHaveBeenCalledWith(['/stats', 'wins'], {queryParamsHandling: 'preserve'});
  });

  it('should ignore the response of a category that is no longer shown', async () => {
    await open('points', 'R');
    await flushStandings();
    const pointsRequest = httpMock.expectOne(skaterLeadersUrl + '2?limit=25&categories=points');

    params.next(convertToParamMap({category: 'hits'}));
    await settle();
    expect(component.category.id).toBe('hits');
    const hitsRequest = httpMock.expectOne(hitsAndShotsUrl + '2&limit=25');

    pointsRequest.flush(mockSkaterPointsLeaders25());
    await settle();
    // The points leaders' season rows are still asked for, but never shown
    httpMock.expectOne(seasonPlayersUrl + '2&position=skater&ids=' + pointsIds).flush(mockSeasonPlayersSkaterPoints());
    await settle();
    expect(rows().length).toBe(0);

    hitsRequest.flush(mockHitsAndShotsLeaders());
    await settle();
    httpMock.expectOne(request => request.url.startsWith(seasonPlayersUrl + '2&position=skater')).flush({players: []});
    await settle();
    expect(text(rows()[0].querySelector('.player-name'))).toBe('Yakov Trenin');
    expect(headers().map(header => text(header))).toEqual(['GP', 'BLK', 'TK', 'GV', 'Hits']);
  });

  it('should replace a headshot that fails to load with the blank one', async () => {
    await openPoints();

    const headshot: HTMLImageElement = fixture.nativeElement.querySelector('.player-headshot');
    expect(headshot.getAttribute('src')).toBe('https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png');
    headshot.dispatchEvent(new Event('error'));
    expect(headshot.src).toContain('assets/blank_headshot.png');
  });
});
