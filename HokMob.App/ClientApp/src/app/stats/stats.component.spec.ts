import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';
import { LeaderboardEntry } from '@app/stats/stat-leaderboard/stat-leaderboard.component';
import {
  mockGoalieStatsLeaders,
  mockHitsAndShotsLeaders,
  mockSkaterStatsLeaders,
  mockStandingsResponse
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { StatsComponent } from './stats.component';

describe('StatsComponent', () => {
  let component: StatsComponent;
  let fixture: ComponentFixture<StatsComponent>;
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: jasmine.Spy;
  let currentSeason: jasmine.Spy;

  const standingsUrl = '/api/nhl/standings/now';
  const skaterLeadersUrl = '/api/nhl/skater-stats-leaders/20252026/';
  const goalieLeadersUrl = '/api/nhl/goalie-stats-leaders/20252026/';
  const hitsAndShotsUrl = '/api/nhl-stats/leaders?season=20252026&gameType=';
  const skaterCategories = '?limit=5&categories=points,goals,assists,toi';
  const goalieCategories = '?limit=5&categories=savePctg,goalsAgainstAverage,wins';

  beforeEach(async () => {
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ StatsComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

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

  /** Opens the page, optionally with a gameType query parameter ("R" or "P"), and waits for playoff mode. */
  async function open(gameType?: string): Promise<void> {
    queryParams.next(convertToParamMap(gameType ? {gameType} : {}));
    fixture = TestBed.createComponent(StatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }

  /** Clicks a game type filter, and pushes the query parameter the router would set. */
  function switchGameType(isPlayoffs: boolean): void {
    component.updateGameType(isPlayoffs);
    queryParams.next(convertToParamMap({gameType: isPlayoffs ? 'P' : 'R'}));
    fixture.detectChanges();
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

  /**
   * Answers the three leader requests of a game type with real responses. The hits and shots fixture is the regular
   * season one, the only captured stats API leaders response.
   */
  async function flushLeaders(gameType: 2 | 3 = 2): Promise<void> {
    httpMock.expectOne(skaterLeadersUrl + gameType + skaterCategories).flush(mockSkaterStatsLeaders(gameType));
    httpMock.expectOne(goalieLeadersUrl + gameType + goalieCategories).flush(mockGoalieStatsLeaders(gameType));
    httpMock.expectOne(hitsAndShotsUrl + gameType + '&limit=5').flush(mockHitsAndShotsLeaders());
    await settle();
  }

  /** The leaderboard components, read through the inputs bound on their elements. */
  function boards(): {statTitle: string, entries: LeaderboardEntry[], format: string}[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-stat-leaderboard'));
  }

  function board(statTitle: string): {statTitle: string, entries: LeaderboardEntry[], format: string} {
    return boards().find(leaderboard => leaderboard.statTitle === statTitle);
  }

  it('should show a spinner until the leaders load', async () => {
    await open('R');
    expect(component.isLoading).toBeTrue();
    expect(fixture.nativeElement.querySelector('.loading-gif')).toBeTruthy();
    expect(boards().length).toBe(0);

    await flushStandings();
    await flushLeaders();

    expect(component.isLoading).toBeFalse();
    expect(fixture.nativeElement.querySelector('.loading-gif')).toBeNull();
  });

  it('should show the nine real leaderboards of the standings season', async () => {
    await open('R');
    await flushStandings();
    await flushLeaders();

    expect(boards().map(leaderboard => leaderboard.statTitle)).toEqual([
      'Points', 'Goals', 'Assists', 'Save Percentage', 'Goals Against Average', 'Wins', 'Shots', 'Hits',
      'Time On Ice Per Game'
    ]);
    expect(board('Points').format).toBe('number');
    expect(board('Save Percentage').format).toBe('savePctg');
    expect(board('Goals Against Average').format).toBe('gaa');
    expect(board('Time On Ice Per Game').format).toBe('toi');
  });

  it('should convert web API leaders with their own headshot and team', async () => {
    await open('R');
    await flushStandings();
    await flushLeaders();

    const points = board('Points').entries;
    expect(points.length).toBe(5);
    expect(points[0]).toEqual({
      playerId: 8478402,
      name: 'Connor McDavid',
      teamId: 22,
      headshot: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png',
      value: 138
    });
    expect(board('Wins').entries[0].name).toBe('Andrei Vasilevskiy');
    expect(board('Wins').entries[0].value).toBe(39);
    expect(board('Time On Ice Per Game').entries[0].value).toBe(1664.2568);
  });

  it('should convert stats API rows with a built headshot and their last team', async () => {
    await open('R');
    await flushStandings();
    await flushLeaders();

    expect(board('Hits').entries[0]).toEqual({
      playerId: 8478508,
      name: 'Yakov Trenin',
      teamId: 30,
      headshot: 'https://assets.nhle.com/mugs/nhl/20252026/MIN/8478508.png',
      value: 413
    });
    expect(board('Shots').entries[0].name).toBe('Nathan MacKinnon');
    expect(board('Shots').entries[0].value).toBe(350);
  });

  it('should ask for the playoffs when the query parameter says so', async () => {
    await open('P');
    expect(component.playoffsSelected).toBeTrue();
    await flushStandings();
    await flushLeaders(3);

    expect(board('Points').entries[0].name).toBe('Mitch Marner');
    expect(board('Points').entries[0].value).toBe(29);
  });

  it('should reload only the leaders when the game type is switched', async () => {
    await open('R');
    await flushStandings();
    await flushLeaders();

    switchGameType(true);
    expect(component.isLoading).toBeTrue();
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {gameType: 'P'}}));
    // The standings are only asked for once: httpMock.verify() in afterEach fails on a second request
    await flushLeaders(3);

    expect(component.isLoading).toBeFalse();
    expect(board('Points').entries[0].name).toBe('Mitch Marner');
  });

  it('should ignore the leaders of the game type left behind', async () => {
    await open('R');
    await flushStandings();
    const regularSeasonSkaters = httpMock.expectOne(skaterLeadersUrl + '2' + skaterCategories);
    const regularSeasonGoalies = httpMock.expectOne(goalieLeadersUrl + '2' + goalieCategories);
    const regularSeasonHits = httpMock.expectOne(hitsAndShotsUrl + '2&limit=5');

    switchGameType(true);
    regularSeasonSkaters.flush(mockSkaterStatsLeaders(2));
    regularSeasonGoalies.flush(mockGoalieStatsLeaders(2));
    regularSeasonHits.flush(mockHitsAndShotsLeaders());
    await settle();

    expect(component.isLoading).toBeTrue();
    expect(boards().length).toBe(0);

    await flushLeaders(3);
    expect(board('Points').entries[0].name).toBe('Mitch Marner');
  });

  it('should leave only the boards of a failed source empty', async () => {
    await open('R');
    await flushStandings();
    httpMock.expectOne(skaterLeadersUrl + '2' + skaterCategories)
        .flush('Bad Gateway', {status: 502, statusText: 'Bad Gateway'});
    httpMock.expectOne(goalieLeadersUrl + '2' + goalieCategories).flush(mockGoalieStatsLeaders(2));
    httpMock.expectOne(hitsAndShotsUrl + '2&limit=5').flush(mockHitsAndShotsLeaders());
    await settle();

    expect(component.isLoading).toBeFalse();
    expect(board('Points').entries).toEqual([]);
    expect(board('Time On Ice Per Game').entries).toEqual([]);
    expect(board('Wins').entries.length).toBe(5);
    expect(board('Hits').entries.length).toBe(5);
  });

  it('should show empty boards when the standings fail, without asking for leaders', async () => {
    await open('R');
    httpMock.expectOne(standingsUrl).flush('Bad Gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();

    expect(component.isLoading).toBeFalse();
    expect(boards().length).toBe(9);
    expect(boards().every(leaderboard => leaderboard.entries.length === 0)).toBeTrue();
  });

  it('should hide the game type filters outside playoff mode', async () => {
    await open('R');
    await flushStandings();
    await flushLeaders();

    expect(fixture.nativeElement.querySelector('.stat-filters-container')).toBeNull();
  });

  it('should show the filters and the playoffs first in playoff mode', async () => {
    currentSeason.and.resolveTo({season: 20252026, isPlayoffMode: true});
    await open();

    expect(fixture.nativeElement.querySelector('.stat-filters-container')).toBeTruthy();
    expect(component.playoffsSelected).toBeTrue();
    await flushStandings();
    await flushLeaders(3);

    expect(board('Points').entries[0].name).toBe('Mitch Marner');
  });

  it('should go back to the default playoffs when the query parameter is gone, like with the back button', async () => {
    currentSeason.and.resolveTo({season: 20252026, isPlayoffMode: true});
    await open();
    await flushStandings();
    await flushLeaders(3);

    switchGameType(false);
    await flushLeaders(2);
    expect(component.playoffsSelected).toBeFalse();

    queryParams.next(convertToParamMap({}));
    fixture.detectChanges();
    await flushLeaders(3);
    expect(component.playoffsSelected).toBeTrue();
    expect(fixture.nativeElement.querySelector('.selected-filter').textContent.trim()).toBe('Playoffs');
  });

  it('should wait for playoff mode before loading the leaders', async () => {
    queryParams.next(convertToParamMap({}));
    fixture = TestBed.createComponent(StatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectNone(() => true);
    expect(component.isLoading).toBeTrue();

    await settle();
    await flushStandings();
    await flushLeaders();
    expect(component.isLoading).toBeFalse();
  });

  it('should show the regular season without filters when the season dates fail', async () => {
    currentSeason.and.rejectWith(new Error('Bad gateway'));
    await open();
    expect(component.playoffsSelected).toBeFalse();
    expect(fixture.nativeElement.querySelector('.stat-filters-container')).toBeNull();
    await flushStandings();
    await flushLeaders();
    expect(board('Points').entries.length).toBe(5);
  });
});
