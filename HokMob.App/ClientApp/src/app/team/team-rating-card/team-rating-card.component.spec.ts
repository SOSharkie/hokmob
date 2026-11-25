import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockRatedTeamGameRows, mockTeamStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamRating, TeamRatingPoint, TeamRatingUtils } from '@shared/utils/team-rating-utils';
import { TeamSeasonStats } from '@shared/models/nhl-stats-api/team-stats.model';

import { TeamRatingCardComponent, TeamRatingCardView } from './team-rating-card.component';
import { TeamRatingViewToggleComponent } from '../team-rating-view-toggle/team-rating-view-toggle.component';

describe('TeamRatingCardComponent', () => {
  let component: TeamRatingCardComponent;
  let fixture: ComponentFixture<TeamRatingCardComponent>;
  let ratings: TeamRating[];
  let timeline: TeamRatingPoint[];
  let teamStats: TeamSeasonStats[];

  /** San Jose: rated through 2026-11-14 in the games fixture, and in every team's stats. */
  const sharks = 28;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      // With its toggle, so its buttons switch the card
      declarations: [ TeamRatingCardComponent, TeamRatingViewToggleComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamRatingCardComponent);
    component = fixture.componentInstance;
    const games = mockRatedTeamGameRows();
    ratings = TeamRatingUtils.getLeagueRatings(games);
    timeline = TeamRatingUtils.getTimeline(games, [sharks]).get(sharks);
    teamStats = mockTeamStats().teams;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function show(inputs: Partial<Record<keyof TeamRatingCardComponent, unknown>> = {}): void {
    const values = {teamId: sharks, ratings, timeline, teamStats, ...inputs};
    Object.entries(values).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
  }

  function child(selector: string): any {
    return fixture.nativeElement.querySelector(selector);
  }

  function option(title: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.toggle-option[title="' + title + '"]');
  }

  it('should show the power rating first, with the toggle in its header', () => {
    show();
    const card = child('app-team-power-rating');
    expect(card.teamId).toBe(sharks);
    expect(card.ratings).toBe(ratings);
    expect(card.timeline).toBe(timeline);
    expect(card.loading).toBeFalse();
    expect(child('app-team-stats')).toBeNull();
    // Projected into the card's header, like its own content
    expect(card.querySelector('.card-view-toggle')).not.toBeNull();
    expect(option('Power rating').getAttribute('aria-pressed')).toBe('true');
    expect(option('Season stats').getAttribute('aria-pressed')).toBe('false');
  });

  it('should switch to the season stats and back, and tell the page', () => {
    show();
    const views: TeamRatingCardView[] = [];
    component.viewChange.subscribe(view => views.push(view));
    option('Season stats').click();
    fixture.detectChanges();
    const card = child('app-team-stats');
    expect(child('app-team-power-rating')).toBeNull();
    expect(card.teamId).toBe(sharks);
    expect(card.teamStats).toBe(teamStats);
    expect(card.querySelector('.card-view-toggle')).not.toBeNull();
    expect(option('Season stats').classList).toContain('selected');

    option('Power rating').click();
    fixture.detectChanges();
    expect(child('app-team-power-rating')).not.toBeNull();
    expect(views).toEqual(['stats', 'power']);
  });

  it('should not tell the page about the card already shown', () => {
    show();
    const views: TeamRatingCardView[] = [];
    component.viewChange.subscribe(view => views.push(view));
    option('Power rating').click();
    expect(views).toEqual([]);
  });

  it('should show the card the page picks', () => {
    show({view: 'stats'});
    expect(child('app-team-stats')).not.toBeNull();
  });

  it('should show the power rating\'s skeleton without a toggle while the ratings load', () => {
    show({ratings: [], timeline: [], ratingLoading: true});
    expect(child('app-team-power-rating').loading).toBeTrue();
    expect(child('.card-view-toggle')).toBeNull();
  });

  it('should show the stats\' skeleton without a toggle while they load', () => {
    show({view: 'stats', teamStats: [], statsLoading: true});
    expect(child('app-team-stats').loading).toBeTrue();
    expect(child('.card-view-toggle')).toBeNull();
  });

  it('should show the stats alone for a team without a rating, like when the games fail', () => {
    show({ratings: [], timeline: []});
    expect(child('app-team-power-rating')).toBeNull();
    expect(child('app-team-stats').teamStats).toBe(teamStats);
    expect(child('.card-view-toggle')).toBeNull();
  });

  it('should show the power rating alone without the team\'s stats', () => {
    show({view: 'stats', teamStats: []});
    expect(child('app-team-power-rating')).not.toBeNull();
    expect(child('.card-view-toggle')).toBeNull();
  });

  it('should be a size container, for the compact card and the toggle\'s labels', () => {
    show();
    expect(getComputedStyle(fixture.nativeElement).containerName).toBe('power-rating');
  });
});
