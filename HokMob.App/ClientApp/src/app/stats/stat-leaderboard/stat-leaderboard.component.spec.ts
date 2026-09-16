import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlTeamUtils } from '@shared/utils/nhl-team-utils';
import { mockGoalieStatsLeaders, mockSkaterStatsLeaders } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { StatsLeader } from '@shared/models/nhl-web-api/stats-leaders.model';

import { LeaderboardEntry, LeaderboardFormat, StatLeaderboardComponent } from './stat-leaderboard.component';

describe('StatLeaderboardComponent', () => {
  let component: StatLeaderboardComponent;
  let fixture: ComponentFixture<StatLeaderboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ StatLeaderboardComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatLeaderboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** The entries the stats page builds from real NHL web API leaders. */
  function entriesOf(leaders: StatsLeader[]): LeaderboardEntry[] {
    return leaders.map(leader => ({
      playerId: leader.id,
      name: leader.firstName.default + ' ' + leader.lastName.default,
      teamId: NhlTeamUtils.getTeamIdByAbbrev(leader.teamAbbrev),
      headshot: leader.headshot,
      value: leader.value
    }));
  }

  function show(entries: LeaderboardEntry[], format: LeaderboardFormat = 'number', statTitle = 'Points'): void {
    fixture.componentRef.setInput('statTitle', statTitle);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('format', format);
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function values(): string[] {
    const players: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.stat-player'));
    return players.map(player => player.querySelector('.stat-container').textContent.trim());
  }

  it('should show the real points leader with their team, and the four players behind them', () => {
    show(entriesOf(mockSkaterStatsLeaders().points));

    expect(text('.stat-title')).toBe('Points');
    expect(text('.leader-name')).toBe('Connor McDavid');
    expect(text('.leader-team-label')).toBe('Edmonton Oilers');
    expect(text('.stat-leader .stat-container')).toBe('138');
    expect(fixture.nativeElement.querySelectorAll('.stat-player').length).toBe(5);
    expect(values()).toEqual(['138', '130', '127', '115', '103']);
  });

  it('should link every player to their page and show their headshot and logo', () => {
    const entries = entriesOf(mockSkaterStatsLeaders().points);
    show(entries);

    const routerLink = fixture.debugElement.query(By.css('.stat-leader')).injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/player/' + entries[0].playerId);
    expect(fixture.nativeElement.querySelector('.leader-headshot').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png');
    expect(fixture.nativeElement.querySelector('.leader-team-logo').getAttribute('src'))
        .toBe('assets/logos/edmonton.png');
  });

  it('should color the leader stat with their team color', () => {
    show(entriesOf(mockGoalieStatsLeaders().savePctg), 'savePctg', 'Save Percentage');

    // Scott Wedgewood leads with Colorado, whose primary color is #6F263D
    expect(text('.leader-team-label')).toBe('Colorado Avalanche');
    expect(fixture.nativeElement.querySelector('.stat-leader .stat-container').style.backgroundColor)
        .toBe('rgb(111, 38, 61)');
  });

  it('should format a save percentage, a goals against average and a time on ice', () => {
    show(entriesOf(mockGoalieStatsLeaders().savePctg), 'savePctg', 'Save Percentage');
    expect(text('.stat-leader .stat-container')).toBe('.921');

    show(entriesOf(mockGoalieStatsLeaders().goalsAgainstAverage), 'gaa', 'Goals Against Average');
    expect(text('.stat-leader .stat-container')).toBe('2.02');

    // The web API's time on ice is in seconds: 1664.2568 is 27:44
    show(entriesOf(mockSkaterStatsLeaders().toi), 'toi', 'Time On Ice Per Game');
    expect(text('.stat-leader .stat-container')).toBe('27:44');
  });

  it('should show a leaderboard with fewer than five leaders', () => {
    // The 2025-26 playoffs only had 4 goalies with a shutout
    show(entriesOf(mockGoalieStatsLeaders(3).shutouts));

    expect(fixture.nativeElement.querySelectorAll('.stat-player').length).toBe(4);
    expect(text('.no-stats')).toBeUndefined();
  });

  it('should show at most five leaders', () => {
    const leaders = mockSkaterStatsLeaders().points;
    show(entriesOf([...leaders, ...leaders]));

    expect(fixture.nativeElement.querySelectorAll('.stat-player').length).toBe(5);
  });

  it('should show that there are no stats yet for an empty leaderboard', () => {
    show([], 'number', 'Wins');

    expect(text('.stat-title')).toBe('Wins');
    expect(text('.no-stats')).toBe('No stats yet');
    expect(fixture.nativeElement.querySelectorAll('.stat-player').length).toBe(0);
  });

  it('should show the empty state when there are no entries at all', () => {
    show(null);

    expect(text('.no-stats')).toBe('No stats yet');
  });

  it('should fall back to the blank headshot and the fallback logo for an unknown team', () => {
    show([{playerId: 1, name: 'Wayne Gretzky', teamId: undefined, headshot: null, value: 215}]);

    expect(text('.leader-name')).toBe('Wayne Gretzky');
    expect(fixture.nativeElement.querySelector('.leader-headshot').getAttribute('src'))
        .toBe('assets/blank_headshot.png');
    expect(fixture.nativeElement.querySelector('.leader-team-logo').getAttribute('src'))
        .toBe('assets/logos/team_fallback.png');
  });

  it('should replace a headshot that fails to load with the blank one', () => {
    show(entriesOf(mockSkaterStatsLeaders().points));

    const headshot: HTMLImageElement = fixture.nativeElement.querySelector('.leader-headshot');
    headshot.dispatchEvent(new Event('error'));
    expect(headshot.src).toContain('assets/blank_headshot.png');
  });
});
