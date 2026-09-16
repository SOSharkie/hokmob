import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { TeamSeasonStats } from '@shared/models/nhl-stats-api/team-stats.model';
import { mockTeamStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

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
    const statRows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.team-stat-row'));
    return statRows.map(row => ({
      label: row.querySelector('.stat-label').textContent.trim(),
      value: row.querySelector('.stat-value').textContent.trim(),
      rank: row.querySelector('.stat-rank').textContent.trim()
    }));
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should show the real stats and league ranks of a team', () => {
    show(6);
    expect(text('.team-stats-header')).toBe('2025-2026 Team Stats');
    expect(rows()).toEqual([
      {label: 'Power Play %', value: '23.4', rank: '9th'},
      {label: 'Penalty Kill %', value: '77.0', rank: '24th'},
      {label: 'Goals For / Game', value: '3.27', rank: '10th'},
      {label: 'Goals Against / Game', value: '3.01', rank: '14th'},
      {label: 'Shots For / Game', value: '27.02', rank: '21st'},
      {label: 'Shots Against / Game', value: '29.70', rank: '28th'},
      {label: 'Faceoff %', value: '53.1', rank: '4th'}
    ]);
  });

  it('should rank the real league leader first and treat a lower value as better against', () => {
    const teams = mockTeamStats().teams;
    const bestPowerPlay = [...teams].sort((teamA, teamB) => teamB.powerPlayPct - teamA.powerPlayPct)[0];
    const fewestGoalsAgainst = [...teams].sort((teamA, teamB) => teamA.goalsAgainstPerGame - teamB.goalsAgainstPerGame)[0];
    show(bestPowerPlay.teamId);
    expect(rows()[0].rank).toBe('1st');
    show(fewestGoalsAgainst.teamId);
    expect(rows()[3].rank).toBe('1st');
  });

  it('should give teams with the same value the same rank', () => {
    const teams = mockTeamStats().teams;
    // Above every real value, so only the first team is ahead of the tied pair
    const [first, second, third] = teams.slice(0, 3);
    first.powerPlayPct = 0.9;
    second.powerPlayPct = 0.8;
    third.powerPlayPct = 0.8;
    show(second.teamId, teams);
    expect(rows()[0].rank).toBe('2nd');
    show(third.teamId, teams);
    expect(rows()[0].rank).toBe('2nd');
  });

  it('should name the season of the rows, not the current one', () => {
    const teams = mockTeamStats().teams.map(team => ({...team, seasonId: 20242025}));
    show(6, teams);
    expect(text('.team-stats-header')).toBe('2024-2025 Team Stats');
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

  it('should show a dash and no rank for a missing value', () => {
    const teams = mockTeamStats().teams;
    teams.find(team => team.teamId === 6).faceoffWinPct = null;
    show(6, teams);
    expect(rows()[6]).toEqual({label: 'Faceoff %', value: '-', rank: ''});
  });
});
