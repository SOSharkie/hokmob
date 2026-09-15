import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { TeamGameStat } from '@shared/models/nhl-web-api/right-rail.model';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { mockGameRightRail } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { GameStatsComponent } from './game-stats.component';

describe('GameStatsComponent', () => {
  let component: GameStatsComponent;
  let fixture: ComponentFixture<GameStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GameStatsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameStatsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** Shows team stats for WPG (52, home) vs STL (19, away), like game 2025021057. */
  function show(teamGameStats: TeamGameStat[], homeTeamId = 52, awayTeamId = 19): void {
    fixture.componentRef.setInput('homeTeamId', homeTeamId);
    fixture.componentRef.setInput('awayTeamId', awayTeamId);
    fixture.componentRef.setInput('teamGameStats', teamGameStats);
    fixture.detectChanges();
  }

  function normalize(element: Element): string {
    return element.textContent.replace(/\s+/g, ' ').trim();
  }

  /** Each stats row as [home value, label, away value]. */
  function rows(): string[][] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.team-stats-row')).map(row => [
      normalize(row.querySelector('.home')),
      normalize(row.querySelector('.stats-label')),
      normalize(row.querySelector('.away'))
    ]);
  }

  /** The labels of the rows whose home or away value is highlighted. */
  function highlighted(side: 'home' | 'away'): string[] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.team-stats-row'))
        .filter(row => (row.querySelector('.' + side) as HTMLElement).style.backgroundColor !== '')
        .map(row => normalize(row.querySelector('.stats-label')));
  }

  function shotLabels(): string[] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.shot-number')).map(normalize);
  }

  function chart(): Chart {
    return Chart.getChart(fixture.nativeElement.querySelector('canvas'));
  }

  it('should show the real team stats of a regulation game', () => {
    show(mockGameRightRail(2025021057).teamGameStats);
    expect(shotLabels()).toEqual(['16', '31']);
    expect(rows()).toEqual([
      ['66.0%', 'Faceoff %', '34.0%'],
      ['0/3', 'Power Plays', '0/1'],
      ['2', 'Penalty Minutes', '6'],
      ['26', 'Hits', '13'],
      ['15', 'Blocks', '6'],
      ['4', 'Takeaways', '3']
    ]);
  });

  it('should highlight the better team, with fewer penalty minutes and a better power play percentage', () => {
    show(mockGameRightRail(2025021057).teamGameStats);
    // Both power plays are 0%, so neither is highlighted
    expect(highlighted('home')).toEqual(['Faceoff %', 'Penalty Minutes', 'Hits', 'Blocks', 'Takeaways']);
    expect(highlighted('away')).toEqual([]);

    // CAR (away) had the better power play (1/3) and more takeaways, both teams had 8 penalty minutes
    show(mockGameRightRail(2025030414).teamGameStats, 54, 12);
    expect(rows()[1]).toEqual(['0/3', 'Power Plays', '1/3']);
    expect(highlighted('away')).toEqual(['Faceoff %', 'Power Plays', 'Blocks', 'Takeaways']);
    expect(highlighted('home')).toEqual(['Hits']);
  });

  it('should draw the shots in the team colors', () => {
    show(mockGameRightRail(2025021057).teamGameStats);
    const dataset = chart().data.datasets[0];
    expect(dataset.data).toEqual([31, 16]);
    expect(dataset.backgroundColor)
        .toEqual([NhlTeamColorUtils.getTeamSecondaryColor(52, 19), NhlTeamColorUtils.getTeamPrimaryColor(52)]);
    expect(component.homeColor).toBe(NhlTeamColorUtils.getTeamPrimaryColor(52));
  });

  it('should update the stats and chart when new stats arrive', () => {
    show(mockGameRightRail(2025021057).teamGameStats);
    const updated = mockGameRightRail(2025020952).teamGameStats;
    show(updated, 24, 20);
    expect(shotLabels()).toEqual(['36', '34']);
    expect(rows()[2]).toEqual(['6', 'Penalty Minutes', '10']);
    expect(chart().data.datasets[0].data).toEqual([34, 36]);
  });

  it('should show dashes and no highlights without team stats', () => {
    show(undefined);
    expect(shotLabels()).toEqual(['0', '0']);
    expect(rows().length).toBe(6);
    rows().forEach(row => expect([row[0], row[2]]).toEqual(['-', '-']));
    expect(highlighted('home')).toEqual([]);
    expect(highlighted('away')).toEqual([]);
    expect(chart().data.datasets[0].data).toEqual([0, 0]);
  });

  it('should show a dash for a missing category', () => {
    const stats = mockGameRightRail(2025021057).teamGameStats.filter(stat => stat.category !== 'hits');
    show(stats);
    expect(rows()[3]).toEqual(['-', 'Hits', '-']);
    expect(highlighted('home')).not.toContain('Hits');
  });

  it('should destroy the chart with the component', () => {
    show(mockGameRightRail(2025021057).teamGameStats);
    const canvas = fixture.nativeElement.querySelector('canvas');
    fixture.destroy();
    expect(Chart.getChart(canvas)).toBeUndefined();
  });
});
