import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlStandingsTypeEnum } from '@shared/enums/nhl-standings-type.enum';
import { StandingsGroup } from '@shared/models/nhl-web-api/standings.model';
import { mockStandingsResponse } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamStandingsComponent } from './team-standings.component';

describe('TeamStandingsComponent', () => {
  let component: TeamStandingsComponent;
  let fixture: ComponentFixture<TeamStandingsComponent>;
  let httpMock: HttpTestingController;

  const standingsUrl = '/api/nhl/standings/now';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamStandingsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamStandingsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Opens the tab for Boston with a standings type (the default without one) and answers with the real standings. */
  async function open(standingsType?: NhlStandingsTypeEnum): Promise<void> {
    fixture.componentRef.setInput('teamId', 6);
    if (standingsType) {
      fixture.componentRef.setInput('standingsType', standingsType);
    }
    fixture.detectChanges();
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    await settle();
  }

  function standingsElement(): any {
    return fixture.nativeElement.querySelector('app-standings');
  }

  function groupTitles(): string[] {
    return (standingsElement().standings as StandingsGroup[]).map(group => group.title);
  }

  function filterButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.standings-type-filter'));
  }

  it('should show every division by default, with the team highlighted', async () => {
    await open();
    expect(component.standingsType).toBe(NhlStandingsTypeEnum.BY_DIVISION);
    expect(groupTitles()).toEqual(['Atlantic Division', 'Metropolitan Division', 'Central Division', 'Pacific Division']);
    expect(standingsElement().selectedTeamId).toBe(6);
    expect(standingsElement().defaultStandingsType).toBe(NhlStandingsTypeEnum.BY_DIVISION);
    expect(standingsElement().showFormAndNext).toBeTrue();
    expect(fixture.nativeElement.querySelector('.selected-filter').textContent.trim()).toBe('Division');
  });

  it('should show the standings type it is given', async () => {
    await open(NhlStandingsTypeEnum.BY_CONFERENCE);
    expect(groupTitles()).toEqual(['Eastern Conference', 'Western Conference']);
    expect(fixture.nativeElement.querySelector('.selected-filter').textContent.trim()).toBe('Conference');
    expect(fixture.nativeElement.querySelector('.selected-filter').getAttribute('aria-pressed')).toBe('true');
  });

  it('should have the standings page\'s four filters', async () => {
    await open();
    expect(filterButtons().map(button => button.textContent.trim()))
        .toEqual(['League', 'Conference', 'Division', 'Playoffs']);
  });

  it('should ask for another type, and load it once it comes back in', async () => {
    await open();
    const emitted: NhlStandingsTypeEnum[] = [];
    component.standingsTypeChange.subscribe(type => emitted.push(type));

    filterButtons()[0].click();
    expect(emitted).toEqual([NhlStandingsTypeEnum.BY_LEAGUE]);
    httpMock.expectNone(standingsUrl);

    fixture.componentRef.setInput('standingsType', NhlStandingsTypeEnum.BY_LEAGUE);
    fixture.detectChanges();
    expect(standingsElement()).toBeNull();
    httpMock.expectOne(standingsUrl).flush(mockStandingsResponse());
    await settle();
    expect(groupTitles()).toEqual(['NHL']);
  });

  it('should not ask for the type it already shows', async () => {
    await open();
    const emitSpy = spyOn(component.standingsTypeChange, 'emit');
    filterButtons()[2].click();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should show a message when the standings fail', async () => {
    fixture.componentRef.setInput('teamId', 6);
    fixture.detectChanges();
    httpMock.expectOne(standingsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();
    expect(standingsElement()).toBeNull();
    expect(fixture.nativeElement.querySelector('.team-standings-message').textContent.trim())
        .toBe('The standings couldn\'t be loaded');
  });

  it('should ignore a slow response of a type it no longer shows', async () => {
    fixture.componentRef.setInput('teamId', 6);
    fixture.detectChanges();
    const divisionRequest = httpMock.expectOne(standingsUrl);
    fixture.componentRef.setInput('standingsType', NhlStandingsTypeEnum.BY_CONFERENCE);
    fixture.detectChanges();
    const conferenceRequest = httpMock.match(standingsUrl);
    conferenceRequest.forEach(request => request.flush(mockStandingsResponse()));
    await settle();
    divisionRequest.flush(mockStandingsResponse());
    await settle();
    expect(groupTitles()).toEqual(['Eastern Conference', 'Western Conference']);
  });
});
