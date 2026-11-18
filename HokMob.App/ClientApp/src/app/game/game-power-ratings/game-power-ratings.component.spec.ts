import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockNstTeamGames, mockTeamGames } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';
import { TeamRatingUtils } from '@shared/utils/team-rating-utils';

import { GamePowerRatingsComponent } from './game-power-ratings.component';

describe('GamePowerRatingsComponent', () => {
  let component: GamePowerRatingsComponent;
  let fixture: ComponentFixture<GamePowerRatingsComponent>;
  let httpMock: HttpTestingController;

  const teamGamesUrl = '/api/nhl-stats/team-games?season=20262027&gameType=2';

  const nstTeamGamesUrl = '/api/nst/team-games?season=20262027';

  /** San Jose, 22 games into 2026-27 in the fixture: rated 2.9, 30th, through 2026-11-14. */
  const sharks = 28;

  const bruins = 6;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GamePowerRatingsComponent ],
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

  function cards(): any[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-team-power-rating'));
  }

  /** Answers both requests with the real 2026-27 games through 2026-11-14 and NST's expected goals. */
  async function flushGames(): Promise<void> {
    httpMock.expectOne(nstTeamGamesUrl).flush(mockNstTeamGames());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    await settle();
  }

  it('should show nothing while the games load', () => {
    show(sharks, bruins);
    expect(cards().length).toBe(0);
    httpMock.expectOne(teamGamesUrl);
    httpMock.expectOne(nstTeamGamesUrl);
  });

  it('should show the home team\'s card and then the away team\'s, rated on the season with expected goals', async () => {
    show(sharks, bruins);
    await flushGames();
    const [home, away] = cards();
    expect(cards().length).toBe(2);
    expect(home.teamId).toBe(sharks);
    expect(away.teamId).toBe(bruins);
    expect(home.showTeam).toBeTrue();
    expect(away.showTeam).toBeTrue();
    // Noted once under both cards instead
    expect(home.showNote).toBeFalse();
    expect(away.showNote).toBeFalse();
    expect(home.ratings.length).toBe(32);
    expect(away.ratings).toBe(home.ratings);
    const sanJose = component.ratings.find(rating => rating.teamId === sharks);
    expect(TeamRatingUtils.formatRating(sanJose.rating)).toBe('2.9');
    expect(sanJose.rank).toBe(30);
    expect(sanJose.hasExpectedGoals).toBeTrue();
  });

  it('should note the league average once under the cards, centered, and credit Natural Stat Trick', async () => {
    show(sharks, bruins);
    await flushGames();
    const notes: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.game-power-ratings-note'));
    expect(notes.length).toBe(1);
    expect(notes[0].textContent.replace(/\s+/g, ' ').trim()).toBe('5.0 is league average. xG from Natural Stat Trick');
    expect(getComputedStyle(notes[0]).textAlign).toBe('center');
    const credit: HTMLAnchorElement = notes[0].querySelector('.power-rating-source');
    expect(credit.href).toBe('https://www.naturalstattrick.com/teamtable.php');
    expect(credit.target).toBe('_blank');
  });

  it('should put the cards side by side', async () => {
    show(sharks, bruins);
    await flushGames();
    const grid: HTMLElement = fixture.nativeElement.querySelector('.game-power-ratings');
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(2);
  });

  it('should give each card its own team\'s timeline, through its last game', async () => {
    show(sharks, bruins);
    await flushGames();
    const [home, away] = cards();
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
    await settle();
    expect(cards().length).toBe(2);
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
    await settle();
    expect(component.ratings).toEqual([]);
    expect(cards().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.game-power-ratings-note')).toBeNull();
  });

  it('should show nothing until both teams have played', async () => {
    // Arizona has no games in 2026-27
    show(sharks, 53);
    await flushGames();
    expect(component.ratings.length).toBe(32);
    expect(cards().length).toBe(0);
  });

  it('should show nothing for a season without games yet', async () => {
    show(sharks, bruins);
    httpMock.expectOne(nstTeamGamesUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
    httpMock.expectOne(teamGamesUrl).flush({games: {}});
    await settle();
    expect(cards().length).toBe(0);
  });

  it('should load the games once, not again when the inputs are set to the same game', async () => {
    show(sharks, bruins);
    await flushGames();
    show(sharks, bruins);
    httpMock.expectNone(teamGamesUrl);
    expect(cards().length).toBe(2);
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
  });
});
