import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockNstTeamGames, mockTeamGames, mockTeamStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamRatingUtils } from '@shared/utils/team-rating-utils';

import { GamePowerRatingsComponent } from './game-power-ratings.component';
import { TeamRatingViewToggleComponent } from '@app/team/team-rating-view-toggle/team-rating-view-toggle.component';

describe('GamePowerRatingsComponent', () => {
  let component: GamePowerRatingsComponent;
  let fixture: ComponentFixture<GamePowerRatingsComponent>;
  let httpMock: HttpTestingController;

  const teamGamesUrl = '/api/nhl-stats/team-games?season=20262027&gameType=2';

  const nstTeamGamesUrl = '/api/nst/team-games?season=20262027';

  const teamStatsUrl = '/api/nhl-stats/teams?season=20262027&gameType=2';

  /** San Jose, 22 games into 2026-27 in the fixture: rated 2.9, 30th, through 2026-11-14. */
  const sharks = 28;

  const bruins = 6;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      // With the toggle, so its buttons switch the card
      declarations: [ GamePowerRatingsComponent, TeamRatingViewToggleComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    fixture = TestBed.createComponent(GamePowerRatingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
    fixture.destroy();
  });

  function show(homeTeamId: number, awayTeamId: number, season: number = 20262027): void {
    fixture.componentRef.setInput('season', season);
    fixture.componentRef.setInput('homeTeamId', homeTeamId);
    fixture.componentRef.setInput('awayTeamId', awayTeamId);
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** The card, or null while it's hidden. */
  function card(): HTMLElement {
    return fixture.nativeElement.querySelector('.game-power-ratings');
  }

  /** Each team's power rating, the home team's first. */
  function powerRatings(): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-team-power-rating'));
  }

  /** Each team's season stats, the home team's first. */
  function teamStats(): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-team-stats'));
  }

  function toggle(): HTMLElement {
    return fixture.nativeElement.querySelector('app-team-rating-view-toggle');
  }

  function option(title: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.toggle-option[title="' + title + '"]');
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  /** Answers the season stats request with every team's real stats (the mocks have 2025-26's). */
  function flushTeamStats(): void {
    httpMock.expectOne(teamStatsUrl).flush(mockTeamStats());
  }

  /**
   * Answers the requests with the real 2026-27 games through 2026-11-14, NST's expected goals and every team's stats.
   */
  async function flushGames(): Promise<void> {
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    flushTeamStats();
    await settle();
  }

  it('should show nothing while the games load', () => {
    show(sharks, bruins);
    expect(card()).toBeNull();
    httpMock.expectOne(teamGamesUrl);
    httpMock.expectOne(nstTeamGamesUrl);
    httpMock.expectOne(teamStatsUrl);
  });

  it('should show one card with the home team\'s power rating and then the away team\'s, rated with xG', async () => {
    show(sharks, bruins);
    await flushGames();
    expect(fixture.nativeElement.querySelectorAll('.game-power-ratings').length).toBe(1);
    expect(text('.game-power-ratings-title')).toBe('Power Rating');
    const [home, away] = powerRatings();
    expect(powerRatings().length).toBe(2);
    expect(home.teamId).toBe(sharks);
    expect(away.teamId).toBe(bruins);
    // Each half names its team, without a card of its own or the note, which the card gives once
    [home, away].forEach(half => {
      expect(half.showTeam).toBeTrue();
      expect(half.embedded).toBeTrue();
      expect(half.showNote).toBeFalse();
    });
    expect(home.ratings.length).toBe(32);
    expect(away.ratings).toBe(home.ratings);
    const sanJose = component.ratings.find(rating => rating.teamId === sharks);
    expect(TeamRatingUtils.formatRating(sanJose.rating)).toBe('2.9');
    expect(sanJose.rank).toBe(30);
    expect(sanJose.hasExpectedGoals).toBeTrue();
  });

  it('should have one toggle, in the card\'s header, that switches both teams to their season stats and back', async () => {
    show(sharks, bruins);
    await flushGames();
    const toggles = fixture.nativeElement.querySelectorAll('app-team-rating-view-toggle');
    expect(toggles.length).toBe(1);
    expect(toggles[0].parentElement.classList).toContain('game-power-ratings-header');
    expect(option('Power rating').getAttribute('aria-pressed')).toBe('true');

    option('Season stats').click();
    fixture.detectChanges();
    expect(powerRatings().length).toBe(0);
    const [home, away] = teamStats();
    expect(teamStats().length).toBe(2);
    expect(home.teamId).toBe(sharks);
    expect(away.teamId).toBe(bruins);
    expect(home.teamStats.length).toBe(32);
    expect(away.teamStats).toBe(home.teamStats);
    expect(home.showTeam).toBeTrue();
    expect(home.embedded).toBeTrue();
    expect(text('.game-power-ratings-title')).toBe('Team Stats');
    expect(option('Season stats').getAttribute('aria-pressed')).toBe('true');
    // The note is about the power ratings
    expect(fixture.nativeElement.querySelector('.game-power-ratings-note')).toBeNull();

    option('Power rating').click();
    fixture.detectChanges();
    expect(powerRatings().length).toBe(2);
    expect(text('.game-power-ratings-title')).toBe('Power Rating');
  });

  it('should have no toggle while the season stats load', async () => {
    show(sharks, bruins);
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    await settle();
    expect(powerRatings().length).toBe(2);
    expect(toggle()).toBeNull();
    flushTeamStats();
    await settle();
    expect(toggle()).not.toBeNull();
  });

  it('should keep the power ratings when the season stats fail, without a toggle', async () => {
    show(sharks, bruins);
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    httpMock.expectOne(teamStatsUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();
    expect(powerRatings().length).toBe(2);
    expect(toggle()).toBeNull();
    expect(component.teamStats).toEqual([]);
    expect(component.statsLoading).toBeFalse();
    // Without the stats, picking them still shows the power ratings
    component.view = 'stats';
    fixture.detectChanges();
    expect(powerRatings().length).toBe(2);
    expect(text('.game-power-ratings-title')).toBe('Power Rating');
  });

  it('should have no toggle when a team has no season stats', async () => {
    show(sharks, bruins);
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    const stats = mockTeamStats();
    stats.teams = stats.teams.filter(team => team.teamId !== bruins);
    httpMock.expectOne(teamStatsUrl).flush(stats);
    await settle();
    expect(powerRatings().length).toBe(2);
    expect(toggle()).toBeNull();
  });

  it('should note the league average once in the card, centered, and credit Natural Stat Trick', async () => {
    show(sharks, bruins);
    await flushGames();
    const notes: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.game-power-ratings-note'));
    expect(notes.length).toBe(1);
    expect(card().contains(notes[0])).toBeTrue();
    expect(notes[0].textContent.replace(/\s+/g, ' ').trim()).toBe('5.0 is league average. xG from Natural Stat Trick');
    expect(getComputedStyle(notes[0]).textAlign).toBe('center');
    const credit: HTMLAnchorElement = notes[0].querySelector('.power-rating-source');
    expect(credit.href).toBe('https://www.naturalstattrick.com/teamtable.php');
    expect(credit.target).toBe('_blank');
  });

  it('should put the teams side by side in one card, each half a size container for the compact layout', async () => {
    show(sharks, bruins);
    await flushGames();
    expect(getComputedStyle(card()).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const grid: HTMLElement = fixture.nativeElement.querySelector('.game-power-ratings-teams');
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(2);
    const halves: HTMLElement[] = Array.from(grid.querySelectorAll('.game-power-ratings-team'));
    expect(halves.length).toBe(2);
    halves.forEach(half => expect(getComputedStyle(half).containerName).toBe('power-rating'));
    // A line between the teams
    expect(getComputedStyle(halves[1]).borderLeftStyle).toBe('solid');
  });

  it('should give each team its own timeline, through its last game', async () => {
    show(sharks, bruins);
    await flushGames();
    const [home, away] = powerRatings();
    // San Jose had played 22 games, and the timeline starts at its third
    expect(home.timeline[home.timeline.length - 1].gamesPlayed).toBe(22);
    expect(home.timeline.length).toBe(22 - TeamRatingUtils.minChartGames + 1);
    expect(home.timeline.every(point => point.teamId === sharks)).toBeTrue();
    expect(away.timeline.length).toBeGreaterThan(0);
    expect(away.timeline.every(point => point.teamId === bruins)).toBeTrue();
  });

  it('should rate without expected goals when Natural Stat Trick fails', async () => {
    show(sharks, bruins);
    httpMock.expectOne(nstTeamGamesUrl).flush('Unavailable', {status: 503, statusText: 'Service Unavailable'});
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    flushTeamStats();
    await settle();
    expect(powerRatings().length).toBe(2);
    const sanJose = component.ratings.find(rating => rating.teamId === sharks);
    // San Jose's rating from the NHL's stats alone
    expect(TeamRatingUtils.formatRating(sanJose.rating)).toBe('3.4');
    expect(sanJose.hasExpectedGoals).toBeFalse();
    expect(component.hasExpectedGoals).toBeFalse();
    const note: HTMLElement = fixture.nativeElement.querySelector('.game-power-ratings-note');
    expect(note.querySelector('.power-rating-source')).toBeNull();
    expect(note.querySelector('.power-rating-fallback').textContent.trim())
        .toBe('Rated without expected goals, which aren\'t available right now.');
  });

  it('should show nothing when the games fail to load', async () => {
    show(sharks, bruins);
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    httpMock.expectOne(teamGamesUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    flushTeamStats();
    await settle();
    expect(component.ratings).toEqual([]);
    expect(card()).toBeNull();
    expect(fixture.nativeElement.querySelector('.game-power-ratings-note')).toBeNull();
  });

  it('should show nothing until both teams have played', async () => {
    // Arizona has no games in 2026-27
    show(sharks, 53);
    await flushGames();
    expect(component.ratings.length).toBe(32);
    expect(card()).toBeNull();
  });

  it('should show nothing for a season without games yet', async () => {
    show(sharks, bruins);
    httpMock.expectOne(nstTeamGamesUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
    httpMock.expectOne(teamGamesUrl).flush({games: {}});
    flushTeamStats();
    await settle();
    expect(card()).toBeNull();
  });

  it('should load the games once, not again when the inputs are set to the same game', async () => {
    show(sharks, bruins);
    await flushGames();
    show(sharks, bruins);
    httpMock.expectNone(teamGamesUrl);
    httpMock.expectNone(teamStatsUrl);
    expect(powerRatings().length).toBe(2);
  });

  it('should drop a late response for the game shown before', async () => {
    show(sharks, bruins);
    const oldNst = httpMock.expectOne(nstTeamGamesUrl);
    const oldGames = httpMock.expectOne(teamGamesUrl);
    show(sharks, bruins, 20252026);
    oldNst.flush(mockNstTeamGames());
    oldGames.flush(mockTeamGames());
    await settle();
    expect(component.ratings).toEqual([]);
    httpMock.expectOne('/api/nst/team-games?season=20252026');
    httpMock.expectOne('/api/nhl-stats/team-games?season=20252026&gameType=2');
    httpMock.expectOne(teamStatsUrl);
    httpMock.expectOne('/api/nhl-stats/teams?season=20252026&gameType=2');
  });
});
