import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ScoreGame, ScoreResponse } from '@shared/models/nhl-web-api/score.model';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';
import { NhlGameStateEnum } from '@shared/enums/nhl-game-state.enum';
import {
  derivedLiveGame, mockFutureGame, mockLiveScoreGame, mockOvertimeFinal, mockScoreResponse, mockShootoutFinal
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { ScoreboardComponent } from './scoreboard.component';

describe('ScoreboardComponent', () => {
  let component: ScoreboardComponent;
  let fixture: ComponentFixture<ScoreboardComponent>;
  let httpMock: HttpTestingController;

  /** Captured before the spy replaces it, so every other query still answers for the real window. */
  const realMatchMedia = window.matchMedia.bind(window);

  /** The answer the component's phone media query gets, so the label doesn't depend on the test browser's width. */
  let isPhoneWidth: boolean;

  beforeEach(async () => {
    isPhoneWidth = false;
    spyOn(window, 'matchMedia').and.callFake((query: string) =>
        query === '(max-width: 700px)' ? {matches: isPhoneWidth} as MediaQueryList : realMatchMedia(query));

    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ ScoreboardComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    // NhlGameService classifies each fetched day for its cache against the current season; none of this file's
    // fixture games are from 20262027, so nothing here is ever actually cached long-term.
    spyOn(TestBed.inject(NhlStatsApiService), 'getCurrentSeason').and.resolveTo({season: 20262027, isPlayoffMode: false});

    fixture = TestBed.createComponent(ScoreboardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  function scoreResponse(games: ScoreGame[]): ScoreResponse {
    return {...mockScoreResponse(), games};
  }

  function openDay(day: string): void {
    fixture.componentRef.setInput('selectedDayString', day);
    fixture.detectChanges();
  }

  /** Waits for pending service promises, then updates the view. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  function scorecardCount(): number {
    return fixture.nativeElement.querySelectorAll('app-scorecard').length;
  }

  /** Narrows or widens the window past the phone breakpoint, as a real window resize does. */
  function resizeTo(phone: boolean): void {
    isPhoneWidth = phone;
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
  }

  it('should load and show the games for the selected day', async () => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    await settle();
    expect(component.displayDayLabel).toBe('Sunday, March 1');
    expect(component.currentDayGames.map(game => game.id)).toEqual([2025020947, 2025020950, 2025020952]);
    expect(scorecardCount()).toBe(3);
    expect(text()).not.toContain('No Games');
  });

  it('should show live games first, keeping the API order for the rest', async () => {
    const criticalGame = mockLiveScoreGame();
    criticalGame.gameState = NhlGameStateEnum.CRITICAL;
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(scoreResponse(
        [mockOvertimeFinal(), derivedLiveGame(), mockShootoutFinal(), criticalGame, mockFutureGame()]));
    await settle();

    expect(component.currentDayGames.map(game => game.id))
        .toEqual([2025020947, 2026010001, 2025020950, 2025020952, 2026020056]);
    const shownGameIds = Array.from(fixture.nativeElement.querySelectorAll('app-scorecard'))
        .map((scorecard: any) => scorecard.game.id);
    expect(shownGameIds).toEqual([2025020947, 2026010001, 2025020950, 2025020952, 2026020056]);
  });

  it('should abbreviate the month on a phone, where the full month would wrap', async () => {
    isPhoneWidth = true;
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    await settle();
    expect(component.displayDayLabel).toBe('Sunday, Mar\u00a01');
  });

  it('should relabel the day when the window crosses the phone breakpoint', async () => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    await settle();
    expect(component.displayDayLabel).toBe('Sunday, March 1');

    resizeTo(true);
    expect(component.displayDayLabel).toBe('Sunday, Mar\u00a01');
    resizeTo(false);
    expect(component.displayDayLabel).toBe('Sunday, March 1');
  });

  it('should keep the contextual label on a phone', async () => {
    isPhoneWidth = true;
    openDay(dayjs().format('YYYYMMDD'));
    httpMock.expectOne('/api/nhl/score/' + dayjs().format('YYYY-MM-DD')).flush(scoreResponse([]));
    await settle();
    expect(component.displayDayLabel).toBe('Today');
  });

  it('should show No Games for a day without games', async () => {
    openDay('20260715');
    httpMock.expectOne('/api/nhl/score/2026-07-15').flush(scoreResponse([]));
    await settle();
    expect(scorecardCount()).toBe(0);
    expect(text()).toContain('No Games');
  });

  it('should show No Games when the request fails', async () => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01')
        .flush('Service unavailable', {status: 503, statusText: 'Service Unavailable'});
    await settle();
    expect(component.currentDayGames).toEqual([]);
    expect(text()).toContain('No Games');
  });

  it('should retry once when a day other than today fails to load', fakeAsync(() => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01')
        .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    flushMicrotasks();
    fixture.detectChanges();
    expect(text()).toContain('No Games');

    tick(3000);
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    flushMicrotasks();
    fixture.detectChanges();

    expect(component.currentDayGames.map(game => game.id)).toEqual([2025020947, 2025020950, 2025020952]);
    expect(scorecardCount()).toBe(3);
    expect(text()).not.toContain('No Games');

    fixture.destroy();
  }));

  it('should settle on No Games when the one retry fails too', fakeAsync(() => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01')
        .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    flushMicrotasks();

    tick(3000);
    httpMock.expectOne('/api/nhl/score/2026-03-01')
        .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    flushMicrotasks();
    fixture.detectChanges();

    // The retry is one shot, so nothing keeps asking
    tick(30000);
    httpMock.expectNone('/api/nhl/score/2026-03-01');
    expect(component.currentDayGames).toEqual([]);
    expect(text()).toContain('No Games');

    fixture.destroy();
  }));

  it("should leave today's failed load to the refresh instead of retrying", fakeAsync(() => {
    const todayUrl = '/api/nhl/score/' + dayjs().format('YYYY-MM-DD');
    openDay(dayjs().format('YYYYMMDD'));
    httpMock.expectOne(todayUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    flushMicrotasks();

    tick(3000);
    httpMock.expectNone(todayUrl);

    tick(7000);
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame()]));
    flushMicrotasks();
    fixture.detectChanges();
    expect(scorecardCount()).toBe(1);

    fixture.destroy();
  }));

  it('should drop a pending retry when the day changes', fakeAsync(() => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01')
        .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    flushMicrotasks();

    component.shiftDateRight();
    httpMock.expectOne('/api/nhl/score/2026-03-02').flush(scoreResponse([]));
    flushMicrotasks();

    tick(30000);
    httpMock.expectNone('/api/nhl/score/2026-03-01');
    expect(component.displayDayLabel).toBe('Monday, March 2');

    fixture.destroy();
  }));

  it('should load the previous and next day when the date is shifted', async () => {
    const emittedDays: string[] = [];
    component.selectedDayChange.subscribe(day => emittedDays.push(dayjs(day).format('YYYY-MM-DD')));
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());

    component.shiftDateRight();
    httpMock.expectOne('/api/nhl/score/2026-03-02').flush(scoreResponse([]));
    component.shiftDateLeft();
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    component.shiftDateLeft();
    httpMock.expectOne('/api/nhl/score/2026-02-28').flush(scoreResponse([]));
    await settle();

    // The day given by the page isn't output, only the days the user picks
    expect(emittedDays).toEqual(['2026-03-02', '2026-03-01', '2026-02-28']);
    expect(component.displayDayLabel).toBe('Saturday, February 28');
    expect(component.currentDayGames).toEqual([]);
  });

  it('should show the day the page gives when it changes, like with the browser back button', async () => {
    const emittedDays: Date[] = [];
    component.selectedDayChange.subscribe(day => emittedDays.push(day));
    openDay('20260302');
    httpMock.expectOne('/api/nhl/score/2026-03-02').flush(scoreResponse([]));
    await settle();

    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    await settle();

    expect(component.displayDayLabel).toBe('Sunday, March 1');
    expect(scorecardCount()).toBe(3);
    expect(emittedDays).toEqual([]);
  });

  it('should not reload when the page gives back the day the user just picked', async () => {
    component.selectedDayChange.subscribe(day => fixture.componentRef.setInput('selectedDayString',
        dayjs(day).format('YYYYMMDD')));
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());

    component.shiftDateRight();
    fixture.detectChanges();
    httpMock.expectOne('/api/nhl/score/2026-03-02').flush(scoreResponse([]));
    await settle();
    expect(component.displayDayLabel).toBe('Monday, March 2');
  });

  it('should ignore a late response for a day that was left', async () => {
    openDay('20260301');
    const firstDay = httpMock.expectOne('/api/nhl/score/2026-03-01');
    component.shiftDateRight();
    httpMock.expectOne('/api/nhl/score/2026-03-02').flush(scoreResponse([]));
    await settle();
    firstDay.flush(mockScoreResponse());
    await settle();
    expect(component.currentDayGames).toEqual([]);
  });

  it('should keep one refresh timer when today is picked again', fakeAsync(() => {
    const todayUrl = '/api/nhl/score/' + dayjs().format('YYYY-MM-DD');
    openDay(dayjs().format('YYYYMMDD'));
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame()]));
    component.onDateSelect({value: new Date()});
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame()]));
    flushMicrotasks();
    tick(10000);
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame()]));
    flushMicrotasks();
    fixture.destroy();
  }));

  it('should not refresh games for a day other than today', fakeAsync(() => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    flushMicrotasks();
    tick(30000);
    httpMock.expectNone('/api/nhl/score/2026-03-01');
  }));

  it("should refresh today's games every 10 seconds, updating the shown games in place", fakeAsync(() => {
    const todayUrl = '/api/nhl/score/' + dayjs().format('YYYY-MM-DD');
    openDay(dayjs().format('YYYYMMDD'));
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame()]));
    flushMicrotasks();
    expect(component.displayDayLabel).toBe('Today');
    const shownGame = component.currentDayGames[0];

    const update = derivedLiveGame();
    update.homeTeam.score = 6;
    update.periodDescriptor.number = 3;
    update.clock.timeRemaining = '12:10';
    tick(10000);
    httpMock.expectOne(todayUrl).flush(scoreResponse([update]));
    flushMicrotasks();

    // The same game keeps its object, so its scorecard isn't rebuilt
    expect(component.currentDayGames.length).toBe(1);
    expect(component.currentDayGames[0]).toBe(shownGame);
    expect(shownGame.homeTeam.score).toBe(6);
    expect(shownGame.periodDescriptor.number).toBe(3);
    expect(shownGame.clock.timeRemaining).toBe('12:10');

    fixture.destroy();
    tick(10000);
    httpMock.expectNone(todayUrl);
  }));

  it('should show games a refresh adds to the day', fakeAsync(() => {
    const todayUrl = '/api/nhl/score/' + dayjs().format('YYYY-MM-DD');
    openDay(dayjs().format('YYYYMMDD'));
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame()]));
    flushMicrotasks();
    expect(component.currentDayGames.length).toBe(1);

    tick(10000);
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame(), mockOvertimeFinal()]));
    flushMicrotasks();
    fixture.detectChanges();

    expect(component.currentDayGames.map(game => game.id))
        .toEqual([derivedLiveGame().id, mockOvertimeFinal().id]);
    expect(scorecardCount()).toBe(2);

    fixture.destroy();
  }));

  it('should move a game to the top when a refresh finds it live', fakeAsync(() => {
    const todayUrl = '/api/nhl/score/' + dayjs().format('YYYY-MM-DD');
    openDay(dayjs().format('YYYYMMDD'));
    httpMock.expectOne(todayUrl).flush(scoreResponse([mockOvertimeFinal(), mockFutureGame()]));
    flushMicrotasks();
    expect(component.currentDayGames.map(game => game.id)).toEqual([2025020950, 2026020056]);

    const startedGame = mockFutureGame();
    startedGame.gameState = NhlGameStateEnum.LIVE;
    tick(10000);
    httpMock.expectOne(todayUrl).flush(scoreResponse([mockOvertimeFinal(), startedGame]));
    flushMicrotasks();
    fixture.detectChanges();

    expect(component.currentDayGames.map(game => game.id)).toEqual([2026020056, 2025020950]);
    expect(component.currentDayGames[0].gameState).toBe(NhlGameStateEnum.LIVE);
    expect(scorecardCount()).toBe(2);

    fixture.destroy();
  }));

  it('should show the games a refresh brings back after the first load failed', fakeAsync(() => {
    const todayUrl = '/api/nhl/score/' + dayjs().format('YYYY-MM-DD');
    openDay(dayjs().format('YYYYMMDD'));
    // The backend 502s when the NHL API times out; the day must not stay empty until the page is reloaded
    httpMock.expectOne(todayUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    flushMicrotasks();
    fixture.detectChanges();
    expect(component.currentDayGames).toEqual([]);
    expect(text()).toContain('No Games');

    tick(10000);
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame(), mockOvertimeFinal()]));
    flushMicrotasks();
    fixture.detectChanges();

    expect(component.currentDayGames.length).toBe(2);
    expect(scorecardCount()).toBe(2);
    expect(text()).not.toContain('No Games');

    fixture.destroy();
  }));

  it('should clear the shown games when a refresh returns a day without games', fakeAsync(() => {
    const todayUrl = '/api/nhl/score/' + dayjs().format('YYYY-MM-DD');
    openDay(dayjs().format('YYYYMMDD'));
    httpMock.expectOne(todayUrl).flush(scoreResponse([derivedLiveGame()]));
    flushMicrotasks();

    tick(10000);
    httpMock.expectOne(todayUrl).flush(scoreResponse([]));
    flushMicrotasks();
    fixture.detectChanges();

    expect(component.currentDayGames).toEqual([]);
    expect(text()).toContain('No Games');

    fixture.destroy();
  }));
});
