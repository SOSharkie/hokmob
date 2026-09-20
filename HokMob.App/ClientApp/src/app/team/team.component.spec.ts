import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Location } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { RouterExtensionService } from '@shared/services/router-extension.service';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';
import { ClubScheduleSeason } from '@shared/models/nhl-web-api/club-schedule.model';
import { NhlGameStateEnum } from '@shared/enums/nhl-game-state.enum';
import {
  mockClubScheduleSeason,
  mockStandingsResponse,
  mockTeamStats
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamComponent } from './team.component';

describe('TeamComponent', () => {
  let component: TeamComponent;
  let fixture: ComponentFixture<TeamComponent>;
  let httpMock: HttpTestingController;
  let routeParams: BehaviorSubject<Params>;

  const standingsUrl = '/api/nhl/standings/now';
  const scheduleUrl = '/api/nhl/club-schedule-season/';
  const teamStatsUrl = '/api/nhl-stats/teams?season=20252026&gameType=2';

  // Boston's next game in the fixture is on 2026-09-20 and the page loads live details for a game today, so the day
  // these tests run on has to be pinned well clear of it: CI runs on UTC and reaches that day before a dev machine
  // does. jasmine.clock(), which team-next-game.component.spec.ts uses, would also stop the timers settle() waits on,
  // so only the date is pinned here.
  const pinnedNow = new Date(2026, 8, 15).getTime();
  const RealDate = Date;

  beforeAll(() => {
    (window as any).Date = class extends RealDate {
      constructor(...args: any[]) {
        super(...(args.length ? args : [pinnedNow]) as [number]);
      }

      public static override now(): number {
        return pinnedNow;
      }
    };
  });

  afterAll(() => {
    (window as any).Date = RealDate;
  });

  beforeEach(async () => {
    routeParams = new BehaviorSubject<Params>({});
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {params: routeParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    // NhlGameService classifies each fetched day for its cache against the current season; the next game update
    // always fetches today, which is never cached, so the value here doesn't otherwise affect these tests.
    spyOn(TestBed.inject(NhlStatsApiService), 'getCurrentSeason').and.resolveTo({season: 20252026, isPlayoffMode: false});
    spyOn(console, 'error');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  function open(teamId: string): void {
    routeParams.next({id: teamId});
    fixture = TestBed.createComponent(TeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Waits for the component's promises to settle and renders the result. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Answers the standings, schedule and team stats requests of a team page with the real responses. */
  async function flushTeamPage(teamAbbrev: string, schedule?: ClubScheduleSeason): Promise<void> {
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    httpMock.expectOne(scheduleUrl + teamAbbrev + '/now')
        .flush(schedule ?? mockClubScheduleSeason(teamAbbrev as any, 20262027));
    await settle();
    httpMock.expectOne(teamStatsUrl).flush(mockTeamStats());
    // The 2026-27 schedule has no finished games, so the form falls back to the previous season
    const formRequests = httpMock.match(scheduleUrl + teamAbbrev + '/20252026');
    formRequests.forEach(request => request.flush(mockClubScheduleSeason(teamAbbrev as any, 20252026)));
    await settle();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function child(selector: string): any {
    return fixture.nativeElement.querySelector(selector);
  }

  it('should show the team name right away, before anything is loaded', async () => {
    open('6');
    expect(text('.team-name')).toBe('Boston Bruins');
    expect(component.teamColor).toBe('#FFB81C');
    expect(child('.team-division')).toBeNull();
    expect(child('app-standings')).toBeNull();
    expect(child('app-team-next-game')).toBeNull();
    await flushTeamPage('BOS');
    expect(text('.team-division-label')).toBe('Atlantic Division');
  });

  it('should show the real division, conference standings and stats of a team', async () => {
    open('6');
    await flushTeamPage('BOS');

    expect(text('.team-division-label')).toBe('Atlantic Division');
    expect(component.standings.length).toBe(1);
    expect(component.standings[0].title).toBe('Eastern Conference');
    expect(child('app-standings').selectedTeamId).toBe(6);
    expect(child('app-team-stats').teamId).toBe(6);
    expect(child('app-team-stats').teamStats.length).toBe(32);
  });

  it('should show the next games, next game and form from one schedule response', async () => {
    open('6');
    await flushTeamPage('BOS');

    expect(child('app-team-schedule').games.map(game => game.id))
        .toEqual([2026010013, 2026010028, 2026010040, 2026010049, 2026020003]);
    expect(child('app-team-next-game').game.id).toBe(2026010013);
    expect(child('app-team-next-game').game.homeTeam.abbrev).toBe('BOS');
    expect(child('app-single-team-form').teamId).toBe(6);
    expect(child('app-single-team-form').games.map(game => game.id))
        .toEqual([2025030116, 2025030115, 2025030114, 2025030113, 2025030112]);
  });

  it('should load a live next game from the score response and refresh it every 10 seconds', fakeAsync(() => {
    const schedule = mockClubScheduleSeason('BOS', 20262027);
    const liveGame = schedule.games[0];
    liveGame.gameState = NhlGameStateEnum.LIVE;
    const gameDate = dayjs(liveGame.startTimeUTC).format('YYYY-MM-DD');

    open('6');
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    httpMock.expectOne(scheduleUrl + 'BOS/now').flush(schedule);
    flushMicrotasks();
    httpMock.expectOne(teamStatsUrl).flush(mockTeamStats());
    httpMock.match(scheduleUrl + 'BOS/20252026')
        .forEach(request => request.flush(mockClubScheduleSeason('BOS', 20252026)));
    httpMock.expectOne('/api/nhl/score/' + gameDate).flush({games: [{...liveGame, homeTeam: {id: 6, abbrev: 'BOS', name: {default: 'Bruins'}, score: 2}, awayTeam: {id: 15, abbrev: 'WSH', name: {default: 'Capitals'}, score: 1}, clock: {timeRemaining: '05:32', secondsRemaining: 332, running: true, inIntermission: false}}]});
    flushMicrotasks();
    fixture.detectChanges();
    expect(child('app-team-next-game').game.homeTeam.score).toBe(2);

    tick(10000);
    httpMock.expectOne('/api/nhl/score/' + gameDate).flush({games: [{...liveGame, homeTeam: {id: 6, abbrev: 'BOS', name: {default: 'Bruins'}, score: 3}, awayTeam: {id: 15, abbrev: 'WSH', name: {default: 'Capitals'}, score: 1}}]});
    flushMicrotasks();
    fixture.detectChanges();
    expect(child('app-team-next-game').game.homeTeam.score).toBe(3);

    // The component clears its timer on destroy, which afterEach does outside the fake zone
    component.ngOnDestroy();
  }));

  it('should not load live details for a game that is days away', async () => {
    open('6');
    await flushTeamPage('BOS');
    expect(component.nextGame.gameState).toBe(NhlGameStateEnum.FUTURE);
    // No score request: httpMock.verify() in afterEach fails if one was made
  });

  it('should show a former team without standings, stats or games', async () => {
    open('53');
    expect(text('.team-name')).toBe('Arizona Coyotes');
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    httpMock.expectOne(scheduleUrl + 'ARI/now').flush({currentSeason: 20262027, games: []});
    await settle();

    expect(component.divisionName).toBe('');
    expect(component.standings).toEqual([]);
    expect(child('app-standings')).toBeNull();
    expect(child('app-team-stats').teamStats).toEqual([]);
    expect(child('app-team-next-game')).toBeNull();
    expect(child('app-single-team-form').games).toEqual([]);
    expect(child('app-team-schedule').games).toEqual([]);
  });

  it('should show "Team not found" for an unknown team, without any request', () => {
    open('999');
    expect(text('.team-name')).toBe('Team not found');
    expect(child('.team-data-container')).toBeNull();
  });

  it('should keep the page working when the standings fail', async () => {
    open('6');
    httpMock.expectOne(standingsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    httpMock.expectOne(scheduleUrl + 'BOS/now').flush(mockClubScheduleSeason('BOS', 20262027));
    await settle();
    httpMock.match(scheduleUrl + 'BOS/20252026')
        .forEach(request => request.flush(mockClubScheduleSeason('BOS', 20252026)));
    await settle();

    expect(console.error).toHaveBeenCalled();
    expect(component.standings).toEqual([]);
    expect(component.teamStats).toEqual([]);
    expect(child('app-team-next-game').game.id).toBe(2026010013);
  });

  it('should show empty games sections when the schedule fails', async () => {
    open('6');
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    httpMock.expectOne(scheduleUrl + 'BOS/now').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();
    httpMock.expectOne(teamStatsUrl).flush(mockTeamStats());
    await settle();

    expect(console.error).toHaveBeenCalled();
    expect(child('app-team-next-game')).toBeNull();
    expect(child('app-single-team-form').games).toEqual([]);
    expect(child('app-team-schedule').games).toEqual([]);
    expect(child('app-team-stats').teamStats.length).toBe(32);
  });

  it('should show no stats card when the team stats fail', async () => {
    open('6');
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    httpMock.expectOne(scheduleUrl + 'BOS/now').flush(mockClubScheduleSeason('BOS', 20262027));
    await settle();
    httpMock.expectOne(teamStatsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    httpMock.match(scheduleUrl + 'BOS/20252026')
        .forEach(request => request.flush(mockClubScheduleSeason('BOS', 20252026)));
    await settle();

    expect(console.error).toHaveBeenCalled();
    expect(child('app-team-stats').teamStats).toEqual([]);
  });

  it('should go back in the browser history, labeled with the previous page', async () => {
    spyOn(TestBed.inject(RouterExtensionService), 'getPreviousUrl').and.returnValue('/game/2025021057');
    const back = spyOn(TestBed.inject(Location), 'back');
    open('999');
    expect(text('.games-label')).toBe('Game');
    component.backToPrevious();
    expect(back).toHaveBeenCalled();
  });

  it("should go to today's games without a previous page", () => {
    const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    open('999');
    expect(text('.games-label')).toBe('Games');
    component.backToPrevious();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('should load the new team when the route changes', async () => {
    open('6');
    await flushTeamPage('BOS');
    expect(text('.team-name')).toBe('Boston Bruins');

    routeParams.next({id: '68'});
    fixture.detectChanges();
    expect(text('.team-name')).toBe('Utah Mammoth');
    expect(component.standings).toBeUndefined();
    await flushTeamPage('UTA');

    expect(text('.team-division-label')).toBe('Central Division');
    expect(component.standings[0].title).toBe('Western Conference');
    expect(child('app-single-team-form').teamId).toBe(68);
  });
});
