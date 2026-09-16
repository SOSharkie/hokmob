import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Params, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlStandingsTypeEnum } from '@shared/enums/nhl-standings-type.enum';
import { mockStandingsResponse } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { LeagueStandingsComponent } from './league-standings.component';

describe('LeagueStandingsComponent', () => {
  let component: LeagueStandingsComponent;
  let fixture: ComponentFixture<LeagueStandingsComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let queryParams: BehaviorSubject<ParamMap>;

  const standingsUrl = '/api/nhl/standings/now';

  beforeEach(async () => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ LeagueStandingsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ],
      providers: [ {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}} ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeagueStandingsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(console, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function load(params: Params = {}): Promise<void> {
    queryParams.next(convertToParamMap(params));
    fixture.detectChanges();
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    await settle();
  }

  function selectedFilter(): string {
    return fixture.nativeElement.querySelector('.selected-filter').textContent.trim();
  }

  it('should load league standings by default', async () => {
    await load();
    expect(component.currentStandingsType).toBe(NhlStandingsTypeEnum.BY_LEAGUE);
    expect(component.standings.map(group => group.title)).toEqual(['NHL']);
    expect(selectedFilter()).toBe('League');
    expect(fixture.nativeElement.querySelector('.main-standings app-standings').standings).toBe(component.standings);
  });

  it('should use the standings type from the URL', async () => {
    await load({standingsType: NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS});
    expect(component.currentStandingsType).toBe(NhlStandingsTypeEnum.WILD_CARD_WITH_LEADERS);
    expect(component.standings.length).toBe(6);
    expect(selectedFilter()).toBe('Playoffs');
  });

  it('should ignore an unknown standings type in the URL', async () => {
    await load({standingsType: 'bogus'});
    expect(component.currentStandingsType).toBe(NhlStandingsTypeEnum.BY_LEAGUE);
    expect(component.standings.length).toBe(1);
  });

  it('should update the URL, and reload the standings for the new URL, when a filter is clicked', async () => {
    await load();
    const conferenceFilter: HTMLElement = fixture.nativeElement.querySelectorAll('.standings-type-filter')[1];
    conferenceFilter.click();
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {standingsType: 'byConference'}}));
    httpMock.expectNone(standingsUrl);
    await load({standingsType: 'byConference'});
    expect(component.standings.map(group => group.title)).toEqual(['Eastern Conference', 'Western Conference']);
    expect(selectedFilter()).toBe('Conference');
  });

  it('should go back to the league standings when the query parameter is gone, like with the back button', async () => {
    await load({standingsType: NhlStandingsTypeEnum.BY_DIVISION});
    expect(selectedFilter()).toBe('Division');
    await load();
    expect(component.currentStandingsType).toBe(NhlStandingsTypeEnum.BY_LEAGUE);
    expect(component.standings.map(group => group.title)).toEqual(['NHL']);
    expect(selectedFilter()).toBe('League');
  });

  it('should not change the URL when the selected filter is clicked', async () => {
    await load();
    fixture.nativeElement.querySelectorAll('.standings-type-filter')[0].click();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should show the filters without standings when the request fails', async () => {
    fixture.detectChanges();
    httpMock.expectOne(standingsUrl).flush('Server error', {status: 500, statusText: 'Internal Server Error'});
    await settle();
    expect(fixture.nativeElement.querySelector('.main-standings')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.standings-type-filter').length).toBe(4);
  });
});
