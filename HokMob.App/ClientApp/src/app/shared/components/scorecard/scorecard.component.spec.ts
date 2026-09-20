import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import * as dayjs from 'dayjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ScoreGame } from '@shared/models/nhl-web-api/score.model';
import { NhlGameScheduleStateEnum } from '@shared/enums/nhl-game-schedule-state.enum';
import { DateTimeUtils } from '@shared/utils/date-time-utils';
import {
  derivedLiveGame,
  derivedScheduleStateGame,
  mockLiveScoreResponse,
  mockFutureGame,
  mockOvertimeFinal,
  mockPlayoffGame,
  mockPreseasonGame,
  mockRegulationFinal,
  mockShootoutFinal
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { ScorecardComponent } from './scorecard.component';

describe('ScorecardComponent', () => {
  let component: ScorecardComponent;
  let fixture: ComponentFixture<ScorecardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ ScorecardComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScorecardComponent);
    component = fixture.componentInstance;
  });

  function render(game: ScoreGame, smallerScorecard = false): string {
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('smallerScorecard', smallerScorecard);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  /** A side's app-team-logo. It isn't declared here, so its inputs are read off the element. */
  function logo(side: string): HTMLElement & {teamId: number} {
    return fixture.nativeElement.querySelector(side + ' app-team-logo');
  }

  /** The preseason or playoff label, or undefined when the scorecard has none. */
  function label(): string {
    return fixture.nativeElement.querySelector('.game-type-label')?.textContent.trim();
  }

  it('should show full team names, logos, the score and Final for a regulation final', () => {
    const text = render(mockRegulationFinal());
    expect(component.completedGame).toBeTrue();
    expect(text).toContain('Pittsburgh Penguins');
    expect(text).toContain('Vegas Golden Knights');
    expect(text).toContain('5 - 0');
    expect(text).toContain('Final');
    expect(logo('.home-team').teamId).toBe(5);
    expect(logo('.away-team').teamId).toBe(54);
  });

  it('should link to the game page by game ID', () => {
    render(mockRegulationFinal());
    const routerLink = fixture.debugElement.query(By.css('.scorecard-container')).injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/game/2025020947');
  });

  it('should label overtime and shootout finals', () => {
    expect(render(mockOvertimeFinal())).toContain('2 - 1');
    expect(component.completedGameStatus).toBe('OT');
    expect(render(mockShootoutFinal())).toContain('3 - 2');
    expect(component.completedGameStatus).toBe('SO');
  });

  it('should show the series status only for playoff games', () => {
    const text = render(mockPlayoffGame());
    expect(component.isPlayoffGame).toBeTrue();
    expect(text).toContain('Tied 2-2');
    expect(text).toContain('3 - 5');

    render(mockRegulationFinal());
    expect(component.isPlayoffGame).toBeFalse();
    expect(fixture.nativeElement.querySelector('.playoff-series')).toBeNull();
  });

  it('should not show a series status for a playoff game without one', () => {
    const game = mockPlayoffGame();
    delete game.seriesStatus;
    render(game);
    expect(component.isPlayoffGame).toBeFalse();
  });

  it('should mark a real preseason game', () => {
    const text = render(mockPreseasonGame());
    expect(text).toContain('St. Louis Blues');
    expect(text).toContain('Dallas Stars');
    expect(component.gameTypeLabel).toBe('PRE');
    expect(label()).toBe('PRE');
  });

  it('should mark a playoff game without a series status, and show the status when there is one', () => {
    const playoffGame = mockPlayoffGame();
    delete playoffGame.seriesStatus;
    render(playoffGame);
    expect(label()).toBe('PLAYOFFS');

    render(mockPlayoffGame());
    expect(component.gameTypeLabel).toBe('');
    expect(label()).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.playoff-series').textContent).toContain('Tied 2-2');
  });

  it('should not label a regular season game', () => {
    render(mockRegulationFinal());
    expect(component.gameTypeLabel).toBe('');
    expect(label()).toBeUndefined();
  });

  it('should show the start time of a future game, including Utah', () => {
    const game = mockFutureGame();
    const text = render(game);
    expect(component.futureGame).toBeTrue();
    expect(text).toContain('Boston Bruins');
    expect(text).toContain('Utah Mammoth');
    expect(text).toContain(dayjs(game.startTimeUTC).format('h:mm'));
    expect(component.gameAmPm).toBe(dayjs(game.startTimeUTC).format('A'));
    expect(fixture.nativeElement.querySelector('.game-score')).toBeNull();
  });

  it('should also show the date in the smaller scorecard', () => {
    const game = mockFutureGame();
    const text = render(game, true);
    expect(text).toContain(DateTimeUtils.getDateDisplayValue(dayjs(game.startTimeUTC).toDate()));
  });

  it('should show TBD and postponed games without a date or time', () => {
    render(derivedScheduleStateGame(NhlGameScheduleStateEnum.TBD), true);
    expect([component.gameTime, component.gameDate, component.gameAmPm]).toEqual(['TBD', '', '']);

    render(derivedScheduleStateGame(NhlGameScheduleStateEnum.POSTPONED), true);
    expect([component.gameTime, component.gameDate, component.gameAmPm]).toEqual(['Postponed', '', '']);
  });

  it('should show the score, period and clock of a live game', () => {
    const text = render(derivedLiveGame());
    expect(component.liveGame).toBeTrue();
    expect(text).toContain('5 - 0');
    expect(text).toContain('2nd - 5:32');
  });

  it('should show the period and clock of a captured live game', () => {
    const [live, intermission] = mockLiveScoreResponse().games;

    let text = render(live);
    expect(component.liveGame).toBeTrue();
    expect(text).toContain('1 - 2');
    expect(text).toContain('3rd - 20:00');

    // The same response has a game in an intermission, labelled with the period that just ended
    text = render(intermission);
    expect(intermission.clock.inIntermission).toBeTrue();
    expect(text).toContain('End 2nd');
  });

  it('should fall back to the API common name for an unknown team', () => {
    const game = mockRegulationFinal();
    game.homeTeam.id = 999;
    render(game);
    expect(component.homeTeamName).toBe('Penguins');
  });

  it('should emit when clicked', () => {
    render(mockRegulationFinal());
    spyOn(component.scorecardClicked, 'emit');
    component.clickScorecard(new MouseEvent('click'));
    expect(component.scorecardClicked.emit).toHaveBeenCalledWith(true);
  });
});
