import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute, Params, convertToParamMap } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { StatsUtils } from '@shared/utils/stats-utils';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { GamePlayer } from '@shared/models/nhl-web-api/boxscore.model';
import {
  MockGamecenterGameId,
  mockGameBoxscore,
  mockGameLanding,
  mockGamePlayByPlay
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { RatingsComponent, StatControl } from './ratings.component';
import { RatingStatLineUtils } from './rating-stat-line';

describe('RatingsComponent', () => {
  let component: RatingsComponent;
  let fixture: ComponentFixture<RatingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ RatingsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    spyOn(console, 'error');
    fixture = TestBed.createComponent(RatingsComponent);
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

  /** The waterfall's rows as [label, value]. */
  function termRows(): string[][] {
    return elements('.term-row').map(row => [
      row.querySelector('.term-name').textContent.trim(),
      row.querySelector('.term-value').textContent.trim()
    ]);
  }

  it('should open on the skater formula and show its rating and terms', () => {
    expect(component.subject).toBe('skater');
    expect(text('h1')).toBe('The HokMob Rating');
    expect(text('.title-badge')).toBe('How it works');
    expect(text('.rating-badge')).toBe(String(component.breakdown.rating));
    expect(termRows().map(row => row[0])).toEqual(['Base', 'Goals', 'Assists', 'Shots on goal', 'Hits',
      'Blocked shots', 'Takeaways', 'Penalty minutes', 'Penalties drawn', 'Plus/minus', 'Giveaways', 'Faceoffs']);
    expect(component.ratingContext.faceoffsTaken).toBe(component.skaterLine['faceoffsTaken']);
    expect(component.ratingContext.penaltiesDrawn).toBe(component.skaterLine['penaltiesDrawn']);
    expect(termRows()[0]).toEqual(['Base', '+5']);
    // The running totals are drawn as where the bars end, not written out
    expect(elements('.term-total').length).toBe(0);
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
    const terms = component.breakdown.terms;
    expect(terms[terms.length - 1].total).toBeCloseTo(component.breakdown.rawTotal, 5);
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

  it('should add 0.3 for a penalty drawn', () => {
    component.skaterLine['penaltiesDrawn'] = 0;
    step('Hits', 1);
    const before = component.breakdown.rawTotal;
    step('Penalties drawn', 1);
    expect(stepperValue('Penalties drawn')).toBe('1');
    expect(component.breakdown.rawTotal - before).toBeCloseTo(0.3, 10);
    expect(termRows().find(row => row[0] === 'Penalties drawn')).toBeDefined();
  });

  it('should rate the presets with the penalties drawn, and a fight as one drawn', () => {
    const heavyweight = component.skaterPresets.find(preset => preset.name === 'Heavyweight');
    expect(heavyweight.line['pim']).toBe(5);
    expect(heavyweight.line['penaltiesDrawn']).toBe(1);
    expect(component.skaterPresets.every(preset => preset.line['penaltiesDrawn'] != null)).toBeTrue();
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

  it('should show power play goals right below goals, and the assists as primary and secondary', () => {
    const labels = elements('.stat-name').map(name => name.textContent.trim());
    expect(labels.slice(0, 5)).toEqual(['Goals', 'Power play goals', 'Primary assists', 'Secondary assists',
      'Power play assists']);
    expect(labels).not.toContain('Assists');
  });

  it('should weight a primary assist above a secondary one', () => {
    // The page opens on one assist, a primary one
    expect(component.assists).toBe(1);
    expect(component.breakdown.terms[2].value).toBe(0.6);

    step('Primary assists', -1);
    step('Secondary assists', 1);
    expect(component.assists).toBe(1);
    expect(component.breakdown.terms[2].value).toBe(0.4);
    expect(component.breakdown.terms[2].detail).toBe('0 primary x 0.6 + 1 secondary x 0.4');

    step('Secondary assists', 1);
    expect(component.assists).toBe(2);
    expect(component.breakdown.terms[2].value).toBe(0.8);
  });

  it('should never let a power play assist outnumber the assists', () => {
    component.skaterLine['primaryAssists'] = 1;
    component.skaterLine['secondaryAssists'] = 1;
    component.skaterLine['powerPlayAssists'] = 2;
    fixture.detectChanges();
    step('Secondary assists', -1);
    expect(stepperValue('Power play assists')).toBe('1');
    const powerPlayAssists = component.skaterControls.find(control => control.key === 'powerPlayAssists') as StatControl;
    expect(component.isStepDisabled(powerPlayAssists, 1)).toBeTrue();

    step('Primary assists', -1);
    expect(stepperValue('Power play assists')).toBe('0');
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

    component.skaterLine = {goals: 0, primaryAssists: 0, secondaryAssists: 0, powerPlayAssists: 0, sog: 0,
      hits: 0, blockedShots: 0, takeaways: 0, giveaways: 9, pim: 20, plusMinus: -5, powerPlayGoals: 0,
      faceoffsTaken: 0, faceoffWins: 0};
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

  it("should put a term's value right after its bar, or before it when the bar ends at the chart's edge", () => {
    // The base ends at 5, well inside the chart
    const base = component.breakdown.terms[0];
    expect(component.getBarEnd(base, 0)).toBe(component.getBarStart(base, 0) + component.getBarWidth(base, 0));
    expect(component.isValueBeforeBar(base, 0)).toBeFalse();
    expect(parseFloat(elements('.term-value')[0].style.left)).toBeCloseTo(component.getBarEnd(base, 0), 3);
    expect(elements('.term-value')[0].classList).not.toContain('before-bar');

    // A hat trick runs past 10, so on a phone-sized plot the bar that ends furthest right has no room after it
    component.selectPreset(component.skaterPresets.find(preset => preset.name === 'Hat trick'));
    component.plotWidth = 300;
    fixture.detectChanges();
    const terms = component.breakdown.terms;
    const ends = terms.map((term, index) => component.getBarEnd(term, index));
    const furthest = ends.indexOf(Math.max(...ends));
    expect(component.isValueBeforeBar(terms[furthest], furthest)).toBeTrue();
    const value = elements('.term-value')[furthest];
    expect(value.classList).toContain('before-bar');
    expect(parseFloat(value.style.left)).toBeCloseTo(component.getBarStart(terms[furthest], furthest), 3);
  });

  it("should move a value before its bar once the plot is too narrow to fit it after", () => {
    // First star: the faceoffs bar ends at 8.5 of 10
    const terms = component.breakdown.terms;
    const last = terms.length - 1;
    const room = (width: number) => (100 - component.getBarEnd(terms[last], last)) / 100 * width;
    expect(component.plotWidth).toBeGreaterThan(0);

    component.plotWidth = 1000;
    expect(room(1000)).toBeGreaterThan(RatingsComponent.valueAfterBarRoom);
    expect(component.isValueBeforeBar(terms[last], last)).toBeFalse();

    component.plotWidth = 200;
    expect(room(200)).toBeLessThan(RatingsComponent.valueAfterBarRoom);
    expect(component.isValueBeforeBar(terms[last], last)).toBeTrue();

    // Not laid out yet: only a bar that runs to the edge
    component.plotWidth = 0;
    expect(component.isValueBeforeBar(terms[last], last)).toBeFalse();
  });

  it('should switch to the goalie formula and its stat line', () => {
    elements('.toggle-option').find(button => button.textContent.trim() === 'Goalie').click();
    fixture.detectChanges();

    expect(component.subject).toBe('goalie');
    expect(termRows().map(row => row[0])).toEqual(['Base', 'Even strength saves', 'Penalty kill saves',
      'Power play saves', 'Goals against']);
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

describe('RatingsComponent opened on a game stat line', () => {
  let fixture: ComponentFixture<RatingsComponent>;
  const route = {snapshot: {queryParamMap: convertToParamMap({})}};

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ RatingsComponent ],
      providers: [ {provide: ActivatedRoute, useValue: route} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  /** Opens the page with the query parameters a game page's player dialog links to. */
  function open(queryParams: Params): RatingsComponent {
    fixture?.destroy();
    route.snapshot.queryParamMap = convertToParamMap(queryParams);
    fixture = TestBed.createComponent(RatingsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  /** The players of a game as the game page builds them, with the play-by-play and landing loaded. */
  function gamePlayers(gameId: MockGamecenterGameId = 2025021057): GamePlayer[] {
    const playByPlay = mockGamePlayByPlay(gameId);
    const faceoffCounts = PlayByPlayUtils.getFaceoffCounts(playByPlay);
    const assistCounts = StatsUtils.getAssistCounts(mockGameLanding(gameId));
    const penaltiesDrawnCounts = PlayByPlayUtils.getPenaltiesDrawnCounts(playByPlay);
    return [true, false].flatMap(isHome => StatsUtils.getGamePlayers(mockGameBoxscore(gameId), isHome,
        PlayByPlayUtils.getRosterSpotMap(playByPlay), faceoffCounts, assistCounts, penaltiesDrawnCounts));
  }

  it("should load a skater's line from the game, and show who it came from", () => {
    const scheifele = gamePlayers().find(player => player.playerId === 8476460);
    const component = open(RatingStatLineUtils.getQueryParams(scheifele));

    expect(component.subject).toBe('skater');
    expect(component.skaterLine['goals']).toBe(scheifele.skaterStats.goals);
    expect(component.skaterLine['sog']).toBe(scheifele.skaterStats.sog);
    expect(fixture.nativeElement.querySelector('.game-stat-line').textContent)
        .toContain('Mark Scheifele, rated ' + scheifele.hokmobRating + ' on the game page');
    expect(fixture.nativeElement.querySelectorAll('.preset-button.selected').length).toBe(0);
  });

  it('should rate every player of the game exactly as the game page did', () => {
    const players = gamePlayers();
    expect(players.length).toBeGreaterThan(30);
    players.forEach(player => {
      const component = open(RatingStatLineUtils.getQueryParams(player));
      expect(component.subject).withContext(player.name).toBe(player.goalieStats ? 'goalie' : 'skater');
      expect(component.breakdown.rating).withContext(player.name).toBe(player.hokmobRating);
    });
  });

  it('should show the penalties a skater drew in the game', () => {
    // Eichel drew an interference minor in game 4 of the final.
    const eichel = gamePlayers(2025030414).find(player => player.playerId === 8478403);
    const component = open(RatingStatLineUtils.getQueryParams(eichel));
    expect(component.skaterLine['penaltiesDrawn']).toBe(1);
    const term = component.breakdown.terms.find(ratingTerm => ratingTerm.label === 'Penalties drawn');
    expect(term.detail).toBe('1 x 0.3');
    expect(term.value).toBe(0.3);
    expect(component.breakdown.rating).toBe(eichel.hokmobRating);
  });

  it('should read a missing or unreadable stat as 0', () => {
    const component = open({subject: 'goalie', evenStrengthShots: '12', evenStrengthGoals: 'x'});
    expect(component.subject).toBe('goalie');
    expect(component.goalieLine['evenStrengthShots']).toBe(12);
    expect(component.goalieLine['evenStrengthGoals']).toBe(0);
    expect(component.goalieLine['penaltyKillShots']).toBe(0);
    expect(fixture.nativeElement.querySelector('.game-stat-line').textContent).toContain('A player');
    expect(fixture.nativeElement.querySelector('.game-stat-line').textContent).not.toContain('rated');
  });

  /** Opens the page on Mark Scheifele's line from 2025021057, and watches the address it leaves behind. */
  function openScheifele(): {component: RatingsComponent, replaceState: jasmine.Spy} {
    const component = open(RatingStatLineUtils.getQueryParams(
        gamePlayers().find(player => player.playerId === 8476460)));
    return {component, replaceState: spyOn(TestBed.inject(Location), 'replaceState')};
  }

  function gameStatLineText(): string {
    return fixture.nativeElement.querySelector('.game-stat-line')?.textContent.trim();
  }

  function click(selector: string, label?: string): void {
    (Array.from(fixture.nativeElement.querySelectorAll(selector)) as HTMLElement[])
        .find(element => label == null || element.textContent.trim() === label).click();
    fixture.detectChanges();
  }

  it("should forget the game's stat line once it is cleared", () => {
    const {component, replaceState} = openScheifele();
    expect(gameStatLineText()).toContain('Mark Scheifele');

    click('.clear-button');
    expect(component.gameStatLine).toBeUndefined();
    expect(gameStatLineText()).toBeUndefined();
    // Reloading shouldn't bring it back
    expect(replaceState).toHaveBeenCalledOnceWith(jasmine.stringMatching(/^[^?]*$/));
  });

  it("should forget the game's stat line once a preset replaces it", () => {
    const {component, replaceState} = openScheifele();
    click('.preset-button', 'Hat trick');
    expect(component.skaterLine['goals']).toBe(3);
    expect(gameStatLineText()).toBeUndefined();
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it("should keep the game's stat line while it is edited stat by stat", () => {
    const {replaceState} = openScheifele();
    click('.stat-control:first-child .stepper-button:last-child');
    expect(gameStatLineText()).toContain('Mark Scheifele');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("should only say where the stat line came from on its own formula", () => {
    const {component, replaceState} = openScheifele();
    click('.toggle-option', 'Goalie');
    expect(gameStatLineText()).toBeUndefined();

    // A goalie preset doesn't replace the skater's line from the game
    click('.preset-button', 'Shutout');
    click('.toggle-option', 'Skater');
    expect(component.gameStatLine).toBeDefined();
    expect(gameStatLineText()).toContain('Mark Scheifele');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('should open on the first preset without a known formula', () => {
    const component = open({subject: 'referee', goals: '4'});
    expect(component.subject).toBe('skater');
    expect(component.skaterLine).toEqual(component.skaterPresets[0].line);
    expect(component.gameStatLine).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.game-stat-line')).toBeNull();
  });
});
