import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { TeamGameStat } from '@shared/models/nhl-web-api/right-rail.model';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { mockGameRightRail, mockLiveNstGameStats, mockNstGameStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { NhlGameTypeEnum } from '@shared/enums/nhl-game-type.enum';

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

  it("should keep a highlighted stat readable on the team's color", () => {
    // Winnipeg hosts St. Louis: both blue, so the Blues get the light secondary color, too light for white text
    show(mockGameRightRail(2025021057).teamGameStats);
    expect(component.awayColor).toBe('#FFFFFFB1');
    expect(component.awayTextColor).toBe('#1B1B1B');
    expect(component.homeTextColor).toBe('#FFFFFF');

    // The Blues led no stat there, so take the Carolina game's stats, where the away team led four, as if Carolina
    // had visited New Jersey: both red, so Carolina gets the light color too
    show(mockGameRightRail(2025030414).teamGameStats, 1, 12);
    expect(highlighted('away')).toEqual(['Faceoff %', 'Power Plays', 'Blocks', 'Takeaways']);

    const highlightedAway = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.away.team-stat'))
        .filter(stat => stat.style.backgroundColor);
    expect(highlightedAway.length).toBeGreaterThan(0);
    expect(highlightedAway.every(stat => stat.style.color === 'rgb(27, 27, 27)')).toBeTrue();
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

  it("should show Natural Stat Trick's expected goals and Corsi first, and credit it", () => {
    // TBL (14) @ NYR (3)
    fixture.componentRef.setInput('advancedStats', mockNstGameStats(2026020010));
    show(mockGameRightRail(2026020010).teamGameStats, 3, 14);
    expect(rows().slice(0, 3)).toEqual([
      ['4.85', 'Expected Goals', '3.66'],
      ['45.2%', 'Corsi %', '54.8%'],
      ['61.4%', 'Faceoff %', '38.6%']
    ]);
    // They take the place of blocks and takeaways, so the card keeps six rows
    expect(rows().map(row => row[1])).toEqual(
        ['Expected Goals', 'Corsi %', 'Faceoff %', 'Power Plays', 'Penalty Minutes', 'Hits']);
    // The Rangers had more xG, the Lightning more shot attempts
    expect(highlighted('home')).toContain('Expected Goals');
    expect(highlighted('away')).toContain('Corsi %');
    // Their label and both values explain them, and that they're all strengths
    const rowElements = fixture.nativeElement.querySelectorAll('.team-stats-row');
    for (const row of [rowElements[0], rowElements[1]]) {
      const titles = ['.home', '.stats-label', '.away'].map(selector => row.querySelector(selector).getAttribute('title'));
      expect(new Set(titles).size).toBe(1);
      expect(titles[0]).toContain('All strengths');
    }
    expect(rowElements[0].querySelector('.stats-label').getAttribute('title')).toContain('xG');
    expect(rowElements[1].querySelector('.stats-label').getAttribute('title')).toContain('shot attempts');
    // The right-rail stats have none
    expect(rowElements[2].querySelector('.stats-label').getAttribute('title')).toBeNull();
    expect(rowElements[2].querySelector('.home').getAttribute('title')).toBeNull();
    const source = fixture.nativeElement.querySelector('.stats-source');
    expect(source.getAttribute('href')).toBe('https://www.naturalstattrick.com/game.php?season=20262027&game=20010');
    expect(source.getAttribute('target')).toBe('_blank');
  });

  it("should say how far a live game's Natural Stat Trick stats go", () => {
    // LAK (26) @ WSH (15), with NST at 0:12 of the 2nd
    fixture.componentRef.setInput('advancedStats', mockLiveNstGameStats());
    fixture.componentRef.setInput('gameType', NhlGameTypeEnum.REGULAR_SEASON);
    show(mockGameRightRail(2026020010).teamGameStats, 15, 26);
    expect(rows().slice(0, 2)).toEqual([['1.04', 'Expected Goals', '0.69'], ['53.3%', 'Corsi %', '46.7%']]);
    const source = () => fixture.nativeElement.querySelector('.stats-source').textContent.trim();
    expect(source()).toBe('Expected goals and Corsi from Natural Stat Trick, through 2nd 0:12');

    // Once NST marks the game final
    fixture.componentRef.setInput('advancedStats', {...mockLiveNstGameStats(), isFinal: true});
    fixture.detectChanges();
    expect(source()).toBe('Expected goals and Corsi from Natural Stat Trick');
  });

  it('should highlight neither team on a Corsi tie', () => {
    // CAR @ VGK, 52 shot attempts each
    fixture.componentRef.setInput('advancedStats', mockNstGameStats(2025030414));
    show(mockGameRightRail(2025030414).teamGameStats, 54, 12);
    expect(rows()[1]).toEqual(['50.0%', 'Corsi %', '50.0%']);
    expect(highlighted('home')).not.toContain('Corsi %');
    expect(highlighted('away')).not.toContain('Corsi %');
    expect(highlighted('away')).toContain('Expected Goals');
  });

  it('should show blocks and takeaways without expected goals, and dashes for missing expected goals numbers', () => {
    show(mockGameRightRail(2025021057).teamGameStats);
    expect(rows().map(row => row[1])).toEqual(
        ['Faceoff %', 'Power Plays', 'Penalty Minutes', 'Hits', 'Blocks', 'Takeaways']);
    expect(fixture.nativeElement.querySelector('.stats-source')).toBeNull();

    const stats = mockNstGameStats(2026020010);
    stats.homeTeam.expectedGoalsFor = null;
    stats.awayTeam.corsiAgainst = null;
    fixture.componentRef.setInput('advancedStats', stats);
    fixture.detectChanges();
    expect(rows().slice(0, 2)).toEqual([['-', 'Expected Goals', '3.66'], ['45.2%', 'Corsi %', '-']]);
    expect(highlighted('home')).not.toContain('Expected Goals');
    expect(highlighted('away')).not.toContain('Expected Goals');
  });

  it('should destroy the chart with the component', () => {
    show(mockGameRightRail(2025021057).teamGameStats);
    const canvas = fixture.nativeElement.querySelector('canvas');
    fixture.destroy();
    expect(Chart.getChart(canvas)).toBeUndefined();
  });
});
