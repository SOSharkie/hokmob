import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlStatsApiService } from '@shared/services/nhl-stats-api.service';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let currentSeason: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ HomeComponent ],
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

  it('should show the standings summary when the season dates fail', async () => {
    currentSeason.and.rejectWith(new Error('Bad gateway'));
    await settle();
    expect(has('app-standings-summary')).toBeTrue();
    expect(component.isPlayoffs).toBeFalse();
  });
});
