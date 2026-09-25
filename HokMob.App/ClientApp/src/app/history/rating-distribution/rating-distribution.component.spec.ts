import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Chart} from 'chart.js';
import {AppTestingModule} from '@shared/testing/app-testing.module';
import {mockSeasonHistory} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import {SeasonHistoryService} from '@shared/services/season-history.service';
import {RatedGame} from '@shared/models/nhl-history/season-history.model';
import {StatsUtils} from '@shared/utils/stats-utils';

import {RatingDistributionComponent} from './rating-distribution.component';

describe('RatingDistributionComponent', () => {
  let component: RatingDistributionComponent;
  let fixture: ComponentFixture<RatingDistributionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTestingModule],
      declarations: [RatingDistributionComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RatingDistributionComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function ratedGames(): RatedGame[] {
    return SeasonHistoryService.rateSeason(mockSeasonHistory()).ratedGames;
  }

  function show(games: RatedGame[]): void {
    fixture.componentRef.setInput('ratedGames', games);
    fixture.detectChanges();
  }

  function chart(): Chart<'bar', {x: number, y: number}[]> {
    return Chart.getChart(fixture.nativeElement.querySelector('canvas')) as Chart<'bar', {x: number, y: number}[]>;
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector).textContent.trim();
  }

  function clickPosition(label: string): void {
    (Array.from(fixture.nativeElement.querySelectorAll('.toggle-option')) as HTMLElement[])
        .find(button => button.textContent.trim() === label).click();
    fixture.detectChanges();
  }

  it('should chart the forwards\' ratings in 20 bins that add up to their games', () => {
    show(ratedGames());
    const data = chart().data.datasets[0].data;
    expect(data.length).toBe(20);
    expect(data.reduce((sum, point) => sum + point.y, 0)).toBe(168);
    expect(text('.games-value')).toBe('168');
    // Each bar is centered in its bin
    expect(data[0].x).toBe(0.25);
    expect(data[19].x).toBe(9.75);
  });

  it('should show the mean, median and the shares of 7+ and 8.5+ games', () => {
    const games = ratedGames();
    show(games);
    const forwards = games.filter(game => game.position === 'F').map(game => game.rating);
    const mean = forwards.reduce((sum, rating) => sum + rating, 0) / forwards.length;
    expect(text('.mean-value')).toBe(mean.toFixed(2));
    expect(text('.median-value')).toBe(component.distribution.median.toFixed(1));
    expect(text('.green-value')).toBe((forwards.filter(rating => rating >= 7).length / 168 * 100).toFixed(1) + '%');
    expect(text('.blue-value')).toBe((forwards.filter(rating => rating >= 8.5).length / 168 * 100).toFixed(1) + '%');
  });

  it('should color each bar like a rating in its bin', () => {
    show(ratedGames());
    const colors = chart().data.datasets[0].backgroundColor as string[];
    expect(colors[0]).toBe(StatsUtils.getHokmobRatingColor(0));
    expect(colors[14]).toBe(StatsUtils.hokmobRatingGreen);
    expect(colors[17]).toBe(StatsUtils.hokmobRatingBlue);
  });

  it('should switch to the goalies, leaving out the one who faced no shots', () => {
    show(ratedGames());
    clickPosition('Goalies');
    expect(text('.games-value')).toBe('15');
    expect(chart().data.datasets[0].data.reduce((sum, point) => sum + point.y, 0)).toBe(15);
    const selected = fixture.nativeElement.querySelector('.toggle-option.selected') as HTMLElement;
    expect(selected.textContent.trim()).toBe('Goalies');
    expect(selected.getAttribute('aria-pressed')).toBe('true');

    clickPosition('Defense');
    expect(text('.games-value')).toBe('84');
  });

  it('should show dashes and empty bars without games', () => {
    show([]);
    expect(text('.games-value')).toBe('0');
    expect(text('.mean-value')).toBe('-');
    expect(text('.median-value')).toBe('-');
    expect(text('.green-value')).toBe('-');
    expect(chart().data.datasets[0].data.every(point => point.y === 0)).toBeTrue();
  });

  it('should label a bin by its first and last rating, with the 10s in the last bin', () => {
    expect(RatingDistributionComponent.getBinLabel(7)).toBe('7.0 - 7.4');
    expect(RatingDistributionComponent.getBinLabel(9.5)).toBe('9.5 - 10.0');
    expect(RatingDistributionComponent.getBinLabel(0)).toBe('0.0 - 0.4');
  });

  it('should destroy the chart with the component', () => {
    show(ratedGames());
    const canvas = fixture.nativeElement.querySelector('canvas');
    fixture.destroy();
    expect(Chart.getChart(canvas)).toBeUndefined();
  });
});
