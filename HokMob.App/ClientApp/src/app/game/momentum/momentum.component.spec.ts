import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

import { MomentumComponent } from './momentum.component';

describe('MomentumComponent', () => {
  let component: MomentumComponent;
  let fixture: ComponentFixture<MomentumComponent>;

  beforeEach(async () => {
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
  });

  function show(playByPlay: PlayByPlay): void {
    fixture.componentRef.setInput('playByPlay', playByPlay);
    fixture.detectChanges();
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

  it('should draw the chart with the home team color above the axis', () => {
    show(mockGamePlayByPlay(2025021057));
    const momentumChart = Chart.getChart(canvas());
    expect(momentumChart).toBeDefined();
    expect(momentumChart.data.labels).toEqual(component.chartLabels);
    expect(momentumChart.data.datasets[0].data).toEqual(component.momentumData);
    // WPG (52) hosts STL (19)
    expect(momentumChart.data.datasets[0]['fill']).toEqual({
      above: NhlTeamColorUtils.getTeamPrimaryColor(52),
      below: NhlTeamColorUtils.getTeamSecondaryColor(52, 19),
      target: 'origin'
    });
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
    const dataset = Chart.getChart(canvas()).data.datasets[0];
    expect(dataset.data).toEqual(component.momentumData);
    expect(dataset['pointRadius']).toEqual(component.goalData);
  });

  /** Hovers the chart point at the index, as a mouse over it would, and renders the tooltip. */
  function hover(index: number): void {
    const momentumChart = Chart.getChart(canvas());
    const point = momentumChart.getDatasetMeta(0).data[index];
    momentumChart.tooltip.setActiveElements([{datasetIndex: 0, index}], {x: point.x, y: point.y});
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
    expect(tooltip().querySelector('.team-logo').getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    expect(Array.from<Element>(tooltip().querySelectorAll('.score-update .color-green')).map(score => score.textContent))
        .toEqual(['1']);
  });

  it('should show an away goal and highlight the away score', () => {
    show(mockGamePlayByPlay(2025021057));
    // STL (away): Dvorsky from Berggren and Suter at 5:17 of the 3rd
    hover(46);
    expect(tooltipGoals()).toEqual(['3rd · 5:17 Dalibor Dvorsky (2 - 1) Assists: Jonatan Berggren, Pius Suter']);
    expect(tooltip().querySelector('.team-logo').getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(19));
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
      const pointY = momentumChart.getDatasetMeta(0).data[index].y;
      expect(pointY < momentumChart.height / 2 ? top : bottom).toBeGreaterThan(0);
    });
  });

  it('should destroy the chart with the component', () => {
    show(mockGamePlayByPlay(2025021057));
    const chartCanvas = canvas();
    fixture.destroy();
    expect(Chart.getChart(chartCanvas)).toBeUndefined();
  });
});
