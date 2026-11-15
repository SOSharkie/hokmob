import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { mockNstTeamTable, mockTeamGames, mockTeamStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamStatsTabComponent } from './team-stats-tab.component';

describe('TeamStatsTabComponent', () => {
  let component: TeamStatsTabComponent;
  let fixture: ComponentFixture<TeamStatsTabComponent>;
  let httpMock: HttpTestingController;

  const teamGamesUrl = '/api/nhl-stats/team-games?season=20262027&gameType=2';

  const nstTeamsUrl = '/api/nst/teams?season=20262027';

  /** San Jose, 22 games into 2026-27 in the fixture. */
  const sharks = 28;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamStatsTabComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    fixture = TestBed.createComponent(TeamStatsTabComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
    fixture.destroy();
  });

  function show(teamId: number, season: number): void {
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('season', season);
    fixture.componentRef.setInput('teamStats', mockTeamStats().teams);
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function child(selector: string): any {
    return fixture.nativeElement.querySelector(selector);
  }

  it('should show the season stats and a spinner while the games load', () => {
    show(sharks, 20262027);
    httpMock.expectOne(teamGamesUrl);
    httpMock.expectOne(nstTeamsUrl).flush(mockNstTeamTable());
    expect(child('app-team-stats').teamId).toBe(sharks);
    expect(child('app-team-stats').teamStats.length).toBe(32);
    expect(child('.loading-card app-loading-spinner')).not.toBeNull();
    expect(child('app-team-power-rating')).toBeNull();
    expect(child('app-team-rating-chart')).toBeNull();
  });

  it('should rate every team from the season\'s real games', async () => {
    show(sharks, 20262027);
    httpMock.expectOne(nstTeamsUrl).flush(mockNstTeamTable());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    await settle();

    expect(child('.loading-card')).toBeNull();
    expect(component.ratings.length).toBe(32);
    expect(component.timeline.length).toBe(20);
    expect(child('app-team-power-rating').ratings).toBe(component.ratings);
    expect(child('app-team-power-rating').timeline).toBe(component.timeline);
    expect(child('app-team-advanced-stats').season).toBe(20262027);
    expect(child('app-team-rating-chart').games.length).toBe(650);
    expect(child('app-team-rating-chart').teamIds).toEqual([sharks]);
  });

  it('should keep the season stats when the games fail', async () => {
    show(sharks, 20262027);
    httpMock.expectOne(nstTeamsUrl).flush(mockNstTeamTable());
    httpMock.expectOne(teamGamesUrl).flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();

    expect(child('app-team-stats')).not.toBeNull();
    expect(child('app-team-power-rating')).toBeNull();
    expect(child('.team-stats-tab-message').textContent.trim())
        .toBe('The power rating and advanced stats couldn\'t be loaded');
  });

  it('should show no rating for a season without games', async () => {
    show(sharks, 20262027);
    httpMock.expectOne(nstTeamsUrl).flush('', {status: 404, statusText: 'Not Found'});
    httpMock.expectOne(teamGamesUrl).flush({games: {gameId: []}});
    await settle();

    expect(child('app-team-power-rating')).toBeNull();
    expect(child('app-team-advanced-stats')).toBeNull();
    expect(child('.team-stats-tab-message')).toBeNull();
    expect(child('app-team-stats')).not.toBeNull();
  });

  it('should wait for the season', () => {
    show(sharks, undefined);
    httpMock.expectNone(request => request.url.startsWith('/api/nhl-stats/team-games') || request.url.startsWith('/api/nst/'));
    expect(component.isLoading).toBeFalse();
  });

  it('should rate another team from the same games without asking again', async () => {
    show(sharks, 20262027);
    httpMock.expectOne(nstTeamsUrl).flush(mockNstTeamTable());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    await settle();

    fixture.componentRef.setInput('teamId', 6);
    fixture.detectChanges();
    httpMock.expectNone(teamGamesUrl);
    httpMock.expectNone(nstTeamsUrl);
    expect(component.teamIds).toEqual([6]);
    expect(component.timeline.length).toBeGreaterThan(0);
    expect(component.timeline.every(point => point.teamId === 6)).toBeTrue();
  });

  it('should drop a late response for the previous season', async () => {
    show(sharks, 20252026);
    const previous = httpMock.expectOne('/api/nhl-stats/team-games?season=20252026&gameType=2');
    const previousNst = httpMock.expectOne('/api/nst/teams?season=20252026');
    fixture.componentRef.setInput('season', 20262027);
    fixture.detectChanges();
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    httpMock.expectOne(nstTeamsUrl).flush(mockNstTeamTable());
    previous.flush({games: {gameId: []}});
    previousNst.flush({season: 20252026, teams: []});
    await settle();

    expect(component.games.length).toBe(650);
    expect(component.ratings.length).toBe(32);
    expect(component.nstTeams.length).toBe(32);
  });

  it("should pass NST's xG to the advanced stats card", async () => {
    show(sharks, 20262027);
    httpMock.expectOne(nstTeamsUrl).flush(mockNstTeamTable());
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    await settle();

    expect(child('app-team-advanced-stats').nstTeams.length).toBe(32);
  });

  it('should keep the rating and advanced stats when NST fails', async () => {
    show(sharks, 20262027);
    httpMock.expectOne(nstTeamsUrl).flush('', {status: 503, statusText: 'Service Unavailable'});
    httpMock.expectOne(teamGamesUrl).flush(mockTeamGames());
    await settle();

    expect(component.nstTeams).toEqual([]);
    expect(child('app-team-power-rating')).not.toBeNull();
    expect(child('app-team-advanced-stats').nstTeams).toEqual([]);
    expect(child('.team-stats-tab-message')).toBeNull();
  });
});
