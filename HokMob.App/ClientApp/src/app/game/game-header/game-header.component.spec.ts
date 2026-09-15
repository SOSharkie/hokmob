import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GameLanding } from '@shared/models/nhl-web-api/gamecenter-landing.model';
import { SeriesStatus } from '@shared/models/nhl-web-api/common.model';
import { NhlPeriodTypeEnum } from '@shared/enums/nhl-period-type.enum';
import { DateTimeUtils } from '@shared/utils/date-time-utils';
import {
  derivedIntermissionLanding,
  derivedLiveLanding,
  mockGameLanding,
  mockPlayoffGame
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { GameHeaderComponent } from './game-header.component';

describe('GameHeaderComponent', () => {
  let component: GameHeaderComponent;
  let fixture: ComponentFixture<GameHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GameHeaderComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameHeaderComponent);
    component = fixture.componentInstance;
  });

  interface HeaderInputs {
    isDropdownHeader?: boolean;
    seriesStatus?: SeriesStatus;
    isIntermission?: boolean;
    intermissionTimeRemaining?: string;
  }

  function show(landing: GameLanding, inputs: HeaderInputs = {}): void {
    fixture.componentRef.setInput('landing', landing);
    fixture.componentRef.setInput('isDropdownHeader', inputs.isDropdownHeader ?? false);
    fixture.componentRef.setInput('seriesStatus', inputs.seriesStatus);
    fixture.componentRef.setInput('isIntermission', inputs.isIntermission ?? false);
    fixture.componentRef.setInput('intermissionTimeRemaining', inputs.intermissionTimeRemaining ?? '');
    fixture.detectChanges();
  }

  /** The normalized text of the first element matching the selector, or undefined if there is none. */
  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function teamNames(): string[] {
    return [text('.home-team-banner'), text('.away-team-banner')];
  }

  it('should show the teams, score and final status of a real regulation game', () => {
    show(mockGameLanding(2025021057));
    expect(teamNames()).toEqual(['Winnipeg Jets', 'St. Louis Blues']);
    expect(text('.game-score-label')).toBe('3 - 2');
    expect(text('.completed-status-label')).toBe('Final');
    expect(text('.live-status-label')).toBeUndefined();
    expect(text('.playoff-series-label')).toBeUndefined();
    expect(component.homeTeamId).toBe(52);
    expect(component.awayTeamId).toBe(19);
  });

  it('should show the common team names in the dropdown header', () => {
    show(mockGameLanding(2025021057), {isDropdownHeader: true});
    expect(teamNames()).toEqual(['Jets', 'Blues']);
  });

  it('should show Final SO for a real shootout game', () => {
    show(mockGameLanding(2025020952));
    expect(teamNames()).toEqual(['Anaheim Ducks', 'Calgary Flames']);
    expect(text('.game-score-label')).toBe('3 - 2');
    expect(text('.completed-status-label')).toBe('Final SO');
  });

  it('should number multiple overtimes in the final status', () => {
    const landing = mockGameLanding(2025030414);
    landing.periodDescriptor = {...landing.periodDescriptor, number: 6, periodType: NhlPeriodTypeEnum.OVERTIME};
    show(landing);
    expect(text('.completed-status-label')).toBe('Final 3OT');
  });

  it('should show the series status of a real playoff game', () => {
    show(mockGameLanding(2025030414), {seriesStatus: mockPlayoffGame().seriesStatus});
    expect(teamNames()).toEqual(['Vegas Golden Knights', 'Carolina Hurricanes']);
    expect(text('.game-score-label')).toBe('3 - 5');
    expect(text('.playoff-series-label')).toBe('Tied 2-2');
  });

  it('should show Series (0-0) before a series starts, and no series without its status', () => {
    const seriesStatus = {...mockPlayoffGame().seriesStatus, topSeedWins: 0, bottomSeedWins: 0};
    show(mockGameLanding(2025030414), {seriesStatus});
    expect(text('.playoff-series-label')).toBe('Series (0-0)');

    show(mockGameLanding(2025030414));
    expect(text('.playoff-series-label')).toBeUndefined();
  });

  it('should show the start time and day of a real future game', () => {
    const landing = mockGameLanding(2026020056);
    show(landing);
    expect(teamNames()).toEqual(['Boston Bruins', 'Utah Mammoth']);
    expect(text('.game-time-label')).toBe(dayjs(landing.startTimeUTC).format('h:mm A'));
    expect(text('.game-day-label')).toBe(DateTimeUtils.getDayDisplayValue(dayjs(landing.startTimeUTC).toDate()));
    expect(text('.game-score-label')).toBeUndefined();
  });

  it('should show the period and clock of a live game', () => {
    show(derivedLiveLanding());
    expect(text('.game-score-label')).toBe('2 - 0');
    expect(text('.live-status-label')).toBe('2nd - 5:32');
    expect(text('.completed-status-label')).toBeUndefined();
    expect(text('.intermission-countdown')).toBeUndefined();
  });

  it('should show the end of the period and the countdown during an intermission', () => {
    show(derivedIntermissionLanding(), {isIntermission: true, intermissionTimeRemaining: '16:40 till 2nd'});
    expect(text('.live-status-label')).toBe('End 1st');
    expect(text('.intermission-countdown')).toBe('16:40 till 2nd');
  });

  it('should show a 0 - 0 score while a live game has no score', () => {
    const landing = derivedLiveLanding();
    delete landing.homeTeam.score;
    delete landing.awayTeam.score;
    show(landing);
    expect(text('.game-score-label')).toBe('0 - 0');
  });

  it('should show placeholders without a game', () => {
    show(undefined);
    expect(teamNames()).toEqual(['N/A', 'N/A']);
    expect(text('.game-score')).toBeUndefined();
    expect(text('.game-day-time-container')).toBeUndefined();
    expect(component.homeTeamId).toBe(0);
  });
});
