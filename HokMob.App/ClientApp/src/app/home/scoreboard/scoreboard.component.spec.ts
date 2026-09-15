import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ScoreGame, ScoreResponse } from '@shared/models/nhl-web-api/score.model';
import { derivedLiveGame, mockOvertimeFinal, mockScoreResponse } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { ScoreboardComponent } from './scoreboard.component';

describe('ScoreboardComponent', () => {
  let component: ScoreboardComponent;
  let fixture: ComponentFixture<ScoreboardComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ ScoreboardComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

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

  it('should load and show the games for the selected day', async () => {
    openDay('20260301');
    httpMock.expectOne('/api/nhl/score/2026-03-01').flush(mockScoreResponse());
    await settle();
    expect(component.displayDayLabel).toBe('Sunday, March 1');
    expect(component.currentDayGames.map(game => game.id)).toEqual([2025020947, 2025020950, 2025020952]);
    expect(scorecardCount()).toBe(3);
    expect(text()).not.toContain('No Games');
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

    expect(emittedDays).toEqual(['2026-03-01', '2026-03-02', '2026-03-01', '2026-02-28']);
    expect(component.displayDayLabel).toBe('Saturday, February 28');
    expect(component.currentDayGames).toEqual([]);
  });

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
    // Games that weren't shown before aren't added by the refresh
    httpMock.expectOne(todayUrl).flush(scoreResponse([update, mockOvertimeFinal()]));
    flushMicrotasks();

    expect(component.currentDayGames.length).toBe(1);
    expect(component.currentDayGames[0]).toBe(shownGame);
    expect(shownGame.homeTeam.score).toBe(6);
    expect(shownGame.periodDescriptor.number).toBe(3);
    expect(shownGame.clock.timeRemaining).toBe('12:10');

    fixture.destroy();
    tick(10000);
    httpMock.expectNone(todayUrl);
  }));
});
