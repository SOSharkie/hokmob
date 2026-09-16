import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let currentSeason: jasmine.Spy;
  let queryParams: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ HomeComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    currentSeason = spyOn(TestBed.inject(NhlStatsApiService), 'getCurrentSeason')
        .and.resolveTo({season: 20262027, isPlayoffMode: false});
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function has(selector: string): boolean {
    return !!fixture.nativeElement.querySelector(selector);
  }

  it('should show neither summary until playoff mode is known', () => {
    fixture.detectChanges();
    expect(has('app-playoff-summary')).toBeFalse();
    expect(has('app-standings-summary')).toBeFalse();
  });

  it('should show the standings summary outside playoff mode', async () => {
    await settle();
    expect(has('app-standings-summary')).toBeTrue();
    expect(has('app-playoff-summary')).toBeFalse();
  });

  it('should show the playoff summary in playoff mode', async () => {
    currentSeason.and.resolveTo({season: 20252026, isPlayoffMode: true});
    await settle();
    expect(has('app-playoff-summary')).toBeTrue();
    expect(has('app-standings-summary')).toBeFalse();
  });

  it('should give the scoreboard the date of the URL, and follow it when it changes', async () => {
    queryParams.next(convertToParamMap({date: '20260301'}));
    await settle();
    expect(fixture.nativeElement.querySelector('app-scores').selectedDayString).toBe('20260301');

    // Like the browser's back button, from a day to today
    queryParams.next(convertToParamMap({}));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-scores').selectedDayString).toBe(dayjs().format('YYYYMMDD'));
  });

  it('should show today for an invalid date in the URL', async () => {
    queryParams.next(convertToParamMap({date: 'yesterday'}));
    await settle();
    expect(component.selectedDayString).toBe(dayjs().format('YYYYMMDD'));
  });

  it('should put a picked day in the URL, and no date for today', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    await settle();
    component.onSelectedDayChange(new Date(2026, 2, 1));
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {date: '20260301'}}));
    component.onSelectedDayChange(new Date());
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {}}));
  });

  it('should show the standings summary when the season dates fail', async () => {
    currentSeason.and.rejectWith(new Error('Bad gateway'));
    await settle();
    expect(has('app-standings-summary')).toBeTrue();
    expect(component.isPlayoffs).toBeFalse();
  });
});
