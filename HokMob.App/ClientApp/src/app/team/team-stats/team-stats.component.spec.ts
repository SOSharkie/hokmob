import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { TeamSeasonStats } from '@shared/models/nhl-stats-api/team-stats.model';
import { mockTeamStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';

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

  function groupTitles(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.rating-group-title'))
        .map(title => title.textContent.trim());
  }

  it('should show a skeleton with a bar row per stat while loading, instead of the card', () => {
    fixture.componentRef.setInput('loading', true);
    show(28);
    const skeleton = fixture.nativeElement.querySelector('app-skeleton-card');
    expect(skeleton.getAttribute('shape')).toBe('bar');
    expect(skeleton.getAttribute('cardTitle')).toBeNull();
    expect(skeleton.layout.rows).toBe(8);
    // As tall as the card: its 48px title, three group titles and 8 rows of 43px, the same at every width
    const layout = skeleton.layout;
    expect(layout.headerHeight + layout.rows * layout.rowHeight + layout.paddingBottom).toBe(522);
    expect(skeleton.mobileLayout).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-skeleton-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.team-stats')).not.toBeNull();
  });

  it('should show the real stats and league ranks of a team', () => {
    show(6);
    expect(text('.rating-bar-card-title')).toBe('Team Stats');
    expect(fixture.nativeElement.querySelector('.rating-badge')).toBeNull();
    expect(groupTitles()).toEqual(['Results', 'Special teams', 'Shots & draws']);
    expect(component.groups.map(group => group.rows.length)).toEqual([3, 2, 3]);
    expect(rows()).toEqual([
      {label: 'Points %', value: '61.0%', rank: '8th'},
      {label: 'Goals For / Game', value: '3.27', rank: '10th'},
      {label: 'Goals Against / Game', value: '3.01', rank: '14th'},
      {label: 'Power Play %', value: '23.4%', rank: '9th'},
      {label: 'Penalty Kill %', value: '77.0%', rank: '24th'},
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
    expect(fills[7].style.left).toBe('50%');
    expect(parseFloat(fills[7].style.width)).toBeCloseTo(faceoffs.barWidth, 3);
  });

  it('should color each rank\'s pill and bar only at the ends of the league', () => {
    show(6);
    // Boston: points % 8th and faceoffs 4th are in the best 8, and 28th is in the worst 6. 9th, 10th and 24th aren't
    expect(component.rows.map(row => row.rank)).toEqual(['8th', '10th', '14th', '9th', '24th', '21st', '28th', '4th']);
    expect(component.rows.map(row => row.rankTier)).toEqual([
      'good', 'middle', 'middle', 'middle', 'middle', 'middle', 'poor', 'good'
    ]);
    const pills: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.part-rank'));
    const fills: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.part-bar-fill'));
    expect(pills[0].classList).toContain('rank-good');
    expect(fills[0].classList).toContain('rank-good');
    expect(pills[2].classList).toContain('rank-middle');
    expect(pills[6].classList).toContain('rank-poor');
    expect(fills[6].classList).toContain('rank-poor');
    // Colored by the class, not by the score's rating color
    expect(fills[0].style.backgroundColor).toBe('');
    expect(getComputedStyle(fills[0]).backgroundColor).toBe('rgb(30, 200, 84)');
    expect(getComputedStyle(pills[2]).color).toBe('rgb(164, 164, 164)');
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
    expect(rows()[3].rank).toBe('1st');
    show(fewestGoalsAgainst.teamId);
    expect(rows()[2].rank).toBe('1st');
    expect(component.rows[2].isAboveAverage).toBeTrue();
  });

  it('should give teams with the same value the same rank', () => {
    const teams = mockTeamStats().teams;
    // Above every real value, so only the first team is ahead of the tied pair
    const [first, second, third] = teams.slice(0, 3);
    first.powerPlayPct = 0.9;
    second.powerPlayPct = 0.8;
    third.powerPlayPct = 0.8;
    show(second.teamId, teams);
    expect(rows()[3].rank).toBe('2nd');
    show(third.teamId, teams);
    expect(rows()[3].rank).toBe('2nd');
  });

  it('should title the card without its season, which the page already gives', () => {
    const teams = mockTeamStats().teams.map(team => ({...team, seasonId: 20242025}));
    show(6, teams);
    expect(text('.rating-bar-card-title')).toBe('Team Stats');
  });

  it('should name the team with its logo when asked, for a card with both teams', () => {
    fixture.componentRef.setInput('showTeam', true);
    show(6);
    expect(text('.rating-bar-card-title')).toBe('Bruins');
    // A compact card's title, beside the logo
    expect(text('.rating-bar-card-short-title')).toBe('BOS');
    const logo: HTMLImageElement = fixture.nativeElement.querySelector('.rating-bar-card-logo');
    expect(logo.getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(6));
    expect(logo.alt).toBe('');
  });

  it('should lose its own background and padding inside a card with both teams, with the team on the left', () => {
    fixture.componentRef.setInput('showTeam', true);
    show(6);
    const card: HTMLElement = fixture.nativeElement.querySelector('.rating-bar-card');
    expect(card.classList).not.toContain('embedded');
    expect(getComputedStyle(card).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(card.classList).toContain('embedded');
    const style = getComputedStyle(card);
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.paddingLeft).toBe('0px');
    expect(style.paddingRight).toBe('0px');
    expect(card.querySelector('.rating-bar-card-logo').getBoundingClientRect().left).toBe(card.getBoundingClientRect().left);
  });

  it('should have no logo without showTeam', () => {
    show(6);
    expect(fixture.nativeElement.querySelector('.rating-bar-card-logo')).toBeNull();
    expect(text('.rating-bar-card-short-title')).toBe('Team Stats');
  });

  it('should give each stat its short name, for a compact card', () => {
    show(6);
    const shortNames = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.part-short-name'))
        .map(name => name.textContent.trim());
    expect(shortNames).toEqual([
      'Points %', 'Goals for', 'Goals against', 'Power play', 'Penalty kill', 'Shots for', 'Shots against', 'Faceoffs'
    ]);
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
    // An empty, uncolored pill
    expect(component.rows[7].rankTier).toBe('middle');
    expect(fixture.nativeElement.querySelectorAll('.part-rank')[7].classList).toContain('no-rank');
  });

});
