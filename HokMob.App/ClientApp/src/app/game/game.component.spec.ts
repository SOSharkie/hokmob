import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GameBundle } from '@shared/models/nhl-web-api/game-bundle.model';
import { NhlGameStateEnum } from '@shared/enums/nhl-game-state.enum';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { RouterExtensionService } from '@shared/services/router-extension.service';
import {
  derivedIntermissionLanding,
  derivedLiveLanding,
  mockGameBundle,
  mockGameLanding,
  mockPlayoffScoreResponse
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { GameComponent } from './game.component';

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;
  let httpMock: HttpTestingController;
  let routeParams: BehaviorSubject<Params>;

  const endpoints: [string, keyof GameBundle][] =
      [['landing', 'landing'], ['play-by-play', 'playByPlay'], ['boxscore', 'boxscore'], ['right-rail', 'rightRail']];

  beforeEach(async () => {
    routeParams = new BehaviorSubject<Params>({});
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GameComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {params: routeParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  function open(gameId: string): void {
    routeParams.next({id: gameId});
    fixture = TestBed.createComponent(GameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Answers the gamecenter requests with the bundle's responses, and with a server error for missing ones. */
  function flushBundle(gameId: string, bundle: Partial<GameBundle>): void {
    endpoints.forEach(([path, key]) => {
      const request = httpMock.expectOne(`/api/nhl/gamecenter/${gameId}/${path}`);
      if (bundle[key]) {
        request.flush(bundle[key]);
      } else {
        request.flush('Server error', {status: 500, statusText: 'Internal Server Error'});
      }
    });
  }

  /** Waits for pending service promises, then updates the view. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Updates the view after flushed responses in a fakeAsync test. */
  function settleFakeAsync(): void {
    flushMicrotasks();
    fixture.detectChanges();
  }

  function element(selector: string): any {
    return fixture.nativeElement.querySelector(selector);
  }

  /** The normalized text of the first element matching the selector, or undefined if there is none. */
  function text(selector: string): string {
    return element(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should load a real regulation game and show its header and game info', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();

    const landing = mockGameLanding(2025021057);
    expect(text('.league-info-label')).toBe('NHL Regular Season');
    expect(text('.info-label')).toBe('TV: NHLN');
    expect(text('.game-venue-container')).toContain('Canada Life Centre');
    expect(text('.game-date-time')).toContain(dayjs(landing.startTimeUTC).format('MMMM D, YYYY, h:mm A'));
    expect(element('.stream-link').getAttribute('href')).toBe('https://720pstream.nu/nhl/live-winnipeg-jets-stream');
    expect(text('.games-label')).toBe('Games');
    expect(text('.game-load-error')).toBeUndefined();
    expect(component.leagueRouterLink).toBe('/standings');

    const headers = fixture.nativeElement.querySelectorAll('app-game-header');
    expect(headers.length).toBe(2);
    expect(headers[0].isDropdownHeader).toBeTrue();
    expect(headers[1].isDropdownHeader).toBeFalse();
    expect(headers[1].landing.id).toBe(2025021057);
    expect(headers[1].homeTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(landing.homeTeam.id));
    expect(headers[1].awayTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(landing.awayTeam.id));
    expect(headers[1].isIntermission).toBeFalse();
  });

  it('should pass the scoring summary to the goal scorers', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    const scoring = element('app-goal-scorers').scoring;
    expect(scoring.map(period => period.goals.length)).toEqual([2, 0, 3]);
  });

  it('should pass the play-by-play to the momentum chart and event timelines', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    expect(element('app-momentum').playByPlay.plays.length).toBe(270);

    // One timeline in the main column for mobile, one beside it for desktop
    const timelines = fixture.nativeElement.querySelectorAll('app-mini-event-timeline');
    expect(timelines.length).toBe(2);
    timelines.forEach((timeline: any) => expect(timeline.playByPlay.id).toBe(2025021057));
    expect(element('.side-game app-mini-event-timeline').homeTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    expect(element('.side-game app-mini-event-timeline').awayTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(19));
  });

  it('should open the player dialog for a player clicked in an event timeline', async () => {
    const openDialog = spyOn(GameComponent.prototype, 'openPlayerGameDialog');
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    fixture.debugElement.query(By.css('.side-game app-mini-event-timeline')).triggerEventHandler('playerClicked', 8478398);
    expect(openDialog).toHaveBeenCalledWith(8478398);
  });

  it('should keep the boxscore and right-rail but hide the sections not migrated yet', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    expect(component.boxscore.id).toBe(2025021057);
    expect(component.rightRail.teamGameStats.length).toBeGreaterThan(0);
    expect(component.showTopPlayers).toBeTrue();
    ['app-game-top-players', 'app-game-stats', 'app-team-form']
        .forEach(selector => expect(element(selector)).withContext(selector).toBeNull());
  });

  it('should not load a series status or poll a finished game', fakeAsync(() => {
    open('2025020952');
    flushBundle('2025020952', mockGameBundle(2025020952));
    settleFakeAsync();
    expect(text('.game-venue-container')).toContain('Honda Center');
    tick(30000);
    httpMock.expectNone(() => true);
  }));

  it('should load the series status of a real playoff game', async () => {
    open('2025030414');
    flushBundle('2025030414', mockGameBundle(2025030414));
    await settle();
    expect(text('.league-info-label')).toBe('NHL Playoffs');
    expect(component.leagueRouterLink).toBe('/playoffs');

    httpMock.expectOne('/api/nhl/score/2026-06-09').flush(mockPlayoffScoreResponse());
    await settle();
    expect(text('.league-info-label')).toBe('Stanley Cup Final: Tied 2-2');
    expect(text('.info-label')).toBe('TV: ABC');
    expect(element('.game-header app-game-header').seriesStatus)
        .toEqual(jasmine.objectContaining({seriesLetter: 'O', gameNumberOfSeries: 4}));
  });

  it('should keep the playoff label without a series status when the score request fails', async () => {
    open('2025030414');
    flushBundle('2025030414', mockGameBundle(2025030414));
    await settle();
    httpMock.expectOne('/api/nhl/score/2026-06-09').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();
    expect(text('.league-info-label')).toBe('NHL Playoffs');
    expect(component.seriesStatus).toBeUndefined();
  });

  it('should show the game when the optional gamecenter requests fail', async () => {
    open('2025020952');
    flushBundle('2025020952', {landing: mockGameLanding(2025020952)});
    await settle();
    expect(element('.game-header')).not.toBeNull();
    expect(text('.game-venue-container')).toContain('Honda Center');
    expect(element('app-goal-scorers')).not.toBeNull();
    expect(component.playByPlay).toBeUndefined();
    expect(component.boxscore).toBeUndefined();
    expect(text('.game-load-error')).toBeUndefined();
    expect(element('app-momentum')).toBeNull();
    expect(element('app-mini-event-timeline')).toBeNull();
  });

  it('should show an error instead of the game when the landing fails', async () => {
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: undefined});
    await settle();
    expect(text('.game-load-error')).toBe("This game couldn't be loaded.");
    expect(element('.game-header')).toBeNull();
    expect(component.landing).toBeUndefined();
  });

  it('should not show goal scorers for a real future game', async () => {
    open('2026020056');
    flushBundle('2026020056', mockGameBundle(2026020056));
    await settle();
    expect(text('.info-label')).toBe('TV: NESN');
    expect(text('.game-venue-container')).toContain('TD Garden');
    expect(element('app-goal-scorers')).toBeNull();
    expect(component.showTopPlayers).toBeFalse();
    expect(element('app-momentum')).toBeNull();
    expect(element('app-mini-event-timeline')).toBeNull();
  });

  it('should refresh a future game scheduled today', fakeAsync(() => {
    const bundle = mockGameBundle(2026020056);
    bundle.landing.startTimeUTC = dayjs().toISOString();
    open('2026020056');
    flushBundle('2026020056', bundle);
    settleFakeAsync();
    tick(10000);
    flushBundle('2026020056', bundle);
    settleFakeAsync();
    fixture.destroy();
    tick(10000);
    httpMock.expectNone('/api/nhl/gamecenter/2026020056/landing');
  }));

  it('should refresh a live game every 10 seconds and stop once it is over', fakeAsync(() => {
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: derivedLiveLanding()});
    settleFakeAsync();
    expect(component.liveGame).toBeTrue();
    expect(element('app-goal-scorers').scoring.length).toBe(2);

    // A refresh with a failed play-by-play request keeps the last play-by-play
    const update = derivedLiveLanding();
    update.homeTeam.score = 3;
    tick(10000);
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: update, playByPlay: undefined});
    settleFakeAsync();
    expect(element('.game-header app-game-header').landing.homeTeam.score).toBe(3);
    expect(component.playByPlay.plays.length).toBe(270);

    tick(10000);
    flushBundle('2025021057', mockGameBundle(2025021057));
    settleFakeAsync();
    expect(component.completedGame).toBeTrue();
    expect(element('app-goal-scorers').scoring.length).toBe(3);

    tick(30000);
    httpMock.expectNone('/api/nhl/gamecenter/2025021057/landing');
  }));

  it('should keep the shown game when a refresh fails', fakeAsync(() => {
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: derivedLiveLanding()});
    settleFakeAsync();

    tick(10000);
    flushBundle('2025021057', {});
    settleFakeAsync();
    expect(component.landing.gameState).toBe(NhlGameStateEnum.LIVE);
    expect(element('.game-header')).not.toBeNull();
    expect(text('.game-load-error')).toBeUndefined();

    fixture.destroy();
    tick(10000);
    httpMock.expectNone('/api/nhl/gamecenter/2025021057/landing');
  }));

  it('should count down an intermission between refreshes', fakeAsync(() => {
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: derivedIntermissionLanding()});
    settleFakeAsync();
    expect(component.isIntermission).toBeTrue();
    expect(component.intermissionTimeRemaining).toBe('16:40 till 2nd');
    expect(element('.game-header app-game-header').intermissionTimeRemaining).toBe('16:40 till 2nd');

    tick(1000);
    fixture.detectChanges();
    expect(component.intermissionTimeRemaining).toBe('16:39 till 2nd');

    // The next refresh is back in play, in the 2nd period
    tick(9000);
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: derivedLiveLanding()});
    settleFakeAsync();
    expect(component.isIntermission).toBeFalse();
    expect(component.intermissionTimeRemaining).toBe('');

    fixture.destroy();
  }));

  it('should load the new game when the route changes', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();

    routeParams.next({id: '2025020952'});
    fixture.detectChanges();
    flushBundle('2025020952', mockGameBundle(2025020952));
    await settle();
    expect(element('.game-header app-game-header').landing.id).toBe(2025020952);
    expect(text('.game-venue-container')).toContain('Honda Center');
  });

  it('should ignore a late response for the previous game', async () => {
    open('2025021057');
    routeParams.next({id: '2025020952'});
    flushBundle('2025020952', mockGameBundle(2025020952));
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    expect(component.landing.id).toBe(2025020952);
  });

  it('should go back to the games of the game day without a previous page', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();

    component.backToPrevious();
    const date = dayjs(mockGameLanding(2025021057).startTimeUTC).format('YYYYMMDD');
    expect(navigate).toHaveBeenCalledWith([''], jasmine.objectContaining({queryParams: {date}}));
  });

  it('should go back to the previous page when there is one', async () => {
    spyOn(TestBed.inject(RouterExtensionService), 'getPreviousUrl').and.returnValue('/playoffs');
    const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    open('2025030414');
    flushBundle('2025030414', mockGameBundle(2025030414));
    await settle();
    httpMock.expectOne('/api/nhl/score/2026-06-09').flush(mockPlayoffScoreResponse());
    await settle();

    expect(text('.games-label')).toBe('Playoffs');
    component.backToPrevious();
    expect(navigateByUrl).toHaveBeenCalledWith('/playoffs');
  });
});
