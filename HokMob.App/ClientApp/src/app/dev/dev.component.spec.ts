import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { StatsUtils } from '@shared/utils/stats-utils';

import { DevComponent, StatControl } from './dev.component';

describe('DevComponent', () => {
  let component: DevComponent;
  let fixture: ComponentFixture<DevComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ DevComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    spyOn(console, 'error');
    fixture = TestBed.createComponent(DevComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function elements(selector: string): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector));
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.trim();
  }

  /** The stepper of a stat, by its label. */
  function stepper(label: string): HTMLElement {
    return elements('.stat-control')
        .find(control => control.querySelector('.stat-name').textContent.trim() === label);
  }

  /** Clicks a stat's plus or minus button. */
  function step(label: string, change: number): void {
    const buttons = stepper(label).querySelectorAll('.stepper-button');
    (buttons[change < 0 ? 0 : 1] as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  /** The value showing in a stat's stepper. */
  function stepperValue(label: string): string {
    return stepper(label).querySelector('.stepper-value').textContent.trim();
  }

  /** The waterfall's rows as [label, value, running total]. */
  function termRows(): string[][] {
    return elements('.term-row').map(row => [
      row.querySelector('.term-name').textContent.trim(),
      row.querySelector('.term-value').textContent.trim(),
      row.querySelector('.term-total').textContent.trim()
    ]);
  }

  it('should open on the skater formula and show its rating and terms', () => {
    expect(component.subject).toBe('skater');
    expect(text('.dev-headline')).toBe('Dev');
    expect(text('.rating-badge')).toBe(String(component.breakdown.rating));
    expect(termRows().map(row => row[0])).toEqual(['Base', 'Goals', 'Assists', 'Shots on goal', 'Hits',
      'Blocked shots', 'Takeaways', 'Penalty minutes', 'Plus/minus', 'Giveaways', 'Faceoffs']);
    expect(component.ratingContext.faceoffsTaken).toBe(component.skaterLine['faceoffsTaken']);
    expect(termRows()[0]).toEqual(['Base', '+5', '5.0']);
  });

  it('should open on a preset stat line, with its button already picked', () => {
    expect(component.skaterLine).toEqual(component.skaterPresets[0].line);
    expect(elements('.preset-button.selected').map(button => button.textContent.trim())).toEqual(['First star']);

    component.selectSubject('goalie');
    fixture.detectChanges();
    expect(component.goalieLine).toEqual(component.goaliePresets[0].line);
    expect(elements('.preset-button.selected').map(button => button.textContent.trim())).toEqual(['Routine win']);
  });

  it('should not hand the preset its own object, so editing the line leaves the preset alone', () => {
    const averageNight = {...component.skaterPresets[0].line};
    step('Goals', 1);
    expect(component.skaterPresets[0].line).toEqual(averageNight);
  });

  it('should clear every stat, leaving a skater on the base 5', () => {
    const clear = () => elements('.clear-button')[0] as HTMLButtonElement;
    expect(clear().disabled).toBeFalse();

    clear().click();
    fixture.detectChanges();
    expect(Object.values(component.skaterLine).every(value => value === 0)).toBeTrue();
    expect(component.breakdown.rating).toBe(5);
    expect(text('.rating-badge')).toBe('5');
    expect(elements('.preset-button.selected').length).toBe(0);
    // Nothing left to clear
    expect(clear().disabled).toBeTrue();
  });

  it('should clear a goalie to the 0 a goalie who faced no shots is rated', () => {
    component.selectSubject('goalie');
    fixture.detectChanges();

    (elements('.clear-button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.breakdown.rating).toBe(0);
    expect(text('.rating-note')).toContain('Faced no shots');
    // The skater's line is untouched behind it
    expect(component.skaterLine).toEqual(component.skaterPresets[0].line);
  });

  it('should color the rating badge the way a game page does', () => {
    const badge = fixture.nativeElement.querySelector('.rating-badge') as HTMLElement;
    expect(component.ratingColor).toBe(StatsUtils.getHokmobRatingColor(component.breakdown.rating));
    expect(badge.style.backgroundColor).toBeTruthy();
  });

  it('should end the last term on the raw total, which the rating comes from', () => {
    const rows = termRows();
    expect(rows[rows.length - 1][2]).toBe(component.breakdown.rawTotal.toFixed(1));
    // The rating keeps one decimal and the terms two, so they only agree to a tenth
    expect(Math.abs(component.breakdown.rating - component.breakdown.rawTotal)).toBeLessThan(0.1);
  });

  it('should raise the rating when a goal is added', () => {
    const before = component.breakdown.rating;
    step('Goals', 1);
    expect(component.skaterLine['goals']).toBe(2);
    expect(component.breakdown.rating).toBeGreaterThan(before);
    expect(text('.rating-badge')).toBe(String(component.breakdown.rating));
  });

  it('should lower the rating when a giveaway is added', () => {
    const before = component.breakdown.rating;
    step('Giveaways', 1);
    expect(component.breakdown.rating).toBeLessThan(before);
  });

  it('should keep the stat line consistent: a goal is a shot, and a power play goal is a goal', () => {
    component.skaterLine['sog'] = 1;
    component.skaterLine['goals'] = 1;
    step('Goals', 1);
    expect(stepperValue('Shots on goal')).toBe('2');

    step('Shots on goal', -1);
    expect(stepperValue('Goals')).toBe('1');

    component.skaterLine['powerPlayGoals'] = 1;
    component.skaterLine['goals'] = 1;
    step('Goals', -1);
    expect(stepperValue('Power play goals')).toBe('0');
  });

  it('should never let more faceoffs be won than were taken', () => {
    component.skaterLine['faceoffsTaken'] = 3;
    component.skaterLine['faceoffWins'] = 3;
    step('Faceoffs taken', -1);
    expect(stepperValue('Faceoffs won')).toBe('2');
  });

  it('should stop a stepper at the end of its range', () => {
    const goals = component.skaterControls.find(control => control.key === 'goals') as StatControl;
    component.skaterLine['goals'] = goals.min;
    expect(component.isStepDisabled(goals, -1)).toBeTrue();
    expect(component.isStepDisabled(goals, 1)).toBeFalse();

    component.skaterLine['goals'] = goals.max;
    expect(component.isStepDisabled(goals, 1)).toBeTrue();
  });

  it('should weight a primary assist above a secondary one', () => {
    // The page opens on one assist, a primary one
    expect(component.secondaryAssists).toBe(0);
    expect(component.breakdown.terms[2].value).toBe(0.6);

    step('Primary assists', -1);
    expect(component.secondaryAssists).toBe(1);
    expect(component.breakdown.terms[2].value).toBe(0.4);
    expect(component.breakdown.terms[2].detail).toBe('0 primary x 0.6 + 1 secondary x 0.4');

    step('Assists', 1);
    expect(component.secondaryAssists).toBe(2);
    expect(component.breakdown.terms[2].value).toBe(0.8);
  });

  it('should never let a primary or power play assist outnumber the assists', () => {
    component.skaterLine['assists'] = 2;
    component.skaterLine['primaryAssists'] = 2;
    component.skaterLine['powerPlayAssists'] = 2;
    step('Assists', -1);
    expect(stepperValue('Primary assists')).toBe('1');
    expect(stepperValue('Power play assists')).toBe('1');
    expect(component.isStepDisabled(component.skaterControls[2], 1)).toBeTrue();
  });

  it('should load a preset stat line and mark it as picked', () => {
    const hatTrick = component.skaterPresets.find(preset => preset.name === 'Hat trick');
    elements('.preset-button').find(button => button.textContent.trim() === 'Hat trick').click();
    fixture.detectChanges();

    expect(component.skaterLine['goals']).toBe(3);
    expect(component.isPresetSelected(hatTrick)).toBeTrue();
    expect(elements('.preset-button.selected').map(button => button.textContent.trim())).toEqual(['Hat trick']);
    expect(component.breakdown.rating).toBe(10);
    expect(component.breakdown.clampNote).toBe('Capped at 10');
    expect(text('.rating-note')).toContain('Capped at 10');
  });

  it('should cover 0 to 10, and widen past either end when the rating runs off it', () => {
    expect(component.axisMin).toBe(0);
    expect(component.axisMax).toBe(10);

    component.skaterLine = {goals: 0, assists: 0, sog: 0, hits: 0, blockedShots: 0, takeaways: 0, giveaways: 9,
      pim: 20, plusMinus: -5, powerPlayGoals: 0, faceoffsTaken: 0, faceoffWins: 0};
    step('Giveaways', 1);
    expect(component.breakdown.rating).toBeLessThan(0);
    expect(component.axisMin).toBe(-3);
    expect(component.axisMax).toBe(10);
    expect(component.axisTicks[0]).toBe(-3);
    expect(component.axisTicks[component.axisTicks.length - 1]).toBe(10);

    component.selectPreset(component.skaterPresets.find(preset => preset.name === 'Hat trick'));
    fixture.detectChanges();
    expect(component.breakdown.rawTotal).toBeGreaterThan(10);
    expect(component.axisMax).toBe(Math.ceil(Math.max(...component.breakdown.terms.map(term => term.total))));
    expect(component.axisMax).toBeGreaterThan(10);
  });

  it('should place a term bar between the running totals it spans', () => {
    const terms = component.breakdown.terms;
    // The base runs from 0 to 5
    expect(component.getBarStart(terms[0], 0)).toBe(component.getAxisPercent(0));
    expect(component.getBarWidth(terms[0], 0))
        .toBeCloseTo(component.getAxisPercent(5) - component.getAxisPercent(0), 5);
    // Every other bar starts where the one before it ended
    expect(component.getBarStart(terms[1], 1)).toBe(component.getAxisPercent(Math.min(terms[0].total, terms[1].total)));
  });

  it('should switch to the goalie formula and its stat line', () => {
    elements('.toggle-option').find(button => button.textContent.trim() === 'Goalie').click();
    fixture.detectChanges();

    expect(component.subject).toBe('goalie');
    expect(termRows().map(row => row[0])).toEqual(['Base', 'Even strength saves', 'Penalty kill saves',
      'Goals against']);
    expect(stepperValue('Even strength shots')).toBe('22');
  });

  it('should rate a goalie who faced no shots 0', () => {
    component.selectSubject('goalie');
    component.selectPreset(component.goaliePresets.find(preset => preset.name === 'Never faced a shot'));
    fixture.detectChanges();

    expect(component.breakdown.rating).toBe(0);
    expect(text('.rating-badge')).toBe('0');
    expect(text('.rating-note')).toContain('Faced no shots');
  });

  it('should never let a goalie give up more goals than the shots he faced', () => {
    component.selectSubject('goalie');
    component.goalieLine['evenStrengthShots'] = 2;
    component.goalieLine['evenStrengthGoals'] = 2;
    fixture.detectChanges();

    step('Even strength shots', -1);
    expect(stepperValue('Even strength goals against')).toBe('1');
  });

  it('should sign a term value, and read nothing as 0', () => {
    expect(component.getSignedValue(2.2)).toBe('+2.2');
    expect(component.getSignedValue(-0.75)).toBe('-0.75');
    expect(component.getSignedValue(3)).toBe('+3');
    expect(component.getSignedValue(0)).toBe('0');
  });

  it('should list the formula quirks', () => {
    expect(elements('.quirk-list li').length).toBe(component.quirks.length);
    expect(console.error).not.toHaveBeenCalled();
  });
});
