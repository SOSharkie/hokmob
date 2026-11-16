import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockRatedTeamGameRows, mockTeamGameRows } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamRating, TeamRatingUtils } from '@shared/utils/team-rating-utils';

import { TeamAdvancedStatsComponent } from './team-advanced-stats.component';

describe('TeamAdvancedStatsComponent', () => {
  let component: TeamAdvancedStatsComponent;
  let fixture: ComponentFixture<TeamAdvancedStatsComponent>;
  let ratings: TeamRating[];

  /** San Jose, 22 games into 2026-27: 20 points, 56 goals for and 77 against, and 36.56 5v5 xG for and 55.96 against. */
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
    ratings = TeamRatingUtils.getLeagueRatings(mockRatedTeamGameRows());
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
      'Goal Diff / Game', 'Special Teams Diff / Game', '5v5 Corsi %', '5v5 Fenwick %', '5v5 xGF%', 'Shots For %',
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
    const pdo = rows()[9];
    expect(pdo.value).toBe('-');
    expect(pdo.rank).toBe('');
  });

  it('should show nothing for a team without a rating', () => {
    show(99);
    expect(component.rows).toEqual([]);
    expect(fixture.nativeElement.querySelector('.team-stats')).toBeNull();
  });

  describe('5v5 xGF% from Natural Stat Trick', () => {
    /** The ratings when NST can't be asked: worked out from the NHL's stats alone. */
    function showWithoutNst(teamId: number = sharks): void {
      show(teamId, 20262027, TeamRatingUtils.getLeagueRatings(mockTeamGameRows()));
    }

    it("should show the team's real xGF% and rank after the other shot shares", () => {
      show(sharks);
      const labels = rows().map(row => row.label);
      expect(labels.indexOf('5v5 xGF%')).toBe(labels.indexOf('5v5 Fenwick %') + 1);
      const xg = rows().find(row => row.label === '5v5 xGF%');
      // San Jose: 36.56 xG for and 55.96 against
      expect(xg.value).toBe('39.5%');
      const team = ratings.find(rating => rating.teamId === sharks);
      const higher = ratings.filter(rating => rating.values.expectedGoals > team.values.expectedGoals + 1e-9).length;
      expect(xg.rank).toBe(TeamRatingUtils.getOrdinal(higher + 1));
      expect(xg.title).toContain('Natural Stat Trick');
    });

    it('should credit Natural Stat Trick with a link to its team table', () => {
      show(sharks);
      const credit: HTMLAnchorElement = fixture.nativeElement.querySelector('.stats-source');
      expect(credit.textContent.trim()).toBe('xGF% from Natural Stat Trick');
      expect(credit.href).toBe('https://www.naturalstattrick.com/teamtable.php');
      expect(credit.target).toBe('_blank');
    });

    it("should leave the row and the credit out without NST's expected goals", () => {
      showWithoutNst();
      expect(component.hasExpectedGoals).toBeFalse();
      expect(rows().map(row => row.label)).not.toContain('5v5 xGF%');
      expect(rows().length).toBe(9);
      expect(fixture.nativeElement.querySelector('.stats-source')).toBeNull();
    });

    it('should keep the other stats the same without them', () => {
      show(sharks);
      const withNst = rows().filter(row => row.label !== '5v5 xGF%');
      showWithoutNst();
      expect(rows()).toEqual(withNst);
    });
  });
});
