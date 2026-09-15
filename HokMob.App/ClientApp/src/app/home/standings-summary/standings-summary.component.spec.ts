import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlStandingsTypeEnum } from '@shared/enums/nhl-standings-type.enum';
import { mockStandingsResponse } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { StandingsSummaryComponent } from './standings-summary.component';

describe('StandingsSummaryComponent', () => {
  let component: StandingsSummaryComponent;
  let fixture: ComponentFixture<StandingsSummaryComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ StandingsSummaryComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StandingsSummaryComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function miniStandings(): any {
    return fixture.nativeElement.querySelector('.mini-standings app-standings');
  }

  it('should load league standings and pass them to the mini standings', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/nhl/standings/now').flush(mockStandingsResponse());
    await settle();
    expect(component.standings.length).toBe(1);
    expect(component.standings[0].teams.length).toBe(32);
    expect(miniStandings().standings).toBe(component.standings);
    expect(miniStandings().miniStandings).toBeTrue();
    expect(miniStandings().showFormAndNext).toBeFalse();
  });

  it('should group standings by the given standings type', async () => {
    fixture.componentRef.setInput('standingsType', NhlStandingsTypeEnum.BY_DIVISION);
    fixture.detectChanges();
    httpMock.expectOne('/api/nhl/standings/now').flush(mockStandingsResponse());
    await settle();
    expect(component.standings.map(group => group.title))
        .toEqual(['Atlantic Division', 'Metropolitan Division', 'Central Division', 'Pacific Division']);
    expect(miniStandings().defaultStandingsType).toBe(NhlStandingsTypeEnum.BY_DIVISION);
  });

  it('should show only the title when the request fails', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/nhl/standings/now')
        .flush('Server error', {status: 500, statusText: 'Internal Server Error'});
    await settle();
    expect(component.standings).toBeUndefined();
    expect(miniStandings()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('NHL Standings');
  });
});
