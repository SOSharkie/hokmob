import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Params, Router } from '@angular/router';
import { Location } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { registerLucideIcons } from '@shared/icons/lucide-icons';
import { BehaviorSubject } from 'rxjs';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { RouterExtensionService } from '@shared/services/router-extension.service';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';
import { ClubScheduleSeason } from '@shared/models/nhl-web-api/club-schedule.model';
import { NhlGameStateEnum } from '@shared/enums/nhl-game-state.enum';
import { NhlStandingsTypeEnum } from '@shared/enums/nhl-standings-type.enum';
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
  let queryParams: BehaviorSubject<ParamMap>;
  /** The page's URL with its query, which the test Location (SpyLocation) leaves out of path() unlike the browser's. */
  let currentUrl: string;
  let replaceState: jasmine.Spy;

  const standingsUrl = '/api/nhl/standings/now';
  const scheduleUrl = '/api/nhl/club-schedule-season/';
  const teamStatsUrl = '/api/nhl-stats/teams?season=20252026&gameType=2';

  beforeEach(async () => {
    routeParams = new BehaviorSubject<Params>({});
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {params: routeParams, queryParamMap: queryParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    registerLucideIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
    // NhlGameService classifies each fetched day for its cache against the current season; the next game update
    // always fetches today, which is never cached, so the value here doesn't otherwise affect these tests.
    spyOn(TestBed.inject(NhlStatsApiService), 'getCurrentSeason').and.resolveTo({season: 20252026, isPlayoffMode: false});
    spyOn(console, 'error');
    currentUrl = '';
    const location = TestBed.inject(Location);
    replaceState = spyOn(location, 'replaceState').and.callFake((path: string, query?: string) => {
      currentUrl = path + (query ? '?' + query : '');
    });
    spyOn(location, 'path').and.callFake(() => currentUrl);
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  /** Opens a team's page, with the query parameters of its URL (like a tab), as a link or a reload does. */
  function open(teamId: string, params: Params = {}): void {
    TestBed.inject(Location).replaceState('/team/' + teamId, new URLSearchParams(params).toString());
    routeParams.next({id: teamId});
    queryParams.next(convertToParamMap(params));
    fixture = TestBed.createComponent(TeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Waits for the component's promises to settle and renders the result. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /**
   * The real 2026-27 schedule with every game moved by the same number of days, so the next game is five days from
   * today whenever the tests run. The fixture's first game is on 2026-09-20, and the page loads live details for a
   * game today, so on that day the tests left an unanswered score request; CI runs on UTC and reaches a day before a
   * dev machine does.
   */
  function upcomingSchedule(teamAbbrev: string): ClubScheduleSeason {
    const schedule = mockClubScheduleSeason(teamAbbrev as any, 20262027);
    const days = dayjs().add(5, 'day').startOf('day').diff(dayjs(schedule.games[0].startTimeUTC).startOf('day'), 'day');
    schedule.games.forEach(game => {
      game.startTimeUTC = dayjs(game.startTimeUTC).add(days, 'day').toISOString();
      game.gameDate = dayjs(game.gameDate).add(days, 'day').format('YYYY-MM-DD');
    });
    return schedule;
  }

  /** Answers the standings, schedule and team stats requests of a team page with the real responses. */
  async function flushTeamPage(teamAbbrev: string, schedule?: ClubScheduleSeason): Promise<void> {
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    httpMock.expectOne(scheduleUrl + teamAbbrev + '/now')
        .flush(schedule ?? upcomingSchedule(teamAbbrev));
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
    httpMock.expectOne(scheduleUrl + 'BOS/now').flush(upcomingSchedule('BOS'));
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
    httpMock.expectOne(scheduleUrl + 'BOS/now').flush(upcomingSchedule('BOS'));
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
    const backButton: HTMLElement = fixture.nativeElement.querySelector('.games-back-button');
    expect(backButton.tagName).toBe('BUTTON');
    backButton.click();
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

  describe('tabs', () => {
    function tabs(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('.team-tab'));
    }

    function tab(label: string): HTMLButtonElement {
      return tabs().find(button => button.textContent.trim() === label);
    }

    function selectedTabLabel(): string {
      return text('.team-tab.selected-tab');
    }

    function path(): string {
      return TestBed.inject(Location).path();
    }

    function pressKey(button: HTMLElement, key: string): void {
      button.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
      fixture.detectChanges();
    }

    it('should show the five tabs, on the overview by default', async () => {
      open('6');
      await flushTeamPage('BOS');
      expect(tabs().map(button => button.textContent.trim()))
          .toEqual(['Overview', 'Standings', 'Player Stats', 'Team Stats', 'Games']);
      expect(selectedTabLabel()).toBe('Overview');
      expect(tab('Overview').getAttribute('aria-selected')).toBe('true');
      expect(tab('Overview').tabIndex).toBe(0);
      expect(tab('Games').getAttribute('aria-selected')).toBe('false');
      expect(tab('Games').tabIndex).toBe(-1);
      expect(child('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe('team-tab-overview');
      expect(child('.overview-tab app-standings')).not.toBeNull();
    });

    it('should have no tabs for an unknown team', () => {
      open('999');
      expect(tabs().length).toBe(0);
      expect(child('[role="tabpanel"]')).toBeNull();
    });

    it('should open the tab of the URL', async () => {
      open('6', {tab: 'games'});
      await flushTeamPage('BOS');
      expect(selectedTabLabel()).toBe('Games');
      expect(child('.overview-tab')).toBeNull();
      expect(child('.games-tab app-team-next-game').game.id).toBe(2026010013);
      expect(child('.games-tab app-team-schedule').games.length).toBe(5);
      expect(child('.games-tab app-single-team-form').games.map(game => game.id))
          .toEqual([2025030116, 2025030115, 2025030114, 2025030113, 2025030112]);
    });

    it('should open the overview for an unknown tab', async () => {
      open('6', {tab: 'roster'});
      await flushTeamPage('BOS');
      expect(selectedTabLabel()).toBe('Overview');
    });

    it('should save a picked tab in the URL, and leave the overview out of it', async () => {
      open('6');
      await flushTeamPage('BOS');
      replaceState.calls.reset();

      tab('Team Stats').click();
      fixture.detectChanges();
      expect(path()).toBe('/team/6?tab=team-stats');
      expect(child('.team-stats-tab app-team-stats').teamStats.length).toBe(32);

      tab('Overview').click();
      fixture.detectChanges();
      expect(path()).toBe('/team/6');
      expect(replaceState).toHaveBeenCalledTimes(2);
    });

    it('should keep the URL\'s other query parameters', async () => {
      open('6', {tab: 'games', utm_source: 'share'});
      await flushTeamPage('BOS');
      tab('Overview').click();
      expect(path()).toBe('/team/6?utm_source=share');
      tab('Player Stats').click();
      expect(path()).toBe('/team/6?utm_source=share&tab=player-stats');
      fixture.detectChanges();
      await settle();
      // The player stats tab loads its own data
      httpMock.match(() => true).forEach(request => request.flush({skaters: [], goalies: []}));
    });

    it('should not touch the URL for the tab already shown', async () => {
      open('6', {tab: 'games'});
      await flushTeamPage('BOS');
      replaceState.calls.reset();
      tab('Games').click();
      expect(replaceState).not.toHaveBeenCalled();
    });

    it('should open the player stats of the standings season', async () => {
      open('6', {tab: 'player-stats'});
      expect(child('app-team-player-stats').season).toBeUndefined();
      await flushTeamPage('BOS');
      expect(child('app-team-player-stats').teamId).toBe(6);
      expect(child('app-team-player-stats').season).toBe(20252026);
    });

    it('should say the player stats failed when the standings did', async () => {
      open('6', {tab: 'player-stats'});
      httpMock.expectOne(standingsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      httpMock.expectOne(scheduleUrl + 'BOS/now').flush(upcomingSchedule('BOS'));
      await settle();
      httpMock.match(scheduleUrl + 'BOS/20252026')
          .forEach(request => request.flush(mockClubScheduleSeason('BOS', 20252026)));
      await settle();
      expect(child('app-team-player-stats')).toBeNull();
      expect(text('.team-tab-message')).toBe('The player stats couldn\'t be loaded');
    });

    it('should say there are no team stats when they fail', async () => {
      open('6', {tab: 'team-stats'});
      httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
      httpMock.expectOne(scheduleUrl + 'BOS/now').flush(upcomingSchedule('BOS'));
      await settle();
      expect(child('.team-tab-message')).toBeNull();
      httpMock.expectOne(teamStatsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
      httpMock.match(scheduleUrl + 'BOS/20252026')
          .forEach(request => request.flush(mockClubScheduleSeason('BOS', 20252026)));
      await settle();
      expect(child('app-team-stats')).toBeNull();
      expect(text('.team-tab-message')).toBe('No team stats yet');
    });

    it('should open the standings tab with the standings type of the URL', async () => {
      open('6', {tab: 'standings', standingsType: 'byConference'});
      await flushTeamPage('BOS');
      expect(child('app-team-standings').teamId).toBe(6);
      expect(child('app-team-standings').standingsType).toBe(NhlStandingsTypeEnum.BY_CONFERENCE);
    });

    it('should open the standings tab on the divisions without a type, or with an unknown one', async () => {
      open('6', {tab: 'standings', standingsType: 'preseason'});
      await flushTeamPage('BOS');
      expect(child('app-team-standings').standingsType).toBe(NhlStandingsTypeEnum.BY_DIVISION);
    });

    it('should save the standings type in the URL while the standings tab is open', async () => {
      open('6', {tab: 'standings'});
      await flushTeamPage('BOS');
      const standings = child('app-team-standings');

      // What the standings tab's filters ask for (standingsTypeChange)
      component.selectStandingsType(NhlStandingsTypeEnum.BY_LEAGUE);
      fixture.detectChanges();
      expect(path()).toBe('/team/6?tab=standings&standingsType=byLeague');
      expect(standings.standingsType).toBe(NhlStandingsTypeEnum.BY_LEAGUE);

      // The default type is left out, and another tab drops the type
      component.selectStandingsType(NhlStandingsTypeEnum.BY_DIVISION);
      expect(path()).toBe('/team/6?tab=standings');
      component.selectStandingsType(NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS);
      tab('Games').click();
      expect(path()).toBe('/team/6?tab=games');

      // Back on the standings tab, the type picked last is still shown and saved
      tab('Standings').click();
      expect(path()).toBe('/team/6?tab=standings&standingsType=wildCardWithLeaders');
    });

    it('should move between the tabs with the arrow keys, Home and End', async () => {
      open('6');
      await flushTeamPage('BOS');

      pressKey(tab('Overview'), 'ArrowRight');
      expect(selectedTabLabel()).toBe('Standings');
      expect(document.activeElement).toBe(tab('Standings'));

      pressKey(tab('Standings'), 'End');
      expect(selectedTabLabel()).toBe('Games');
      pressKey(tab('Games'), 'ArrowRight');
      expect(selectedTabLabel()).toBe('Overview');
      pressKey(tab('Overview'), 'ArrowLeft');
      expect(selectedTabLabel()).toBe('Games');
      pressKey(tab('Games'), 'Home');
      expect(selectedTabLabel()).toBe('Overview');
      expect(path()).toBe('/team/6');

      pressKey(tab('Overview'), 'Enter');
      expect(selectedTabLabel()).toBe('Overview');
    });

    it('should follow a link to another tab', async () => {
      open('6', {tab: 'games'});
      await flushTeamPage('BOS');
      queryParams.next(convertToParamMap({tab: 'team-stats'}));
      fixture.detectChanges();
      expect(selectedTabLabel()).toBe('Team Stats');
    });
  });
});
