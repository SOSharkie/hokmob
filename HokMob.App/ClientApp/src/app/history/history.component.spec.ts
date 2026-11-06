import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {Location} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {HttpTestingController} from '@angular/common/http/testing';
import {ActivatedRoute, convertToParamMap, ParamMap, Params, Router} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {AppTestingModule} from '@shared/testing/app-testing.module';
import {derivedSeasonHistoryInProgress, mockSeasonHistory} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {RatedSeason} from '@shared/models/nhl-history/season-history.model';
import {HistorySeasonOption, SeasonHistoryService} from '@shared/services/season-history.service';

import {HistoryComponent} from './history.component';

describe('HistoryComponent', () => {
  let component: HistoryComponent;
  let fixture: ComponentFixture<HistoryComponent>;
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: jasmine.Spy;

  const historyUrl = 'assets/history/20262027-2.json';
  const finishedSeasonUrl = 'assets/history/20252026-2.json';
  const finishedSeason: HistorySeasonOption = {season: 20252026, gameType: 2};

  beforeEach(async () => {
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [AppTestingModule],
      declarations: [HistoryComponent],
      providers: [{provide: ActivatedRoute, useValue: {queryParamMap: queryParams}}],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();

    spyOn(console, 'error');
    httpMock = TestBed.inject(HttpTestingController);
    // Navigating changes the query parameters, as it does in the app
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.callFake((commands, extras) => {
      queryParams.next(convertToParamMap(extras.queryParams));
      return Promise.resolve(true);
    });
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  /** Opens the page, optionally with query parameters. */
  function open(params: Params = {}): void {
    queryParams.next(convertToParamMap(params));
    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function respond(body: unknown, options?: {status: number, statusText: string},
                         url: string = historyUrl): Promise<void> {
    httpMock.expectOne(url).flush(body, options);
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function element(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  it('should load the latest season and show a loading image until it\'s rated', async () => {
    open();
    expect(element('app-loading-spinner')).not.toBeNull();
    expect(element('app-rating-distribution')).toBeNull();

    await respond(mockSeasonHistory());
    expect(element('app-loading-spinner')).toBeNull();
    expect(component.ratedSeason.ratedGames.length).toBe(267);
  });

  it('should pass the rated season to the charts', async () => {
    open();
    await respond(mockSeasonHistory());
    const ratedSeason = component.ratedSeason;
    expect((element('app-rating-distribution') as any).ratedGames).toBe(ratedSeason.ratedGames);
    expect((element('app-average-rating-leaders') as any).ratedSeason).toBe(ratedSeason);
    expect((element('app-best-games') as any).ratedSeason).toBe(ratedSeason);
  });

  it('should show the season in the picker', async () => {
    open();
    await respond(mockSeasonHistory());
    const picker = element('.season-picker');
    expect(picker.textContent.trim()).toBe('2026-27 Regular Season');
    expect(picker.getAttribute('aria-label')).toBe('Season, 2026-27 Regular Season');
    expect(component.getSeasonLabel({season: 20262027, gameType: 3})).toBe('2026-27 Playoffs');
  });

  it('should say how far a season in progress goes', async () => {
    open();
    expect(element('.history-progress')).toBeNull();
    await respond(derivedSeasonHistoryInProgress());
    expect(element('.history-progress').textContent.trim()).toBe('Season in progress, through April 14');
  });

  it('should not call a finished season in progress', async () => {
    open();
    await respond(mockSeasonHistory());
    expect(element('.history-progress')).toBeNull();
  });

  it('should lower the leaderboard\'s minimum games for a season in progress', async () => {
    open();
    await respond(derivedSeasonHistoryInProgress());
    expect((element('app-average-rating-leaders') as any).minGames).toBe(1);
  });

  it('should keep the leaderboard\'s minimum games for a finished season', async () => {
    open();
    await respond(mockSeasonHistory());
    expect((element('app-average-rating-leaders') as any).minGames).toBe(20);
  });

  it('should go back to a finished season\'s note and minimum after a season in progress', async () => {
    open();
    await respond(derivedSeasonHistoryInProgress());

    component.selectSeason(finishedSeason);
    await respond(mockSeasonHistory(), undefined, finishedSeasonUrl);
    expect(element('.history-progress')).toBeNull();
    expect((element('app-average-rating-leaders') as any).minGames).toBe(20);
  });

  it('should show an empty state instead of the charts when the season can\'t be loaded', async () => {
    open();
    await respond('Not found', {status: 404, statusText: 'Not Found'});
    expect(element('.history-message').textContent.trim()).toBe('The season couldn\'t be loaded');
    expect(element('app-loading-spinner')).toBeNull();
    expect(element('app-rating-distribution')).toBeNull();
    expect(element('app-best-games')).toBeNull();
  });

  describe('the season query parameter', () => {
    it('should open the season in the URL, so a reload keeps it', async () => {
      open({season: '20252026'});
      await respond(mockSeasonHistory(), undefined, finishedSeasonUrl);
      expect(component.isSelected(finishedSeason)).toBeTrue();
      expect(element('.season-picker').textContent.trim()).toBe('2025-26 Regular Season');
      expect(navigate).not.toHaveBeenCalled();
    });

    ['19992000', 'abc', ''].forEach(season => {
      it(`should open the newest season for the season "${season}", which the page doesn't have`, async () => {
        open({season});
        await respond(mockSeasonHistory());
        expect(component.isSelected(SeasonHistoryService.seasons[0])).toBeTrue();
      });
    });

    it('should put a picked season in the URL, without the regular season\'s game type', async () => {
      open();
      await respond(mockSeasonHistory());
      component.selectSeason(finishedSeason);
      expect(navigate).toHaveBeenCalledOnceWith([], jasmine.objectContaining({queryParams: {season: 20252026}}));
      await respond(mockSeasonHistory(), undefined, finishedSeasonUrl);
    });

    it('should keep the playoffs apart from the regular season of the same year', async () => {
      const playoffs = {season: 20252026, gameType: 3};
      open();
      await respond(mockSeasonHistory());
      (component as {seasonOptions: HistorySeasonOption[]}).seasonOptions = [...component.seasonOptions, playoffs];

      component.selectSeason(playoffs);
      expect(navigate).toHaveBeenCalledOnceWith([],
          jasmine.objectContaining({queryParams: {season: 20252026, gameType: 3}}));
      await respond(mockSeasonHistory(), undefined, 'assets/history/20252026-3.json');
      expect(component.isSelected(playoffs)).toBeTrue();
    });

    it('should follow the back button to the page without a season', async () => {
      open({season: '20252026'});
      await respond(mockSeasonHistory(), undefined, finishedSeasonUrl);

      queryParams.next(convertToParamMap({}));
      await respond(mockSeasonHistory());
      expect(component.isSelected(SeasonHistoryService.seasons[0])).toBeTrue();
    });

    it('should not reload when the URL names the season already shown', async () => {
      open();
      await respond(mockSeasonHistory());
      const ratedSeason = component.ratedSeason;
      queryParams.next(convertToParamMap({season: '20262027'}));
      expect(component.ratedSeason).toBe(ratedSeason);
      expect(component.isLoading).toBeFalse();
    });

    it('should stop following the URL once the page is left', async () => {
      open();
      await respond(mockSeasonHistory());
      fixture.destroy();
      queryParams.next(convertToParamMap({season: '20252026'}));
      httpMock.expectNone(finishedSeasonUrl);
    });
  });

  describe('the filters in the URL', () => {
    /** Answers the page's season request, with the URL the page reads its filters' siblings from. */
    async function openWithUrl(url: string, params: Params = {}): Promise<jasmine.Spy> {
      const location = TestBed.inject(Location);
      spyOn(location, 'path').and.returnValue(url);
      spyOn(location, 'getState').and.returnValue({ɵrouterPageId: 4});
      const replaceState = spyOn(location, 'replaceState');
      open(params);
      await respond(mockSeasonHistory(), undefined, params['season'] ? finishedSeasonUrl : historyUrl);
      return replaceState;
    }

    function card(selector: string): any {
      return element(selector);
    }

    /** Changes a card's filter, the way the card does. */
    function changeFilter(selector: string, output: string, value: unknown): void {
      fixture.debugElement.query(By.css(selector)).triggerEventHandler(output, value);
      fixture.detectChanges();
    }

    it('should give the cards their defaults without any', async () => {
      await openWithUrl('/history');
      expect(card('app-rating-distribution').position).toBe('F');
      expect(card('app-average-rating-leaders').position).toBeNull();
      expect(card('app-average-rating-leaders').teamId).toBeNull();
      expect(card('app-best-games').position).toBeNull();
    });

    it('should give the cards the filters in the URL, so a reload keeps them', async () => {
      await openWithUrl('/history', {distribution: 'G', leaders: 'D', team: '59', best: 'F'});
      expect(card('app-rating-distribution').position).toBe('G');
      expect(card('app-average-rating-leaders').position).toBe('D');
      expect(card('app-average-rating-leaders').teamId).toBe(59);
      expect(card('app-best-games').position).toBe('F');
    });

    it('should use the defaults for filters it doesn\'t know', async () => {
      await openWithUrl('/history', {distribution: 'X', leaders: 'all', team: 'abc', best: 'g'});
      expect(card('app-rating-distribution').position).toBe('F');
      expect(card('app-average-rating-leaders').position).toBeNull();
      expect(card('app-average-rating-leaders').teamId).toBeNull();
      expect(card('app-best-games').position).toBeNull();
    });

    it('should save a filter without the router, keeping the season and the history state', async () => {
      const replaceState = await openWithUrl('/history?season=20252026', {season: '20252026'});
      changeFilter('app-average-rating-leaders', 'teamIdChange', 59);
      expect(replaceState).toHaveBeenCalledOnceWith('/history', 'season=20252026&team=59', {ɵrouterPageId: 4});
      expect(navigate).not.toHaveBeenCalled();
      expect(card('app-average-rating-leaders').teamId).toBe(59);
    });

    it('should save every card\'s filter', async () => {
      const replaceState = await openWithUrl('/history');
      changeFilter('app-rating-distribution', 'positionChange', 'D');
      expect(replaceState.calls.mostRecent().args[1]).toBe('distribution=D');
      changeFilter('app-average-rating-leaders', 'positionChange', 'G');
      expect(replaceState.calls.mostRecent().args[1]).toBe('distribution=D&leaders=G');
      changeFilter('app-best-games', 'positionChange', 'F');
      expect(replaceState.calls.mostRecent().args[1]).toBe('distribution=D&leaders=G&best=F');
    });

    it('should take a filter back to its default out of the URL', async () => {
      const replaceState = await openWithUrl('/history?distribution=D&team=59&best=F',
          {distribution: 'D', team: '59', best: 'F'});
      changeFilter('app-rating-distribution', 'positionChange', 'F');
      changeFilter('app-average-rating-leaders', 'teamIdChange', null);
      changeFilter('app-best-games', 'positionChange', null);
      expect(replaceState.calls.mostRecent().args.slice(0, 2)).toEqual(['/history', '']);
    });

    it('should clear the filters when another season is picked', async () => {
      await openWithUrl('/history', {team: '59', best: 'F'});
      component.selectSeason(finishedSeason);
      await respond(mockSeasonHistory(), undefined, finishedSeasonUrl);
      expect(card('app-average-rating-leaders').teamId).toBeNull();
      expect(card('app-best-games').position).toBeNull();
    });

    it('should follow the back button to a URL with other filters of the same season', async () => {
      await openWithUrl('/history', {best: 'F'});
      queryParams.next(convertToParamMap({best: 'G'}));
      fixture.detectChanges();
      expect(card('app-best-games').position).toBe('G');
      expect(component.isLoading).toBeFalse();
    });
  });

  it('should load a season picked in the menu, and ignore the season picked before it', async () => {
    open();
    let resolveFinished: (season: RatedSeason) => void;
    spyOn(TestBed.inject(SeasonHistoryService), 'getSeasonHistory')
        .and.returnValue(new Promise(resolve => resolveFinished = resolve));
    component.selectSeason(finishedSeason);
    expect(component.isSelected(finishedSeason)).toBeTrue();
    expect(component.isLoading).toBeTrue();

    // The newest season started loading first and answers now, but another season was picked since
    await respond(mockSeasonHistory());
    expect(component.ratedSeason).toBeUndefined();

    const rated = SeasonHistoryService.rateSeason(mockSeasonHistory());
    resolveFinished(rated);
    await new Promise(resolve => setTimeout(resolve));
    expect(component.ratedSeason).toBe(rated);
    expect(component.isLoading).toBeFalse();
  });

  it('should not reload the season already shown', async () => {
    open();
    await respond(mockSeasonHistory());
    component.selectSeason({season: 20262027, gameType: 2});
    httpMock.expectNone(historyUrl);
    expect(navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });
});
