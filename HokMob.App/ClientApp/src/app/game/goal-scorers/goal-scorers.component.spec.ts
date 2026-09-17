import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GameLandingScoringPeriod } from '@shared/models/nhl-web-api/gamecenter-landing.model';
import { PlayerHighlight } from '@shared/models/player-highlight.model';
import { mockGameLanding } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { GoalScorersComponent } from './goal-scorers.component';

describe('GoalScorersComponent', () => {
  let component: GoalScorersComponent;
  let fixture: ComponentFixture<GoalScorersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GoalScorersComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalScorersComponent);
    component = fixture.componentInstance;
  });

  function show(scoring: GameLandingScoringPeriod[]): void {
    fixture.componentRef.setInput('scoring', scoring);
    fixture.detectChanges();
  }

  function normalize(element: Element): string {
    return element.textContent.replace(/\s+/g, ' ').trim();
  }

  /** Each period row as [home goals, period label, away goals]. */
  function rows(): string[][] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.period-goals')).map((row: Element) => [
      normalize(row.querySelector('.home-goals-label')),
      normalize(row.querySelector('.period-label')),
      normalize(row.querySelector('.away-goals-label'))
    ]);
  }

  it('should list the goals of a real regulation game by period and team', () => {
    show(mockGameLanding(2025021057).summary.scoring);
    expect(rows()).toEqual([
      ['Fleury (2:31), Scheifele (7:51)', '1st', ''],
      ['', '2nd', ''],
      ['Connor (11:53)', '3rd', 'Dvorsky (5:17), Holloway (19:09)']
    ]);
  });

  it('should show the goalless overtime but not the shootout of a real shootout game', () => {
    show(mockGameLanding(2025020952).summary.scoring);
    expect(rows()).toEqual([
      ['', '1st', 'Farabee (9:41)'],
      ['Gauthier (11:14)', '2nd', 'Sharangovich (16:10)'],
      ['Gauthier (10:41)', '3rd', ''],
      ['', 'OT', '']
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('McTavish');
  });

  it('should label multiple overtimes', () => {
    const scoring = mockGameLanding(2025020952).summary.scoring.slice(0, 4);
    const overtime = scoring[3];
    scoring.push({...overtime, periodDescriptor: {...overtime.periodDescriptor, number: 5}, goals: [scoring[1].goals[0]]});
    show(scoring);
    expect(rows()[4]).toEqual(['Gauthier (11:14)', '2OT', '']);
  });

  it('should emit the scorer ID when a goal is clicked', () => {
    const clickedIds: number[] = [];
    component.scorerClicked.subscribe(playerId => clickedIds.push(playerId));
    show(mockGameLanding(2025021057).summary.scoring);
    const scorers = fixture.nativeElement.querySelectorAll('.scorer-label');
    expect(scorers.length).toBe(5);
    scorers[1].click();
    scorers[4].click();
    expect(clickedIds).toEqual([8476460, 8482077]);
  });

  it('should show no periods without scoring data', () => {
    show(undefined);
    expect(rows()).toEqual([]);
    show([]);
    expect(rows()).toEqual([]);
  });

  it('should show a period without a goals list as empty', () => {
    const scoring = mockGameLanding(2025021057).summary.scoring;
    delete scoring[0].goals;
    show(scoring);
    expect(rows()[0]).toEqual(['', '1st', '']);
  });

  it("should emit the scorer and the goal's index among their goals in this game on hover, and null on leave", () => {
    const hovered: PlayerHighlight[] = [];
    component.playerHovered.subscribe(highlight => hovered.push(highlight));
    show(mockGameLanding(2025030414).summary.scoring);
    const staalGoals = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.scorer-label'))
        .filter(scorer => scorer.textContent.includes('Staal'));
    expect(staalGoals.length).toBe(2);
    staalGoals[1].dispatchEvent(new MouseEvent('mouseenter'));
    staalGoals[1].dispatchEvent(new MouseEvent('mouseleave'));
    staalGoals[0].dispatchEvent(new MouseEvent('mouseenter'));
    expect(hovered).toEqual([{playerId: 8473533, goalIndex: 1}, null, {playerId: 8473533, goalIndex: 0}]);
  });

  it("should index a goal among the scorer's goals in this game, not by their season total", () => {
    const hovered: PlayerHighlight[] = [];
    component.playerHovered.subscribe(highlight => hovered.push(highlight));
    const scoring = mockGameLanding(2025020952).summary.scoring;
    show(scoring);
    const gauthierGoals = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.scorer-label'))
        .filter(scorer => scorer.textContent.includes('Gauthier'));
    gauthierGoals.forEach(scorer => scorer.dispatchEvent(new MouseEvent('mouseenter')));
    expect(hovered).toEqual([{playerId: 8483445, goalIndex: 0}, {playerId: 8483445, goalIndex: 1}]);
    expect(scoring[2].goals[0].goalsToDate).not.toBe(2);
  });
});
