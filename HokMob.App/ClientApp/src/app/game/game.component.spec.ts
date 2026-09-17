import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Location } from '@angular/common';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GameBundle } from '@shared/models/nhl-web-api/game-bundle.model';
import { ClubScheduleSeason } from '@shared/models/nhl-web-api/club-schedule.model';
import { ScoreResponse } from '@shared/models/nhl-web-api/score.model';
import { NhlGameStateEnum } from '@shared/enums/nhl-game-state.enum';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { RouterExtensionService } from '@shared/services/router-extension.service';
import { MatDialog } from '@angular/material/dialog';
import { PlayerGameDialogComponent } from '@app/game/player-game-dialog/player-game-dialog.component';
import { HighlightsDialogComponent } from '@app/game/highlights-dialog/highlights-dialog.component';
import { GoalHighlightDialogComponent } from '@app/game/goal-highlight-dialog/goal-highlight-dialog.component';
import {
  derivedIntermissionLanding,
  derivedLiveLanding,
  mockClubScheduleSeason,
  mockGameBundle,
  mockGameLanding,
  mockPlayoffScoreResponse,
  mockRegularSeasonScoreResponse,
  mockScoreResponse
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

  /** Answers the team form request for a team's season with the schedule, or with a server error without one. */
  function flushClubSchedule(teamAbbrev: string, season: number, schedule?: ClubScheduleSeason): void {
    const request = httpMock.expectOne(`/api/nhl/club-schedule-season/${teamAbbrev}/${season}`);
    if (schedule) {
      request.flush(schedule);
    } else {
      request.flush('Server error', {status: 500, statusText: 'Internal Server Error'});
    }
  }

  /** Answers the score request of a finished or playoff game with the response, or with a server error without one. */
  function flushScore(gameDate: string, response?: ScoreResponse): void {
    const request = httpMock.expectOne(`/api/nhl/score/${gameDate}`);
    if (response) {
      request.flush(response);
    } else {
      request.flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    }
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
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();

    const landing = mockGameLanding(2025021057);
    expect(text('.league-info-label')).toBe('NHL Regular Season');
    expect(text('.info-label')).toBe('NHLN');
    expect(text('.game-venue-container')).toContain('Canada Life Centre');
    expect(text('.game-date-time')).toContain(dayjs(landing.startTimeUTC).format('MMMM D, YYYY, h:mm A'));
    expect(text('.watch-link')).toBe('Highlights');
    expect(element('.watch-button').tagName).toBe('BUTTON');
    expect(component.highlightVideos.map(video => video.videoId)).toEqual(['6390989103112', '6390990355112']);
    expect(component.watchIcon).toBe('smart_display');
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
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    const scoring = element('app-goal-scorers').scoring;
    expect(scoring.map(period => period.goals.length)).toEqual([2, 0, 3]);
  });

  it('should pass the play-by-play to the momentum chart and event timelines', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    expect(element('app-momentum').playByPlay.plays.length).toBe(270);

    // One timeline in the main column for mobile, one beside it for desktop
    const timelines = fixture.nativeElement.querySelectorAll('app-mini-event-timeline');
    expect(timelines.length).toBe(2);
    timelines.forEach((timeline: any) => expect(timeline.playByPlay.id).toBe(2025021057));
    expect(element('.side-game app-mini-event-timeline').homeTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    expect(element('.side-game app-mini-event-timeline').awayTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(19));
  });

  it('should open the player dialog for an assist clicked in an event timeline', async () => {
    const openDialog = spyOn(GameComponent.prototype, 'openPlayerGameDialog');
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    // An assist click carries no event ID, so it always falls back to the player dialog
    fixture.debugElement.query(By.css('.side-game app-mini-event-timeline')).triggerEventHandler('playerClicked', {playerId: 8478398});
    expect(openDialog).toHaveBeenCalledWith(8478398);
  });

  it('should open the goal highlight dialog for a clicked goal with a posted clip', async () => {
    const openDialog = spyOn(TestBed.inject(MatDialog), 'open');
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    // Scheifele's goal (eventId 141), which has a real highlight clip
    fixture.debugElement.query(By.css('app-goal-scorers')).triggerEventHandler('scorerClicked', {playerId: 8476460, eventId: 141});
    expect(openDialog).toHaveBeenCalledWith(GoalHighlightDialogComponent, jasmine.objectContaining({
      data: {
        player: jasmine.objectContaining({playerId: 8476460, name: 'Mark Scheifele'}),
        video: {label: 'Highlight', videoId: '6390982926112',
          nhlUrl: 'https://nhl.com/video/stl-wpg-scheifele-scores-goal-against-jordan-binnington-6390982926112'}
      }
    }));
  });

  it('should open the player dialog when the clicked goal has no highlight clip yet', async () => {
    const openDialog = spyOn(TestBed.inject(MatDialog), 'open');
    const bundle = mockGameBundle(2025021057);
    const goal = bundle.landing.summary.scoring.flatMap(period => period.goals).find(item => item.eventId === 141);
    delete goal.highlightClip;
    delete goal.highlightClipSharingUrl;
    open('2025021057');
    flushBundle('2025021057', bundle);
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    fixture.debugElement.query(By.css('app-goal-scorers')).triggerEventHandler('scorerClicked', {playerId: 8476460, eventId: 141});
    expect(openDialog).toHaveBeenCalledWith(PlayerGameDialogComponent, jasmine.objectContaining({
      data: {player: jasmine.objectContaining({playerId: 8476460, name: 'Mark Scheifele'})}
    }));
  });

  it('should pass the rated players with full names, the head coaches and the team logos to the top players', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    const topPlayers = element('app-game-top-players');
    expect(topPlayers.homePlayers.length).toBe(20);
    expect(topPlayers.homePlayers.slice(0, 2).map(player => player.name)).toEqual(['Eric Comrie', 'Haydn Fleury']);
    expect(topPlayers.awayPlayers[0].name).toBe('Dylan Holloway');
    expect(topPlayers.homeCoach).toBe('Scott Arniel');
    expect(topPlayers.awayCoach).toBe('Jim Montgomery');
    expect(topPlayers.homeTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    expect(topPlayers.awayTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(19));
  });

  it('should highlight the player hovered in the goal scorers or an event timeline in the top players', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    spyOn(window, 'matchMedia').and.returnValue({matches: true} as MediaQueryList);

    fixture.debugElement.query(By.css('app-goal-scorers')).triggerEventHandler('playerHovered', {playerId: 8476460, goalIndex: 0});
    fixture.detectChanges();
    expect(element('app-game-top-players').highlightedPlayer).toEqual({playerId: 8476460, goalIndex: 0});

    const timeline = fixture.debugElement.query(By.css('.side-game app-mini-event-timeline'));
    timeline.triggerEventHandler('playerHovered', {playerId: 8478398});
    fixture.detectChanges();
    expect(element('app-game-top-players').highlightedPlayer).toEqual({playerId: 8478398});

    timeline.triggerEventHandler('playerHovered', null);
    fixture.detectChanges();
    expect(element('app-game-top-players').highlightedPlayer).toBeNull();
  });

  it('should not highlight a hovered player on a device that cannot hover', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    spyOn(window, 'matchMedia').and.returnValue({matches: false} as MediaQueryList);

    fixture.debugElement.query(By.css('app-goal-scorers')).triggerEventHandler('playerHovered', {playerId: 8476460, goalIndex: 0});
    fixture.detectChanges();
    expect(element('app-game-top-players').highlightedPlayer).toBeNull();
  });

  it('should pass the right-rail team stats and team IDs to the game stats', async () => {
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    const gameStats = element('app-game-stats');
    expect(gameStats.teamGameStats.find(stat => stat.category === 'hits')).toEqual({category: 'hits', awayValue: 13, homeValue: 26});
    expect(gameStats.homeTeamId).toBe(52);
    expect(gameStats.awayTeamId).toBe(19);
    expect(gameStats.homeTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    // No team form for a finished game
    expect(element('app-team-form')).toBeNull();
  });

  it('should open the player dialog with the game stats of the clicked player', async () => {
    const openDialog = spyOn(TestBed.inject(MatDialog), 'open');
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    fixture.debugElement.query(By.css('app-game-top-players')).triggerEventHandler('playerClicked', 8476412);
    expect(openDialog).toHaveBeenCalledWith(PlayerGameDialogComponent, jasmine.objectContaining({
      data: {player: jasmine.objectContaining({name: 'Jordan Binnington', teamId: 19, hokmobRating: 4.1})}
    }));
  });

  it('should not open the player dialog for a player without game stats', async () => {
    const openDialog = spyOn(TestBed.inject(MatDialog), 'open');
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), boxscore: undefined});
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    component.openPlayerGameDialog(8476460);
    expect(openDialog).not.toHaveBeenCalled();
    expect(element('app-game-top-players')).toBeNull();
  });

  it('should load the highlights but no series status of a finished game, and not poll it', fakeAsync(() => {
    open('2025020952');
    flushBundle('2025020952', mockGameBundle(2025020952));
    settleFakeAsync();
    flushScore('2026-03-01', mockScoreResponse());
    settleFakeAsync();
    expect(text('.game-venue-container')).toContain('Honda Center');
    expect(component.seriesStatus).toBeUndefined();
    expect(component.highlightsPath).toBe('/video/cgy-at-ana-recap-6390250506112');
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
    expect(element('.watch-button').tagName).toBe('BUTTON');
    expect(text('.info-label')).toBe('ABC');
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
    expect(text('.watch-link')).toBe('NHL.com Game Center');
    expect(element('.watch-button').getAttribute('href')).toBe('https://www.nhl.com/gamecenter/2025030414');
  });

  it('should play the highlights of a real finished game in the highlights dialog', async () => {
    const openDialog = spyOn(TestBed.inject(MatDialog), 'open');
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    element('.watch-button').click();
    expect(openDialog).toHaveBeenCalledWith(HighlightsDialogComponent, jasmine.objectContaining({
      data: {
        subtitle: 'STL at WPG',
        videos: [
          {label: 'Recap', videoId: '6390989103112', nhlUrl: 'https://www.nhl.com/video/stl-at-wpg-recap-6390989103112'},
          {label: 'Condensed Game', videoId: '6390990355112',
            nhlUrl: 'https://www.nhl.com/video/stl-at-wpg-condensed-game-6390990355112'}
        ]
      }
    }));
  });

  it('should play only the condensed game of a finished game without a recap', async () => {
    const response = mockRegularSeasonScoreResponse();
    delete response.games[0].threeMinRecap;
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', response);
    await settle();
    expect(text('.watch-link')).toBe('Highlights');
    expect(element('.watch-button').tagName).toBe('BUTTON');
    expect(component.highlightVideos.map(video => video.label)).toEqual(['Condensed Game']);
  });

  it('should link the highlights on NHL.com when their paths have no video ID', async () => {
    const openDialog = spyOn(TestBed.inject(MatDialog), 'open');
    const response = mockRegularSeasonScoreResponse();
    response.games[0].threeMinRecap = '/video/stl-at-wpg-recap';
    delete response.games[0].condensedGame;
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', response);
    await settle();
    expect(text('.watch-link')).toBe('Highlights');
    expect(element('.watch-button').getAttribute('href')).toBe('https://www.nhl.com/video/stl-at-wpg-recap');
    component.openHighlightsDialog();
    expect(openDialog).not.toHaveBeenCalled();
  });

  it('should link the NHL.com game center of a finished game without highlights', async () => {
    const response = mockRegularSeasonScoreResponse();
    delete response.games[0].threeMinRecap;
    delete response.games[0].condensedGame;
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', response);
    await settle();
    expect(text('.watch-link')).toBe('NHL.com Game Center');
    expect(element('.watch-button').getAttribute('href')).toBe('https://www.nhl.com/gamecenter/2025021057');
    expect(component.watchIcon).toBe('tv');
  });

  it('should show the game when the optional gamecenter requests fail', async () => {
    open('2025020952');
    flushBundle('2025020952', {landing: mockGameLanding(2025020952)});
    await settle();
    flushScore('2026-03-01');
    await settle();
    expect(element('.game-header')).not.toBeNull();
    expect(text('.game-venue-container')).toContain('Honda Center');
    expect(element('app-goal-scorers')).not.toBeNull();
    expect(component.playByPlay).toBeUndefined();
    expect(component.boxscore).toBeUndefined();
    expect(text('.game-load-error')).toBeUndefined();
    expect(element('app-momentum')).toBeNull();
    expect(element('app-mini-event-timeline')).toBeNull();
    expect(element('app-game-top-players')).toBeNull();
    expect(element('app-game-stats')).toBeNull();
  });

  it('should show an error instead of the game when the landing fails', async () => {
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: undefined});
    await settle();
    expect(text('.game-load-error-message')).toBe("This game couldn't be loaded.");
    expect(element('.game-header')).toBeNull();
    expect(component.landing).toBeUndefined();
  });

  it('should not show goal scorers for a real future game', async () => {
    open('2026020056');
    flushBundle('2026020056', mockGameBundle(2026020056));
    await settle();
    flushClubSchedule('BOS', 20262027);
    flushClubSchedule('UTA', 20262027);
    await settle();
    expect(text('.info-label')).toBe('NESN');
    // No score request for a future regular season game
    httpMock.expectNone(request => request.url.startsWith('/api/nhl/score/'));
    expect(text('.watch-link')).toBe('Where to Watch');
    expect(element('.watch-button').getAttribute('href')).toBe('https://www.nhl.com/gamecenter/2026020056');
    expect(element('.watch-button').getAttribute('target')).toBe('_blank');
    expect(text('.game-venue-container')).toContain('TD Garden');
    expect(element('app-goal-scorers')).toBeNull();
    expect(component.showTopPlayers).toBeFalse();
    expect(component.homePlayers).toEqual([]);
    expect(element('app-game-top-players')).toBeNull();
    expect(element('app-game-stats')).toBeNull();
    expect(element('app-momentum')).toBeNull();
    expect(element('app-mini-event-timeline')).toBeNull();
    // Both team form requests failed
    expect(element('app-team-form')).toBeNull();
  });

  it('should show the team form of a real future game, filled in from the previous season', async () => {
    open('2026020056');
    flushBundle('2026020056', mockGameBundle(2026020056));
    await settle();
    expect(element('app-team-form')).toBeNull();

    flushClubSchedule('BOS', 20262027, mockClubScheduleSeason('BOS', 20262027));
    flushClubSchedule('UTA', 20262027, mockClubScheduleSeason('UTA', 20262027));
    await settle();
    flushClubSchedule('BOS', 20252026, mockClubScheduleSeason('BOS', 20252026));
    flushClubSchedule('UTA', 20252026, mockClubScheduleSeason('UTA', 20252026));
    await settle();

    const teamForm = element('app-team-form');
    expect(teamForm.homeTeamId).toBe(6);
    expect(teamForm.awayTeamId).toBe(68);
    expect(teamForm.homeTeamGames.map(game => game.id))
        .toEqual([2025030116, 2025030115, 2025030114, 2025030113, 2025030112]);
    expect(teamForm.awayTeamGames.map(game => game.id))
        .toEqual([2025030176, 2025030175, 2025030174, 2025030173, 2025030172]);
  });

  it('should show the team form when only one team has games', async () => {
    open('2026020056');
    flushBundle('2026020056', mockGameBundle(2026020056));
    await settle();
    flushClubSchedule('BOS', 20262027, mockClubScheduleSeason('BOS', 20262027));
    flushClubSchedule('UTA', 20262027);
    await settle();
    flushClubSchedule('BOS', 20252026, mockClubScheduleSeason('BOS', 20252026));
    await settle();

    const teamForm = element('app-team-form');
    expect(teamForm.homeTeamGames.length).toBe(5);
    expect(teamForm.awayTeamGames).toEqual([]);
  });

  it('should ignore a late team form for the previous game', async () => {
    open('2026020056');
    flushBundle('2026020056', mockGameBundle(2026020056));
    await settle();

    routeParams.next({id: '2025021057'});
    flushBundle('2025021057', mockGameBundle(2025021057));
    flushClubSchedule('BOS', 20262027, mockClubScheduleSeason('BOS', 20262027));
    flushClubSchedule('UTA', 20262027, mockClubScheduleSeason('UTA', 20262027));
    await settle();
    flushClubSchedule('BOS', 20252026, mockClubScheduleSeason('BOS', 20252026));
    flushClubSchedule('UTA', 20252026, mockClubScheduleSeason('UTA', 20252026));
    await settle();

    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();
    expect(component.landing.id).toBe(2025021057);
    expect(component.homeTeamFormGames).toEqual([]);
    expect(component.awayTeamFormGames).toEqual([]);
  });

  it('should refresh a future game scheduled today', fakeAsync(() => {
    const bundle = mockGameBundle(2026020056);
    bundle.landing.startTimeUTC = dayjs().toISOString();
    open('2026020056');
    flushBundle('2026020056', bundle);
    settleFakeAsync();
    flushClubSchedule('BOS', 20262027);
    flushClubSchedule('UTA', 20262027);
    settleFakeAsync();
    tick(10000);
    flushBundle('2026020056', bundle);
    settleFakeAsync();
    // The team form is only loaded once
    httpMock.expectNone(request => request.url.includes('club-schedule-season'));
    fixture.destroy();
    tick(10000);
    httpMock.expectNone('/api/nhl/gamecenter/2026020056/landing');
  }));

  it('should refresh a live game every 10 seconds and stop once it is over', fakeAsync(() => {
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: derivedLiveLanding()});
    settleFakeAsync();
    flushClubSchedule('WPG', 20252026);
    flushClubSchedule('STL', 20252026);
    settleFakeAsync();
    expect(component.liveGame).toBeTrue();
    expect(element('app-goal-scorers').scoring.length).toBe(2);
    expect(text('.watch-link')).toBe('Where to Watch');

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

    // The highlights are loaded once the game is over
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    settleFakeAsync();
    expect(text('.watch-link')).toBe('Highlights');

    tick(30000);
    httpMock.expectNone('/api/nhl/gamecenter/2025021057/landing');
  }));

  it('should keep the shown game when a refresh fails', fakeAsync(() => {
    open('2025021057');
    flushBundle('2025021057', {...mockGameBundle(2025021057), landing: derivedLiveLanding()});
    settleFakeAsync();
    flushClubSchedule('WPG', 20252026);
    flushClubSchedule('STL', 20252026);
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
    flushClubSchedule('WPG', 20252026);
    flushClubSchedule('STL', 20252026);
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
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();

    routeParams.next({id: '2025020952'});
    fixture.detectChanges();
    flushBundle('2025020952', mockGameBundle(2025020952));
    await settle();
    flushScore('2026-03-01', mockScoreResponse());
    await settle();
    expect(element('.game-header app-game-header').landing.id).toBe(2025020952);
    expect(component.highlightsPath).toBe('/video/cgy-at-ana-recap-6390250506112');
    expect(text('.game-venue-container')).toContain('Honda Center');
  });

  it('should ignore a late response for the previous game', async () => {
    open('2025021057');
    routeParams.next({id: '2025020952'});
    flushBundle('2025020952', mockGameBundle(2025020952));
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    // Only the current game loads its highlights
    flushScore('2026-03-01', mockScoreResponse());
    await settle();
    expect(component.landing.id).toBe(2025020952);
  });

  it('should go to the games of the game day without a previous page', async () => {
    const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    open('2025021057');
    flushBundle('2025021057', mockGameBundle(2025021057));
    await settle();
    flushScore('2026-03-15', mockRegularSeasonScoreResponse());
    await settle();

    expect(text('.games-label')).toBe('Games');
    component.backToPrevious();
    const date = dayjs(mockGameLanding(2025021057).startTimeUTC).format('YYYYMMDD');
    expect(navigateByUrl).toHaveBeenCalledWith('/?date=' + date);
  });

  it('should go back in the browser history, not to a new entry, when there is a previous page', async () => {
    spyOn(TestBed.inject(RouterExtensionService), 'getPreviousUrl').and.returnValue('/playoffs');
    const back = spyOn(TestBed.inject(Location), 'back');
    const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    open('2025030414');
    flushBundle('2025030414', mockGameBundle(2025030414));
    await settle();
    httpMock.expectOne('/api/nhl/score/2026-06-09').flush(mockPlayoffScoreResponse());
    await settle();

    expect(text('.games-label')).toBe('Playoffs');
    component.backToPrevious();
    expect(back).toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('should show a back button when the game fails to load', async () => {
    spyOn(TestBed.inject(RouterExtensionService), 'getPreviousUrl').and.returnValue('/?date=20260301');
    const back = spyOn(TestBed.inject(Location), 'back');
    open('2025021057');
    flushBundle('2025021057', {});
    await settle();

    expect(text('.game-load-error .games-label')).toBe('Games');
    fixture.nativeElement.querySelector('.game-load-error .games-back-button').click();
    expect(back).toHaveBeenCalled();
  });
});
