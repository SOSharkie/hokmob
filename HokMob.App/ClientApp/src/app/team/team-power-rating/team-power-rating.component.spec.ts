import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockRatedTeamGameRows, mockTeamGameRows } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamRating, TeamRatingPoint, TeamRatingUtils } from '@shared/utils/team-rating-utils';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';

import { TeamPowerRatingComponent } from './team-power-rating.component';

describe('TeamPowerRatingComponent', () => {
  let component: TeamPowerRatingComponent;
  let fixture: ComponentFixture<TeamPowerRatingComponent>;
  let ratings: TeamRating[];
  let timeline: TeamRatingPoint[];

  /** San Jose, 22 games into 2026-27: 47.0% of the 5v5 shot attempts and 39.5% of the xG. */
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
    const games = mockRatedTeamGameRows();
    ratings = TeamRatingUtils.getLeagueRatings(games);
    timeline = TeamRatingUtils.getTimeline(games, [sharks]).get(sharks);
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(teamId: number, points: TeamRatingPoint[] = timeline, teamRatings: TeamRating[] = ratings): void {
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('ratings', teamRatings);
    fixture.componentRef.setInput('timeline', points);
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function parts(): {name: string, shortName: string, weight: string, value: string, rank: string}[] {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.rating-part'));
    return rows.map(row => ({
      name: row.querySelector('.part-name').textContent.trim(),
      shortName: row.querySelector('.part-short-name').textContent.trim(),
      weight: row.querySelector('.part-weight').textContent.trim(),
      value: row.querySelector('.part-value').textContent.trim(),
      rank: row.querySelector('.part-rank').textContent.trim()
    }));
  }

  it('should show the team\'s rating, rank and games', () => {
    show(sharks);
    const team = ratings.find(rating => rating.teamId === sharks);
    expect(text('.rating-badge')).toBe(team.rating.toFixed(1));
    expect(text('.rating-rank')).toBe(TeamRatingUtils.getOrdinal(team.rank) + ' of 32');
    // The games played show on hover over the rating and its rank, not on the card
    expect(fixture.nativeElement.querySelector('.rating-badge').title).toBe('Through 22 games');
    expect(fixture.nativeElement.querySelector('.rating-rank').title).toBe('Through 22 games');
    expect(text('.power-rating-card')).not.toContain('Through');
  });

  it('should show the rating\'s rank in white, with the team count quieter beside it', () => {
    show(sharks);
    expect(getComputedStyle(fixture.nativeElement.querySelector('.rating-rank')).color).toBe('rgb(255, 255, 255)');
    expect(text('.rating-rank-total')).toBe('of 32');
    expect(getComputedStyle(fixture.nativeElement.querySelector('.rating-rank-total')).color)
        .toBe('rgb(149, 149, 149)');
  });

  it('should list the stats under one group title', () => {
    show(sharks);
    expect(text('.rating-group-title')).toBe('Built from');
    expect(fixture.nativeElement.querySelectorAll('.rating-group .rating-part').length).toBe(6);
  });

  it('should color each stat\'s rank pill and bar only in the league\'s top and bottom 10', () => {
    show(sharks);
    const team = ratings.find(rating => rating.teamId === sharks);
    const pills: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.part-rank'));
    const fills: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.part-bar-fill'));
    component.parts.forEach((part, index) => {
      const metric = TeamRatingUtils.getRatedMetrics(team.weights)[index];
      expect(part.rankTier).toBe(TeamRatingUtils.getRankTier(team.ranks[metric.id], 32));
      expect(pills[index].classList).toContain('rank-' + part.rankTier);
      expect(fills[index].classList).toContain('rank-' + part.rankTier);
    });
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
      ['5v5 Corsi %', '30%'], ['5v5 xGF%', '15%'], ['5v5 Shooting %', '15%'], ['5v5 Save %', '10%'],
      ['Net Power Play %', '20%'], ['Penalty Diff / Game', '10%']
    ]);
    expect(rows.map(row => row.value)).toEqual(['47.0%', '39.5%', '6.8%', '90.6%', '17.6%', '+0.23']);
    const team = ratings.find(rating => rating.teamId === sharks);
    expect(rows[0].rank).toBe(TeamRatingUtils.getOrdinal(team.ranks.corsi));
    expect(rows[5].rank).toBe(TeamRatingUtils.getOrdinal(team.ranks.penaltyDiff));
    // San Jose, 30th through 2026-11-14
    expect(text('.rating-badge')).toBe('2.9');
    expect(text('.rating-rank')).toBe('30th of 32');
  });

  it('should give each stat its short name, for a compact card', () => {
    show(sharks);
    expect(parts().map(row => row.shortName)).toEqual([
      'Corsi %', 'xGF%', 'Shooting %', 'Save %', 'Power play', 'Penalties'
    ]);
  });

  it('should show a skeleton while loading: the rating, then a bar row per stat', () => {
    fixture.componentRef.setInput('loading', true);
    show(sharks, [], []);
    const skeleton = fixture.nativeElement.querySelector('app-skeleton-card');
    expect(skeleton.getAttribute('shape')).toBe('bar');
    expect(skeleton.cardTitle).toBe('Power Rating');
    expect(skeleton.layout).toEqual(jasmine.objectContaining({rows: 6, summaryHeight: 72}));
    // As tall as the card: 462px, or 454px on a phone, where the rating is smaller
    const layout = skeleton.layout;
    const rowsHeight = layout.headerHeight + layout.rows * layout.rowHeight + layout.paddingBottom;
    expect(rowsHeight + layout.summaryHeight).toBe(462);
    expect(skeleton.mobileLayout).toEqual({summaryHeight: 64});
    expect(rowsHeight + skeleton.mobileLayout.summaryHeight).toBe(454);
    expect(fixture.nativeElement.querySelector('.power-rating-card')).toBeNull();

    fixture.componentRef.setInput('loading', false);
    show(sharks);
    expect(fixture.nativeElement.querySelector('app-skeleton-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.power-rating-card')).not.toBeNull();
  });

  it('should rate nothing from the standings', () => {
    show(sharks);
    const names = parts().map(row => row.name);
    expect(names).not.toContain('Points %');
    expect(names).not.toContain('Goal Diff / Game');
  });

  it('should draw each stat\'s bar from the league average', () => {
    show(sharks);
    const team = ratings.find(rating => rating.teamId === sharks);
    const expectedGoals = component.parts[1];
    // San Jose's xGF% is below average, so its bar ends at the middle of the track
    expect(team.scores.expectedGoals).toBeLessThan(TeamRatingUtils.averageRating);
    expect(expectedGoals.isAboveAverage).toBeFalse();
    expect(expectedGoals.barStart + expectedGoals.barWidth).toBeCloseTo(50, 10);
    // The track is 0 to 10, so a score of 3.2 starts 32% of the way along it
    expect(expectedGoals.barStart).toBeCloseTo(team.scores.expectedGoals * 10, 10);
  });

  it('should draw a stat the team is above average at to the right of the middle', () => {
    show(sharks);
    const team = ratings.find(rating => rating.teamId === sharks);
    const penaltyDiff = component.parts[5];
    // San Jose draws more penalties than it takes
    expect(team.scores.penaltyDiff).toBeGreaterThan(TeamRatingUtils.averageRating);
    expect(penaltyDiff.isAboveAverage).toBeTrue();
    expect(penaltyDiff.barStart).toBeCloseTo(50, 10);
  });

  it('should credit Natural Stat Trick for the expected goals', () => {
    show(sharks);
    const credit: HTMLAnchorElement = fixture.nativeElement.querySelector('.power-rating-source');
    expect(credit.textContent.trim()).toBe('xG from Natural Stat Trick');
    expect(credit.href).toBe('https://www.naturalstattrick.com/teamtable.php');
    expect(credit.target).toBe('_blank');
    expect(fixture.nativeElement.querySelector('.power-rating-fallback')).toBeNull();
  });

  it('should leave the note out when asked, for a page that notes it once under its cards', () => {
    fixture.componentRef.setInput('showNote', false);
    show(sharks);
    expect(fixture.nativeElement.querySelector('.rating-bar-card-note')).toBeNull();
    expect(fixture.nativeElement.querySelector('.rating-part')).not.toBeNull();
  });

  describe('without expected goals', () => {
    let nhlRatings: TeamRating[];

    beforeEach(() => {
      const games = mockTeamGameRows();
      nhlRatings = TeamRatingUtils.getLeagueRatings(games);
      show(sharks, TeamRatingUtils.getTimeline(games, [sharks]).get(sharks), nhlRatings);
    });

    it('should list the NHL\'s stats with their weights', () => {
      const rows = parts();
      expect(rows.map(row => [row.name, row.weight])).toEqual([
        ['5v5 Corsi %', '45%'], ['5v5 Shooting %', '15%'], ['5v5 Save %', '10%'], ['Net Power Play %', '20%'],
        ['Penalty Diff / Game', '10%']
      ]);
      expect(rows.map(row => row.value)).toEqual(['47.0%', '6.8%', '90.6%', '17.6%', '+0.23']);
    });

    it('should show the rating worked out from them', () => {
      // San Jose, 28th through 2026-11-14 on the NHL's stats alone
      expect(text('.rating-badge')).toBe('3.4');
      expect(text('.rating-rank')).toBe('28th of 32');
    });

    it('should say so instead of crediting Natural Stat Trick', () => {
      expect(text('.power-rating-fallback')).toBe('Rated without expected goals, which aren\'t available right now.');
      expect(fixture.nativeElement.querySelector('.power-rating-source')).toBeNull();
    });
  });

  it('should show the change over the last 5 games', () => {
    show(sharks);
    const change = timeline[timeline.length - 1].rating - timeline[timeline.length - 6].rating;
    expect(component.change).toBeCloseTo(change, 10);
    // The arrow shows the direction, and a screen reader hears it as a word
    const direction = change > 0 ? 'Up' : 'Down';
    expect(text('.rating-change')).toContain(direction + ' ' + Math.abs(change).toFixed(1) + ' over the last 5 games');
    expect(text('.power-rating-hidden')).toBe(direction);
  });

  it('should show no change before 6 games', () => {
    show(sharks, timeline.slice(0, 5));
    expect(component.change).toBeNull();
    expect(fixture.nativeElement.querySelector('.rating-change')).toBeNull();
  });

  it('should label a rise, a fall and no change', () => {
    show(sharks);
    component.change = 2.04;
    expect(component.changeLabel).toBe('2.0');
    expect(component.changeDirection).toBe('up');
    component.change = -0.31;
    expect(component.changeLabel).toBe('0.3');
    expect(component.changeDirection).toBe('down');
    component.change = 0.02;
    expect(component.changeLabel).toBe('0.0');
    expect(component.changeDirection).toBe('flat');
  });

  it('should title the card without the team on the team page', () => {
    show(sharks);
    expect(text('.rating-bar-card-title')).toBe('Power Rating');
    expect(text('.rating-bar-card-short-title')).toBe('Power Rating');
    expect(fixture.nativeElement.querySelector('.rating-bar-card-logo')).toBeNull();
  });

  it('should name the team with its logo instead when asked, for a page with more than one card', () => {
    fixture.componentRef.setInput('showTeam', true);
    show(sharks);
    expect(text('.rating-bar-card-title')).toBe('Sharks');
    // Its stats say which card it is instead
    expect(text('.rating-group-title')).toBe('Power Rating');
    // A compact card's title, beside the logo
    expect(text('.rating-bar-card-short-title')).toBe('SJS');
    const logo: HTMLImageElement = fixture.nativeElement.querySelector('.rating-bar-card-logo');
    expect(logo.getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(sharks));
    expect(logo.alt).toBe('');
  });

  it('should show nothing for a team that hasn\'t played', () => {
    show(99, []);
    expect(fixture.nativeElement.querySelector('.power-rating-card')).toBeNull();
  });
});
