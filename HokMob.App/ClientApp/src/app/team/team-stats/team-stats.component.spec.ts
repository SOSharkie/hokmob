import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { TeamSeasonStats } from '@shared/models/nhl-stats-api/team-stats.model';
import { mockTeamStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamRatingUtils } from '@shared/utils/team-rating-utils';

import { TeamStatsComponent } from './team-stats.component';

describe('TeamStatsComponent', () => {
  let component: TeamStatsComponent;
  let fixture: ComponentFixture<TeamStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamStatsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamStatsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** Shows a team's card from every team's real 2025-26 stats, unless other rows are given. */
  function show(teamId: number, teamStats: TeamSeasonStats[] = mockTeamStats().teams): void {
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('teamStats', teamStats);
    fixture.detectChanges();
  }

  function rows(): {label: string, value: string, rank: string}[] {
    const statRows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.rating-part'));
    return statRows.map(row => ({
      label: row.querySelector('.part-name').textContent.trim(),
      value: row.querySelector('.part-value').textContent.trim(),
      rank: row.querySelector('.part-rank').textContent.trim()
    }));
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  /** A color as the browser writes it, so a hex color can be compared to an element's style. */
  function asStyle(color: string): string {
    const element = document.createElement('span');
    element.style.backgroundColor = color;
    return element.style.backgroundColor;
  }

  it('should show a skeleton with a bar row per stat while loading, instead of the card', () => {
    fixture.componentRef.setInput('loading', true);
    show(28);
    const skeleton = fixture.nativeElement.querySelector('app-skeleton-card');
    expect(skeleton.getAttribute('shape')).toBe('bar');
    expect(skeleton.getAttribute('cardTitle')).toBeNull();
    expect(skeleton.layout.rows).toBe(8);
    expect(skeleton.layout.rowHeight).toBe(48);
    expect(skeleton.mobileLayout.rowHeight).toBe(44);
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-skeleton-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.team-stats')).not.toBeNull();
  });

  it('should show the real stats and league ranks of a team', () => {
    show(6);
    expect(text('.rating-bar-card-title')).toBe('2025-2026 Team Stats');
    expect(fixture.nativeElement.querySelector('.rating-badge')).toBeNull();
    expect(rows()).toEqual([
      {label: 'Points %', value: '61.0%', rank: '8th'},
      {label: 'Power Play %', value: '23.4%', rank: '9th'},
      {label: 'Penalty Kill %', value: '77.0%', rank: '24th'},
      {label: 'Goals For / Game', value: '3.27', rank: '10th'},
      {label: 'Goals Against / Game', value: '3.01', rank: '14th'},
      {label: 'Shots For / Game', value: '27.0', rank: '21st'},
      {label: 'Shots Against / Game', value: '29.7', rank: '28th'},
      {label: 'Faceoff %', value: '53.1%', rank: '4th'}
    ]);
  });

  it('should draw each stat\'s bar from the league average', () => {
    show(6);
    const faceoffs = component.rows[7];
    // Boston wins 53.1% of its faceoffs, 4th, so its bar starts at the middle and goes right
    expect(faceoffs.isAboveAverage).toBeTrue();
    expect(faceoffs.barStart).toBe(50);
    expect(faceoffs.barWidth).toBeGreaterThan(0);
    const fills: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.part-bar-fill'));
    expect(fills[7].classList).toContain('above-average');
    expect(fills[7].style.backgroundColor).toBe(asStyle(faceoffs.barColor));
  });

  it('should color the points % by how far it is above the league average', () => {
    show(6);
    // Boston's 61.0% is 0.6 standard deviations above the average, a score of 5.9, in the green
    const pointsPct = component.rows[0];
    expect(pointsPct.isAboveAverage).toBeTrue();
    expect(pointsPct.barColor).toBe(TeamRatingUtils.getRatingColor(5.9));
  });

  it('should draw a lower value as better against', () => {
    show(6);
    const shotsAgainst = component.rows[6];
    // Boston allows 29.7 shots a game, more than the league's 27.8, so its bar ends at the middle
    expect(shotsAgainst.isAboveAverage).toBeFalse();
    expect(shotsAgainst.barStart + shotsAgainst.barWidth).toBeCloseTo(50, 10);
    expect(shotsAgainst.barWidth).toBeGreaterThan(0);
  });

  it('should rank the real league leader first and treat a lower value as better against', () => {
    const teams = mockTeamStats().teams;
    const bestPowerPlay = [...teams].sort((teamA, teamB) => teamB.powerPlayPct - teamA.powerPlayPct)[0];
    const fewestGoalsAgainst = [...teams].sort((teamA, teamB) => teamA.goalsAgainstPerGame - teamB.goalsAgainstPerGame)[0];
    show(bestPowerPlay.teamId);
    expect(rows()[1].rank).toBe('1st');
    show(fewestGoalsAgainst.teamId);
    expect(rows()[4].rank).toBe('1st');
    expect(component.rows[4].isAboveAverage).toBeTrue();
  });

  it('should give teams with the same value the same rank', () => {
    const teams = mockTeamStats().teams;
    // Above every real value, so only the first team is ahead of the tied pair
    const [first, second, third] = teams.slice(0, 3);
    first.powerPlayPct = 0.9;
    second.powerPlayPct = 0.8;
    third.powerPlayPct = 0.8;
    show(second.teamId, teams);
    expect(rows()[1].rank).toBe('2nd');
    show(third.teamId, teams);
    expect(rows()[1].rank).toBe('2nd');
  });

  it('should name the season of the rows, not the current one', () => {
    const teams = mockTeamStats().teams.map(team => ({...team, seasonId: 20242025}));
    show(6, teams);
    expect(text('.rating-bar-card-title')).toBe('2024-2025 Team Stats');
  });

  it('should show no card for a team without a row, like a former team or a season without games', () => {
    show(53);
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();
    show(6, mockTeamStats(20262027).teams);
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();
  });

  it('should show no card when the stats could not be loaded', () => {
    show(6, []);
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();
    show(6, null);
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();
  });

  it('should show a dash, no rank and no bar for a missing value', () => {
    const teams = mockTeamStats().teams;
    teams.find(team => team.teamId === 6).faceoffWinPct = null;
    show(6, teams);
    expect(rows()[7]).toEqual({label: 'Faceoff %', value: '-', rank: ''});
    expect(component.rows[7].barWidth).toBe(0);
  });

});
