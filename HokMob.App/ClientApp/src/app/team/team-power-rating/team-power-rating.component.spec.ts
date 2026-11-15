import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockTeamGameRows } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamRating, TeamRatingPoint, TeamRatingUtils } from '@shared/utils/team-rating-utils';

import { TeamPowerRatingComponent } from './team-power-rating.component';

describe('TeamPowerRatingComponent', () => {
  let component: TeamPowerRatingComponent;
  let fixture: ComponentFixture<TeamPowerRatingComponent>;
  let ratings: TeamRating[];
  let timeline: TeamRatingPoint[];

  /** San Jose, 22 games into 2026-27: 20 points, 56 goals for and 77 against. */
  const sharks = 28;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamPowerRatingComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamPowerRatingComponent);
    component = fixture.componentInstance;
    const games = mockTeamGameRows();
    ratings = TeamRatingUtils.getLeagueRatings(games);
    timeline = TeamRatingUtils.getTimeline(games, [sharks]).get(sharks);
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(teamId: number, points: TeamRatingPoint[] = timeline): void {
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('ratings', ratings);
    fixture.componentRef.setInput('timeline', points);
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function parts(): {name: string, weight: string, value: string, rank: string}[] {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.rating-part'));
    return rows.map(row => ({
      name: row.querySelector('.part-name').textContent.trim(),
      weight: row.querySelector('.part-weight').textContent.trim(),
      value: row.querySelector('.part-value').textContent.trim(),
      rank: row.querySelector('.part-rank').textContent.trim()
    }));
  }

  it('should show the team\'s rating, rank and games', () => {
    show(sharks);
    const team = ratings.find(rating => rating.teamId === sharks);
    expect(text('.rating-badge')).toBe(team.rating.toFixed(1));
    expect(text('.rating-rank')).toBe(TeamRatingUtils.getOrdinal(team.rank) + ' of 32 in the NHL');
    expect(text('.rating-games')).toContain('Through 22 games');
  });

  it('should color the rating like a HokMob rating', () => {
    show(sharks);
    const badge: HTMLElement = fixture.nativeElement.querySelector('.rating-badge');
    const team = ratings.find(rating => rating.teamId === sharks);
    const expected = document.createElement('span');
    expected.style.backgroundColor = TeamRatingUtils.getRatingColor(team.rating);
    expect(badge.style.backgroundColor).toBe(expected.style.backgroundColor);
  });

  it('should list each rated stat with its weight, real value and rank', () => {
    show(sharks);
    const rows = parts();
    expect(rows.map(row => [row.name, row.weight])).toEqual([
      ['Points %', '30%'], ['Goal Diff / Game', '20%'], ['5v5 Corsi %', '30%'], ['Special Teams Diff / Game', '20%']
    ]);
    expect(rows[0].value).toBe('45.5%');
    expect(rows[1].value).toBe('-0.95');
    const team = ratings.find(rating => rating.teamId === sharks);
    expect(rows[0].rank).toBe(TeamRatingUtils.getOrdinal(team.ranks.pointPct));
  });

  it('should draw each stat\'s bar from the league average', () => {
    show(sharks);
    const team = ratings.find(rating => rating.teamId === sharks);
    const goalDiff = component.parts[1];
    // San Jose's goal differential is below average, so its bar ends at the middle of the track
    expect(team.scores.goalDiff).toBeLessThan(TeamRatingUtils.averageRating);
    expect(goalDiff.isAboveAverage).toBeFalse();
    expect(goalDiff.barStart + goalDiff.barWidth).toBeCloseTo(50, 10);
    // The track is 0 to 10, so a score of 3.2 starts 32% of the way along it
    expect(goalDiff.barStart).toBeCloseTo(team.scores.goalDiff * 10, 10);
  });

  it('should show the change over the last 5 games', () => {
    show(sharks);
    const change = timeline[timeline.length - 1].rating - timeline[timeline.length - 6].rating;
    expect(component.change).toBeCloseTo(change, 10);
    const sign = change > 0 ? '+' : '-';
    expect(text('.rating-change')).toContain(sign + Math.abs(change).toFixed(1) + ' last 5');
  });

  it('should show no change before 6 games', () => {
    show(sharks, timeline.slice(0, 5));
    expect(component.change).toBeNull();
    expect(fixture.nativeElement.querySelector('.rating-change')).toBeNull();
  });

  it('should label a rise, a fall and no change', () => {
    show(sharks);
    component.change = 2.04;
    expect(component.changeLabel).toBe('+2.0');
    expect(component.changeDirection).toBe('up');
    component.change = -0.31;
    expect(component.changeLabel).toBe('-0.3');
    expect(component.changeDirection).toBe('down');
    component.change = 0.02;
    expect(component.changeLabel).toBe('0.0');
    expect(component.changeDirection).toBe('flat');
  });

  it('should show nothing for a team that hasn\'t played', () => {
    show(99, []);
    expect(fixture.nativeElement.querySelector('.power-rating-card')).toBeNull();
  });
});
