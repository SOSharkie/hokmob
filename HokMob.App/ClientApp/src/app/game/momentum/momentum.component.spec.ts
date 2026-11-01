import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { Chart } from 'chart.js';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayByPlay } from '@shared/models/nhl-web-api/play-by-play.model';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import {
  derivedLivePlayByPlay,
  MockGamecenterGameId,
  mockGamePlayByPlay
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { MomentumChartView, MomentumComponent } from './momentum.component';

describe('MomentumComponent', () => {
  let component: MomentumComponent;
  let fixture: ComponentFixture<MomentumComponent>;

  beforeEach(async () => {
    // The component reads the saved view when it's created
    sessionStorage.removeItem(MomentumComponent.chartViewStorageKey);
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ MomentumComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MomentumComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    sessionStorage.removeItem(MomentumComponent.chartViewStorageKey);
  });

  function show(playByPlay: PlayByPlay): void {
    fixture.componentRef.setInput('playByPlay', playByPlay);
    fixture.detectChanges();
  }

  function toggleButton(label: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`.view-toggle button[aria-label="${label}"]`);
  }

  function canvas(): HTMLCanvasElement {
    return fixture.nativeElement.querySelector('canvas');
  }

  /** The labeled chart points as [index, label]. */
  function labels(): [number, string][] {
    return component.chartLabels.flatMap((label, index) => label ? [[index, label] as [number, string]] : []);
  }

  /** The indices of the chart points with a goal. */
  function goalPoints(): number[] {
    return component.goalData.flatMap((radius, index) => radius > 0 ? [index] : []);
  }

  /** A real play-by-play with only the given plays. */
  function withPlays(gameId: MockGamecenterGameId, eventIds: number[]): PlayByPlay {
    const playByPlay = mockGamePlayByPlay(gameId);
    playByPlay.plays = playByPlay.plays.filter(play => eventIds.includes(play.eventId));
    return playByPlay;
  }

  function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  it('should lay out the periods and goals of a real regulation game', () => {
    show(mockGamePlayByPlay(2025021057));
    expect(labels()).toEqual([[0, '1st'], [20, '2nd'], [40, '3rd'], [60, 'End']]);
    // Goals at 2:31 and 7:51 of the 1st, and at 5:17, 11:53 and 19:09 of the 3rd
    expect(goalPoints()).toEqual([3, 8, 46, 52, 60]);
    expect(component.momentumData.length).toBe(61);
    expect(component.momentumData.some(value => value !== 0)).toBeTrue();
  });

  it('should start with the line view, filled with the home team color above the axis', () => {
    show(mockGamePlayByPlay(2025021057));
    const momentumChart = Chart.getChart(canvas());
    expect(component.chartView).toBe('line');
    expect(momentumChart).toBeDefined();
    expect(momentumChart.data.labels).toEqual(component.chartLabels);
    expect(momentumChart.data.datasets[0].type).toBe('line');
    expect(momentumChart.data.datasets[0].data).toEqual(component.momentumData);
    // WPG (52) hosts STL (19)
    expect(momentumChart.data.datasets[0]['fill']).toEqual({
      above: NhlTeamColorUtils.getTeamPrimaryColor(52),
      below: NhlTeamColorUtils.getTeamSecondaryColor(52, 19),
      target: 'origin'
    });
    expect(toggleButton('Line chart').getAttribute('aria-pressed')).toBe('true');
    expect(toggleButton('Bar chart').getAttribute('aria-pressed')).toBe('false');
  });

  it('should color the bars by the team with the momentum in the bar view', () => {
    show(mockGamePlayByPlay(2025021057));
    toggleButton('Bar chart').click();
    fixture.detectChanges();
    const momentumChart = Chart.getChart(canvas());
    expect(component.chartView).toBe('bar');
    expect(momentumChart.data.datasets[0].type).toBe('bar');
    expect(momentumChart.data.datasets[0].data).toEqual(component.momentumData);
    expect(momentumChart.data.datasets[1]['pointRadius']).toEqual(component.goalData);
    expect(toggleButton('Bar chart').getAttribute('aria-pressed')).toBe('true');
    // WPG (52) hosts STL (19)
    const colors = momentumChart.data.datasets[0].backgroundColor as string[];
    component.momentumData.forEach((value, index) => expect(colors[index]).toBe(value >= 0
        ? NhlTeamColorUtils.getTeamPrimaryColor(52)
        : NhlTeamColorUtils.getTeamSecondaryColor(52, 19)));
  });

  it('should move the momentum toward the team that scored', () => {
    // WPG (home) scored at 2:31 of the 1st, STL (away) at 5:17 of the 3rd
    show(withPlays(2025021057, [80, 804]));
    expect(component.momentumData[3]).toBe(9);
    expect(component.momentumData[46]).toBe(-9);
    expect(component.momentumData.filter(value => value !== 0).length).toBe(2);
  });

  it('should weigh shots on goal and missed shots', () => {
    // STL (away) shot on goal at 0:22 of the 1st, missed shot by STL at 1:13
    const playByPlay = mockGamePlayByPlay(2025021057);
    const shot = playByPlay.plays.find(play => play.typeDescKey === 'shot-on-goal');
    const missedShot = playByPlay.plays.find(play => play.typeDescKey === 'missed-shot');
    const direction = (teamId: number) => teamId === playByPlay.homeTeam.id ? 1 : -1;

    show(withPlays(2025021057, [shot.eventId]));
    expect(sum(component.momentumData)).toBe(7 * direction(shot.details.eventOwnerTeamId));
    show(withPlays(2025021057, [missedShot.eventId]));
    expect(sum(component.momentumData)).toBe(5 * direction(missedShot.details.eventOwnerTeamId));
  });

  it('should credit a blocked shot to the shooting team', () => {
    // At 0:31 of the 1st, a WPG (home) player blocked a shot by an STL (away) player
    const playByPlay = withPlays(2025021057, [58]);
    const blockedShot = playByPlay.plays[0].details;
    const teamOf = (playerId: number) => playByPlay.rosterSpots.find(spot => spot.playerId === playerId).teamId;
    expect(teamOf(blockedShot.shootingPlayerId)).toBe(19);
    expect(teamOf(blockedShot.blockingPlayerId)).toBe(52);
    expect(blockedShot.eventOwnerTeamId).toBe(19);

    show(playByPlay);
    expect(component.momentumData[1]).toBe(-4);
  });

  it('should ignore plays that are not shots or goals', () => {
    const playByPlay = mockGamePlayByPlay(2025021057);
    playByPlay.plays = playByPlay.plays.filter(play => ['faceoff', 'hit', 'giveaway', 'penalty'].includes(play.typeDescKey));
    show(playByPlay);
    expect(component.momentumData.every(value => value === 0)).toBeTrue();
  });

  it('should cap the momentum of a minute at 30', () => {
    const playByPlay = withPlays(2025021057, [80]);
    playByPlay.plays = new Array(4).fill(playByPlay.plays[0]);
    show(playByPlay);
    expect(component.momentumData[3]).toBe(30);
  });

  it('should leave room for a goal puck at the max momentum', () => {
    const playByPlay = withPlays(2025021057, [80]);
    playByPlay.plays = new Array(4).fill(playByPlay.plays[0]);
    show(playByPlay);
    const momentumChart = Chart.getChart(canvas());
    const point = momentumChart.getDatasetMeta(1).data[3];
    // The puck image is 22px tall, centered on its point
    expect(point.y - 11).toBeGreaterThanOrEqual(0);
    expect(momentumChart.data.datasets[1].clip).toBeGreaterThanOrEqual(11);
  });

  it('should add the overtime but not the shootout of a real shootout game', () => {
    show(mockGamePlayByPlay(2025020952));
    // The overtime ended at 5:00
    expect(labels()).toEqual([[0, '1st'], [20, '2nd'], [40, '3rd'], [60, 'OT'], [65, 'End']]);
    // Goals at 9:41 of the 1st, 11:14 and 16:10 of the 2nd, and 10:41 of the 3rd; the 3 shootout goals are left out
    expect(goalPoints()).toEqual([10, 32, 37, 51]);
  });

  it('should add every overtime of a multi-overtime game', () => {
    const playByPlay = mockGamePlayByPlay(2025020952);
    const overtime = playByPlay.plays.filter(play => play.periodDescriptor.number === 4);
    overtime.find(play => play.typeDescKey === 'period-end').timeInPeriod = '20:00';
    playByPlay.plays = playByPlay.plays
        .filter(play => play.periodDescriptor.number <= 4)
        .concat(mockGamePlayByPlay(2025020952).plays
            .filter(play => play.periodDescriptor.number === 4)
            .map(play => ({...play, periodDescriptor: {...play.periodDescriptor, number: 5}})));
    show(playByPlay);
    expect(labels()).toEqual([[0, '1st'], [20, '2nd'], [40, '3rd'], [60, 'OT'], [80, '2OT'], [85, 'End']]);
  });

  it('should show the regulation periods without plays', () => {
    show(mockGamePlayByPlay(2026020056));
    expect(labels()).toEqual([[0, '1st'], [20, '2nd'], [40, '3rd'], [60, 'End']]);
    expect(component.momentumData.every(value => value === 0)).toBeTrue();
    expect(goalPoints()).toEqual([]);

    show(undefined);
    expect(labels()).toEqual([[0, '1st'], [20, '2nd'], [40, '3rd'], [60, 'End']]);
    expect(Chart.getChart(canvas())).toBeDefined();
  });

  it('should update the chart when the play-by-play refreshes', () => {
    show(derivedLivePlayByPlay());
    expect(goalPoints()).toEqual([3, 8]);

    show(mockGamePlayByPlay(2025021057));
    expect(goalPoints()).toEqual([3, 8, 46, 52, 60]);
    const [barDataset, goalDataset] = Chart.getChart(canvas()).data.datasets;
    expect(barDataset.data).toEqual(component.momentumData);
    expect(goalDataset['pointRadius']).toEqual(component.goalData);
  });

  /** Hovers the chart point at the index, as a mouse over it would, and renders the tooltip. */
  function hover(index: number): void {
    const momentumChart = Chart.getChart(canvas());
    const point = momentumChart.getDatasetMeta(1).data[index];
    momentumChart.tooltip.setActiveElements([{datasetIndex: 1, index}], {x: point.x, y: point.y});
    fixture.detectChanges();
  }

  function tooltip(): HTMLElement {
    return fixture.nativeElement.querySelector('.goal-tooltip');
  }

  /** The text of each goal in the tooltip, with its normalized rows joined by spaces. */
  function tooltipGoals(): string[] {
    return Array.from<Element>(tooltip()?.querySelectorAll('.goal') ?? [])
        .map(goal => Array.from(goal.children).map(row => row.textContent.replace(/\s+/g, ' ').trim()).join(' '));
  }

  it('should group the goals of each minute', () => {
    show(mockGamePlayByPlay(2025021057));
    expect(component.goalPlays[3].map(play => play.eventId)).toEqual([80]);
    expect(component.goalPlays[60].map(play => play.eventId)).toEqual([989]);
    expect(component.goalPlays.filter(goals => goals.length > 0).length).toBe(5);
  });

  it('should show a home goal when hovering its point', () => {
    show(mockGamePlayByPlay(2025021057));
    expect(tooltip()).toBeNull();

    // WPG (home): Fleury from Lambert and Barron at 2:31 of the 1st
    hover(3);
    expect(tooltipGoals()).toEqual(['1st · 2:31 Haydn Fleury (1 - 0) Assists: Brad Lambert, Morgan Barron']);
    expect(tooltip().querySelector<HTMLElement & {src: string}>('.team-logo').src)
        .toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    expect(Array.from<Element>(tooltip().querySelectorAll('.score-update .color-green')).map(score => score.textContent))
        .toEqual(['1']);
  });

  it('should show an away goal and highlight the away score', () => {
    show(mockGamePlayByPlay(2025021057));
    // STL (away): Dvorsky from Berggren and Suter at 5:17 of the 3rd
    hover(46);
    expect(tooltipGoals()).toEqual(['3rd · 5:17 Dalibor Dvorsky (2 - 1) Assists: Jonatan Berggren, Pius Suter']);
    expect(tooltip().querySelector<HTMLElement & {src: string}>('.team-logo').src)
        .toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(19));
    expect(Array.from<Element>(tooltip().querySelectorAll('.score-update .color-green')).map(score => score.textContent))
        .toEqual(['1']);
  });

  it('should show one assist', () => {
    show(mockGamePlayByPlay(2025021057));
    // Scheifele from Morrissey at 7:51 of the 1st
    hover(8);
    expect(tooltipGoals()).toEqual(['1st · 7:51 Mark Scheifele (2 - 0) Assists: Josh Morrissey']);
  });

  it('should show every goal of the hovered minute', () => {
    // Dvorsky's goal moved to 2:50 of the 1st, the same minute as Fleury's
    const playByPlay = withPlays(2025021057, [80, 804]);
    playByPlay.plays[1].periodDescriptor = playByPlay.plays[0].periodDescriptor;
    playByPlay.plays[1].timeInPeriod = '02:50';
    show(playByPlay);
    hover(3);
    expect(tooltipGoals().length).toBe(2);
    expect(tooltipGoals()[0]).toContain('Haydn Fleury');
    expect(tooltipGoals()[1]).toContain('Dalibor Dvorsky');
  });

  it('should show an unassisted goal', () => {
    const playByPlay = withPlays(2025021057, [80]);
    delete playByPlay.plays[0].details.assist1PlayerId;
    delete playByPlay.plays[0].details.assist2PlayerId;
    show(playByPlay);
    hover(3);
    expect(tooltipGoals()).toEqual(['1st · 2:31 Haydn Fleury (1 - 0) Unassisted']);
  });

  it('should hide the tooltip when hovering a point without a goal', () => {
    show(mockGamePlayByPlay(2025021057));
    hover(3);
    expect(tooltip()).not.toBeNull();
    hover(20);
    expect(tooltip()).toBeNull();
    expect(component.hoveredGoals).toEqual([]);
  });

  it('should keep the tooltip inside the chart', () => {
    show(mockGamePlayByPlay(2025021057));
    const momentumChart = Chart.getChart(canvas());
    [3, 46, 60].forEach(index => {
      hover(index);
      const {left, width, top, bottom} = component.tooltipPosition;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(momentumChart.width);
      // Below points in the top half of the chart, above the others
      const pointY = momentumChart.getDatasetMeta(1).data[index].y;
      expect(pointY < momentumChart.height / 2 ? top : bottom).toBeGreaterThan(0);
    });
  });

  /** Moves the pointer over the chart point at the index, at its momentum. */
  function point(index: number): void {
    const momentumChart = Chart.getChart(canvas());
    const rect = canvas().getBoundingClientRect();
    const x = momentumChart.scales['x'].getPixelForValue(index);
    const y = momentumChart.scales['y'].getPixelForValue(component.momentumData[index]);
    canvas().dispatchEvent(new PointerEvent('pointermove', {clientX: rect.left + x, clientY: rect.top + y}));
    fixture.detectChanges();
  }

  function minuteTooltip(): HTMLElement {
    return fixture.nativeElement.querySelector('.minute-tooltip');
  }

  /** The minute tooltip's label, then each team's plays and momentum, with their parts joined by spaces. */
  function minuteTooltipText(): string[] {
    return Array.from<Element>(minuteTooltip()?.children ?? [])
        .map(row => (row.children.length > 0 ? Array.from(row.children) : [row])
            .map(part => part.textContent.trim())
            .filter(text => text)
            .join(' '));
  }

  function minuteDot(): HTMLElement {
    return fixture.nativeElement.querySelector('.minute-dot');
  }

  /** Waits out the minute tooltip's delay and renders it. */
  function waitForMinuteTooltip(): void {
    tick(MomentumComponent.minuteTooltipDelay);
    fixture.detectChanges();
  }

  /** Ends a fakeAsync test: destroys the chart, then runs its animation frames. */
  function endFakeAsync(): void {
    fixture.destroy();
    flush();
  }

  it('should explain a minute after resting on it for the delay', fakeAsync(() => {
    // 0:00–1:00 of the 1st: STL (away) shot on goal at 0:22, its blocked shot at 0:31, and more
    const playByPlay = mockGamePlayByPlay(2025021057);
    show(playByPlay);
    const firstMinute = playByPlay.plays.filter(play => play.periodDescriptor.number === 1
        && play.timeInPeriod < '01:00' && ['shot-on-goal', 'missed-shot', 'blocked-shot'].includes(play.typeDescKey));
    expect(firstMinute.length).toBeGreaterThan(0);

    point(1);
    tick(MomentumComponent.minuteTooltipDelay - 1);
    fixture.detectChanges();
    expect(minuteTooltip()).toBeNull();
    tick(1);
    fixture.detectChanges();
    expect(minuteTooltip()).not.toBeNull();
    expect(minuteTooltipText()[0]).toBe('1st · 0:00–1:00');
    expect(component.hoveredMinute.teams.map(team => team.momentum).reduce((a, b) => a + b, 0))
        .toBe(firstMinute.reduce((total, play) => total + ({'shot-on-goal': 7, 'missed-shot': 5, 'blocked-shot': 4})[play.typeDescKey], 0));
    endFakeAsync();
  }));

  it('should list each team\'s goals and shot attempts, home team first', fakeAsync(() => {
    // 2:00–3:00 of the 1st: Fleury's WPG (home) goal at 2:31, with two STL (away) shots on goal and a blocked STL shot
    // moved into the same minute
    const playByPlay = withPlays(2025021057, [80]);
    const shot = mockGamePlayByPlay(2025021057).plays.find(play => play.typeDescKey === 'shot-on-goal'
        && play.details.eventOwnerTeamId === 19);
    const blocked = mockGamePlayByPlay(2025021057).plays.find(play => play.eventId === 58);
    playByPlay.plays.push(
        {...shot, periodDescriptor: playByPlay.plays[0].periodDescriptor, timeInPeriod: '02:10'},
        {...shot, periodDescriptor: playByPlay.plays[0].periodDescriptor, timeInPeriod: '02:40'},
        {...blocked, periodDescriptor: playByPlay.plays[0].periodDescriptor, timeInPeriod: '02:50'});
    show(playByPlay);

    point(3);
    waitForMinuteTooltip();
    expect(minuteTooltipText()).toEqual(['1st · 2:00–3:00', '1 goal +9', '2 shots · 1 blocked +18']);
    const logos = Array.from<HTMLElement & {src: string}>(minuteTooltip().querySelectorAll('.team-logo'));
    expect(logos.map(logo => logo.src))
        .toEqual([NhlTeamLogoUtils.getTeamPrimaryLogo(52), NhlTeamLogoUtils.getTeamPrimaryLogo(19)]);
    endFakeAsync();
  }));

  it('should say when a minute has no shot attempts', fakeAsync(() => {
    show(withPlays(2025021057, [80]));
    // 10:00–11:00 of the 2nd
    point(31);
    waitForMinuteTooltip();
    expect(minuteTooltipText()).toEqual(['2nd · 10:00–11:00', 'No shot attempts']);
    endFakeAsync();
  }));

  it('should mark the hovered minute\'s point with a dot while its tooltip is open', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    (['line', 'bar'] as MomentumChartView[]).forEach(view => {
      component.setChartView(view);
      point(10);
      expect(minuteDot()).toBeNull();
      waitForMinuteTooltip();
      const dot = minuteDot().getBoundingClientRect();
      const chartRect = canvas().getBoundingClientRect();
      const chart = Chart.getChart(canvas());
      expect(dot.left + dot.width / 2 - chartRect.left).toBeCloseTo(chart.scales['x'].getPixelForValue(10), 0);
      expect(dot.top + dot.height / 2 - chartRect.top)
          .toBeCloseTo(chart.scales['y'].getPixelForValue(component.momentumData[10]), 0);
      canvas().dispatchEvent(new PointerEvent('pointerleave'));
      fixture.detectChanges();
      expect(minuteDot()).toBeNull();
    });
    endFakeAsync();
  }));

  it('should label the overtime\'s minutes', fakeAsync(() => {
    show(mockGamePlayByPlay(2025020952));
    point(63);
    waitForMinuteTooltip();
    expect(minuteTooltipText()[0]).toBe('OT · 2:00–3:00');
    endFakeAsync();
  }));

  it('should not explain the start of the game, which ends no minute', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    expect(component.getMomentumMinute(0)).toBeUndefined();
    expect(component.getMomentumMinute(60).label).toBe('3rd · 19:00–20:00');
    endFakeAsync();
  }));

  it('should follow the pointer to the next minute right away once open', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    point(10);
    waitForMinuteTooltip();
    point(11);
    expect(minuteTooltipText()[0]).toBe('1st · 10:00–11:00');
    endFakeAsync();
  }));

  it('should cancel the minute tooltip when the pointer leaves the chart', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    point(10);
    canvas().dispatchEvent(new PointerEvent('pointerleave'));
    waitForMinuteTooltip();
    expect(minuteTooltip()).toBeNull();

    point(10);
    waitForMinuteTooltip();
    expect(minuteTooltip()).not.toBeNull();
    canvas().dispatchEvent(new PointerEvent('pointerleave'));
    fixture.detectChanges();
    expect(minuteTooltip()).toBeNull();
    endFakeAsync();
  }));

  it('should restart the delay when the pointer moves to another minute before it opens', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    point(10);
    tick(MomentumComponent.minuteTooltipDelay - 100);
    point(12);
    tick(100);
    fixture.detectChanges();
    expect(minuteTooltip()).toBeNull();
    tick(MomentumComponent.minuteTooltipDelay - 100);
    fixture.detectChanges();
    expect(minuteTooltipText()[0]).toBe('1st · 11:00–12:00');
    endFakeAsync();
  }));

  it('should show the goal tooltip instead of the minute tooltip over a goal', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    point(3);
    waitForMinuteTooltip();
    expect(minuteTooltip()).not.toBeNull();
    // The goal's puck already marks the point
    expect(minuteDot()).toBeNull();
    hover(3);
    expect(tooltip()).not.toBeNull();
    expect(minuteTooltip()).toBeNull();
    expect(minuteDot()).toBeNull();
    endFakeAsync();
  }));

  it('should center the minute tooltip right above a dot in the top half, right below one in the bottom half',
      fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    const momentumChart = Chart.getChart(canvas());
    // Mid-game minutes, away from the screen's sides: one with WPG (home) momentum, one with STL (away) momentum
    const midGame = component.momentumData.map((value, index) => ({value, index})).slice(25, 36);
    const homeIndex = midGame.find(item => item.value >= 10).index;
    const awayIndex = midGame.find(item => item.value <= -10).index;
    [homeIndex, awayIndex].forEach(index => {
      point(index);
      waitForMinuteTooltip();
      const rect = minuteTooltip().getBoundingClientRect();
      const dot = minuteDot().getBoundingClientRect();
      const dotX = dot.left + dot.width / 2;
      const dotY = dot.top + dot.height / 2;
      expect(rect.left + rect.width / 2).toBeCloseTo(dotX, 0);
      if (dotY - canvas().getBoundingClientRect().top < momentumChart.height / 2) {
        expect(index).toBe(homeIndex);
        expect(rect.bottom).toBeCloseTo(dotY - 8, 0);
      } else {
        expect(index).toBe(awayIndex);
        expect(rect.top).toBeCloseTo(dotY + 8, 0);
      }
      canvas().dispatchEvent(new PointerEvent('pointerleave'));
    });
    endFakeAsync();
  }));

  it('should shift the minute tooltip to stay on screen', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    point(1);
    waitForMinuteTooltip();
    // Moved past the screen's left side, as on a phone
    canvas().parentElement.style.marginLeft = '-200px';
    fixture.detectChanges();
    expect(minuteTooltip().getBoundingClientRect().left).toBeCloseTo(8, 0);
    canvas().parentElement.style.marginLeft = '';
    endFakeAsync();
  }));

  it('should close the minute tooltip when switching views', fakeAsync(() => {
    show(mockGamePlayByPlay(2025021057));
    point(10);
    waitForMinuteTooltip();
    toggleButton('Bar chart').click();
    fixture.detectChanges();
    expect(minuteTooltip()).toBeNull();

    point(10);
    waitForMinuteTooltip();
    expect(minuteTooltipText()[0]).toBe('1st · 9:00–10:00');
    endFakeAsync();
  }));

  it('should switch back to the line view and keep one chart on the canvas', () => {
    show(mockGamePlayByPlay(2025021057));
    const lineChart = Chart.getChart(canvas());
    component.setChartView('bar');
    expect(Chart.getChart(canvas())).not.toBe(lineChart);
    component.setChartView('line');
    fixture.detectChanges();
    const momentumChart = Chart.getChart(canvas());
    expect(momentumChart.data.datasets[0].type).toBe('line');
    expect(momentumChart.data.datasets[0].data).toEqual(component.momentumData);
    expect(toggleButton('Line chart').getAttribute('aria-pressed')).toBe('true');
  });

  it('should save the picked view for the session', () => {
    show(mockGamePlayByPlay(2025021057));
    expect(sessionStorage.getItem(MomentumComponent.chartViewStorageKey)).toBeNull();
    toggleButton('Bar chart').click();
    expect(sessionStorage.getItem(MomentumComponent.chartViewStorageKey)).toBe('bar');
    toggleButton('Line chart').click();
    expect(sessionStorage.getItem(MomentumComponent.chartViewStorageKey)).toBe('line');
  });

  it('should start with the view saved this session', () => {
    fixture.destroy();
    sessionStorage.setItem(MomentumComponent.chartViewStorageKey, 'bar');
    fixture = TestBed.createComponent(MomentumComponent);
    component = fixture.componentInstance;
    show(mockGamePlayByPlay(2025021057));
    expect(component.chartView).toBe('bar');
    expect(Chart.getChart(canvas()).data.datasets[0].type).toBe('bar');
    expect(toggleButton('Bar chart').getAttribute('aria-pressed')).toBe('true');
  });

  it('should start with the line view when the saved view is unknown', () => {
    fixture.destroy();
    sessionStorage.setItem(MomentumComponent.chartViewStorageKey, 'pie');
    fixture = TestBed.createComponent(MomentumComponent);
    component = fixture.componentInstance;
    show(mockGamePlayByPlay(2025021057));
    expect(component.chartView).toBe('line');
    expect(Chart.getChart(canvas()).data.datasets[0].type).toBe('line');
  });

  it('should start with the line view when session storage is blocked', () => {
    fixture.destroy();
    spyOn(Storage.prototype, 'getItem').and.throwError('SecurityError');
    spyOn(Storage.prototype, 'setItem').and.throwError('SecurityError');
    fixture = TestBed.createComponent(MomentumComponent);
    component = fixture.componentInstance;
    show(mockGamePlayByPlay(2025021057));
    expect(component.chartView).toBe('line');
    component.setChartView('bar');
    expect(component.chartView).toBe('bar');
  });

  it('should keep the chart when picking the view already shown', () => {
    show(mockGamePlayByPlay(2025021057));
    const momentumChart = Chart.getChart(canvas());
    toggleButton('Line chart').click();
    expect(Chart.getChart(canvas())).toBe(momentumChart);
  });

  it('should close the tooltip when switching views', () => {
    show(mockGamePlayByPlay(2025021057));
    hover(3);
    expect(tooltip()).not.toBeNull();
    toggleButton('Bar chart').click();
    fixture.detectChanges();
    expect(tooltip()).toBeNull();
  });

  it('should show goal tooltips in the bar view', () => {
    show(mockGamePlayByPlay(2025021057));
    component.setChartView('bar');
    hover(60);
    expect(component.hoveredGoals.map(goal => goal.eventId)).toEqual([989]);
    expect(tooltip()).not.toBeNull();
  });

  it('should destroy the chart with the component', () => {
    show(mockGamePlayByPlay(2025021057));
    const chartCanvas = canvas();
    fixture.destroy();
    expect(Chart.getChart(chartCanvas)).toBeUndefined();
  });
});
