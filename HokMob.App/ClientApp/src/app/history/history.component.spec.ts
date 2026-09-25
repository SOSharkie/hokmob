import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
import {AppTestingModule} from '@shared/testing/app-testing.module';
import {mockSeasonHistory} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {RatedSeason} from '@shared/models/nhl-history/season-history.model';
import {SeasonHistoryService} from '@shared/services/season-history.service';

import {HistoryComponent} from './history.component';

describe('HistoryComponent', () => {
  let component: HistoryComponent;
  let fixture: ComponentFixture<HistoryComponent>;
  let httpMock: HttpTestingController;

  const historyUrl = 'assets/history/20252026-2.json';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTestingModule],
      declarations: [HistoryComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();

    spyOn(console, 'error');
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  async function respond(body: unknown, options?: {status: number, statusText: string}): Promise<void> {
    httpMock.expectOne(historyUrl).flush(body, options);
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function element(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  it('should load the latest season and show a loading image until it\'s rated', async () => {
    expect(element('.loading-gif')).not.toBeNull();
    expect(element('app-rating-distribution')).toBeNull();

    await respond(mockSeasonHistory());
    expect(element('.loading-gif')).toBeNull();
    expect(component.ratedSeason.ratedGames.length).toBe(267);
  });

  it('should pass the rated season to the charts', async () => {
    await respond(mockSeasonHistory());
    const ratedSeason = component.ratedSeason;
    expect((element('app-rating-distribution') as any).ratedGames).toBe(ratedSeason.ratedGames);
    expect((element('app-average-rating-leaders') as any).ratedSeason).toBe(ratedSeason);
    expect((element('app-best-games') as any).ratedSeason).toBe(ratedSeason);
  });

  it('should show the season in the picker', async () => {
    await respond(mockSeasonHistory());
    const picker = element('.season-picker');
    expect(picker.textContent.trim()).toBe('2025-26 Regular Season');
    expect(picker.getAttribute('aria-label')).toBe('Season, 2025-26 Regular Season');
    expect(component.getSeasonLabel({season: 20262027, gameType: 3})).toBe('2026-27 Playoffs');
  });

  it('should show an empty state instead of the charts when the season can\'t be loaded', async () => {
    await respond('Not found', {status: 404, statusText: 'Not Found'});
    expect(element('.history-message').textContent.trim()).toBe('The season couldn\'t be loaded');
    expect(element('.loading-gif')).toBeNull();
    expect(element('app-rating-distribution')).toBeNull();
    expect(element('app-best-games')).toBeNull();
  });

  it('should load a season picked in the menu, and ignore the season picked before it', async () => {
    const playoffs = {season: 20252026, gameType: 3};
    let resolvePlayoffs: (season: RatedSeason) => void;
    spyOn(TestBed.inject(SeasonHistoryService), 'getSeasonHistory')
        .and.returnValue(new Promise(resolve => resolvePlayoffs = resolve));
    component.selectSeason(playoffs);
    expect(component.isSelected(playoffs)).toBeTrue();
    expect(component.isLoading).toBeTrue();

    // The regular season started loading first and answers now, but the playoffs were picked since
    await respond(mockSeasonHistory());
    expect(component.ratedSeason).toBeUndefined();

    const rated = SeasonHistoryService.rateSeason(mockSeasonHistory());
    resolvePlayoffs(rated);
    await new Promise(resolve => setTimeout(resolve));
    expect(component.ratedSeason).toBe(rated);
    expect(component.isLoading).toBeFalse();
  });

  it('should not reload the season already shown', async () => {
    await respond(mockSeasonHistory());
    component.selectSeason({season: 20252026, gameType: 2});
    httpMock.expectNone(historyUrl);
    expect(component.isLoading).toBeFalse();
  });
});
