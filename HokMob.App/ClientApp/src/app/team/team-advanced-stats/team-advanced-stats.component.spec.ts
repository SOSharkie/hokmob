import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockNstTeamTable, mockTeamGameRows } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { NstStatsUtils } from '@shared/utils/nst-stats-utils';
import { TeamRating, TeamRatingUtils } from '@shared/utils/team-rating-utils';

import { TeamAdvancedStatsComponent } from './team-advanced-stats.component';

describe('TeamAdvancedStatsComponent', () => {
  let component: TeamAdvancedStatsComponent;
  let fixture: ComponentFixture<TeamAdvancedStatsComponent>;
  let ratings: TeamRating[];

  /** San Jose, 22 games into 2026-27: 20 points, 56 goals for and 77 against. */
  const sharks = 28;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamAdvancedStatsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamAdvancedStatsComponent);
    component = fixture.componentInstance;
    ratings = TeamRatingUtils.getLeagueRatings(mockTeamGameRows());
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(teamId: number, season: number = 20262027, teamRatings: TeamRating[] = ratings): void {
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('ratings', teamRatings);
    fixture.componentRef.setInput('season', season);
    fixture.detectChanges();
  }

  function rows(): {label: string, value: string, rank: string, title: string}[] {
    const statRows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.team-stat-row'));
    return statRows.map(row => ({
      label: row.querySelector('.stat-label').textContent.trim(),
      value: row.querySelector('.stat-value').textContent.trim(),
      rank: row.querySelector('.stat-rank').textContent.trim(),
      title: row.title
    }));
  }

  it('should show the season\'s advanced stats in order', () => {
    show(sharks);
    expect(fixture.nativeElement.querySelector('.team-stats-header').textContent.trim())
        .toBe('2026-2027 Advanced Stats');
    expect(rows().map(row => row.label)).toEqual([
      'Goal Diff / Game', 'Special Teams Diff / Game', '5v5 Corsi %', '5v5 Fenwick %', 'Shots For %',
      '5v5 Goals For %', '5v5 Shooting %', '5v5 Save %', 'PDO'
    ]);
  });

  it('should show the team\'s real values with their league ranks', () => {
    show(sharks);
    const team = ratings.find(rating => rating.teamId === sharks);
    const [goalDiff] = rows();
    expect(goalDiff.value).toBe('-0.95');
    expect(goalDiff.rank).toBe(TeamRatingUtils.getOrdinal(team.ranks.goalDiff));
    rows().forEach(row => expect(row.rank).toMatch(/^\d+(st|nd|rd|th)$/));
  });

  it('should explain each stat in its tooltip', () => {
    show(sharks);
    expect(rows()[2].title).toBe(TeamRatingUtils.getMetric('corsi').description);
  });

  it('should show a dash for a stat without a value', () => {
    const team = ratings.find(rating => rating.teamId === sharks);
    const withoutShots = {...team, values: {...team.values, pdo: null}, ranks: {...team.ranks, pdo: null}};
    show(sharks, 20262027, [withoutShots]);
    const pdo = rows()[8];
    expect(pdo.value).toBe('-');
    expect(pdo.rank).toBe('');
  });

  it('should show nothing for a team without a rating', () => {
    show(99);
    expect(component.rows).toEqual([]);
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();
  });

  describe('5v5 xGF% from Natural Stat Trick', () => {
    function showWithNst(teamId: number = sharks, nstTeams = mockNstTeamTable().teams): void {
      fixture.componentRef.setInput('nstTeams', nstTeams);
      show(teamId);
    }

    it("should show the team's real xGF% and rank after the other shot shares", () => {
      showWithNst();
      const labels = rows().map(row => row.label);
      expect(labels.indexOf('5v5 xGF%')).toBe(labels.indexOf('5v5 Fenwick %') + 1);
      const xg = rows().find(row => row.label === '5v5 xGF%');
      // San Jose: 36.54 xG for and 55.97 against
      expect(xg.value).toBe('39.5%');
      const rank = NstStatsUtils.getTeamExpectedGoalsShares(mockNstTeamTable().teams).get(sharks).rank;
      expect(xg.rank).toBe(TeamRatingUtils.getOrdinal(rank));
      expect(xg.title).toContain('Natural Stat Trick');
    });

    it('should credit Natural Stat Trick with a link to its team table', () => {
      showWithNst();
      const credit: HTMLAnchorElement = fixture.nativeElement.querySelector('.stats-source');
      expect(credit.textContent.trim()).toBe('xGF% from Natural Stat Trick');
      expect(credit.href).toBe('https://www.naturalstattrick.com/teamtable.php');
      expect(credit.target).toBe('_blank');
    });

    it("should leave the row and the credit out without NST's table", () => {
      show(sharks);
      expect(rows().map(row => row.label)).not.toContain('5v5 xGF%');
      expect(fixture.nativeElement.querySelector('.stats-source')).toBeNull();
    });

    it("should leave the row out when NST's table doesn't have the team", () => {
      showWithNst(sharks, mockNstTeamTable().teams.filter(team => team.name !== 'San Jose Sharks'));
      expect(rows().length).toBe(9);
      expect(fixture.nativeElement.querySelector('.stats-source')).toBeNull();
    });
  });
});
