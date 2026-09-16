import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { SkaterSeasonStats } from '@shared/models/nhl-stats-api/player-stats.model';
import {
  mockPlayerLanding,
  mockPlayerStats
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerComponent } from './player.component';

describe('PlayerComponent', () => {
  let component: PlayerComponent;
  let fixture: ComponentFixture<PlayerComponent>;
  let httpMock: HttpTestingController;
  let routeParams: BehaviorSubject<Params>;

  const landingUrl = '/api/nhl/player/';
  const statsUrl = '/api/nhl-stats/player/';

  beforeEach(async () => {
    routeParams = new BehaviorSubject<Params>({});
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerComponent ],
      providers: [ {provide: ActivatedRoute, useValue: {params: routeParams}} ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  function open(playerId: number): void {
    routeParams.next({id: String(playerId)});
    fixture = TestBed.createComponent(PlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Waits for the component's promises to settle and renders the result. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Answers the landing and stats requests of a player page with their real responses. */
  async function flushPlayerPage(playerId: 8476945 | 8477964, position: string = 'skater'): Promise<void> {
    httpMock.expectOne(landingUrl + playerId + '/landing').flush(mockPlayerLanding(playerId));
    await settle();
    httpMock.expectOne(statsUrl + playerId + '?position=' + position).flush(mockPlayerStats(playerId));
    await settle();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function child(selector: string): any {
    return fixture.nativeElement.querySelector(selector);
  }

  it('should show a real skater with his bio, season cards, recent games and career', async () => {
    open(8477964);
    expect(child('.player-container')).toBeNull();
    await flushPlayerPage(8477964);

    expect(text('.player-name')).toBe('Ivan Barbashev');
    expect(text('.player-team-label')).toBe('Vegas Golden Knights');
    expect(component.teamColor).toBe('#B4975A');
    expect(child('.player-headshot').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/20262027/VGK/8477964.png');
    expect(child('app-player-bio').player.lastName.default).toBe('Barbashev');
    expect(child('app-player-bio').countryFlagPath).toBe('assets/flags/RUS.png');

    // The cards show the featured season of the landing (2025-26), not the calendar season
    expect(child('.regular-season-stats app-player-stats').statTitle).toBe('2025-2026 NHL Regular Season Stats');
    expect((child('.regular-season-stats app-player-stats').stats as SkaterSeasonStats).points).toBe(61);
    expect(child('.playoff-stats app-player-stats').statTitle).toBe('2026 NHL Playoffs Stats');
    expect((child('.playoff-stats app-player-stats').stats as SkaterSeasonStats).points).toBe(14);
    expect(child('app-player-stats').isGoalie).toBeFalse();

    expect(child('app-recent-player-games').games.length).toBe(10);
    expect(child('app-recent-player-games').games[0].gameId).toBe(2025030416);
    expect(child('app-player-career').seasons.length).toBe(10);
    expect(child('app-player-career').seasons[0].seasonId).toBe(20252026);
    expect(child('.stats-error')).toBeNull();
  });

  it('should link the header to the current team of the player', async () => {
    open(8477964);
    await flushPlayerPage(8477964);
    const routerLink = fixture.debugElement.query(By.directive(RouterLink)).injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/team/54');
  });

  it('should ask for the goalie stats of a goalie, and show no card for playoffs he did not play', async () => {
    open(8476945);
    await flushPlayerPage(8476945, 'goalie');

    expect(text('.player-name')).toBe('Connor Hellebuyck');
    expect(component.isGoalie).toBeTrue();
    expect(child('app-player-stats').isGoalie).toBeTrue();
    expect(child('.regular-season-stats app-player-stats').statTitle).toBe('2025-2026 NHL Regular Season Stats');
    // His last playoff season is 2024-25, so the 2025-26 playoff card isn't shown
    expect(child('.playoff-stats')).toBeNull();
    expect(child('app-recent-player-games').isGoalie).toBeTrue();
  });

  it('should show a retired player without a team link or stats sections', async () => {
    open(8470638);
    httpMock.expectOne(landingUrl + '8470638/landing').flush(mockPlayerLanding(8470638));
    await settle();
    expect(text('.player-name')).toBe('Patrice Bergeron');
    expect(child('.player-team')).toBeNull();
    expect(component.teamColor).toBe('#000000');

    httpMock.expectOne(statsUrl + '8470638?position=skater')
        .flush({regularSeasons: [], playoffSeasons: [], recentGames: []});
    await settle();
    expect(child('app-player-bio')).not.toBeNull();
    expect(child('app-player-stats')).toBeNull();
    expect(child('app-recent-player-games')).toBeNull();
    expect(child('app-player-career')).toBeNull();
    expect(child('.stats-error')).toBeNull();
  });

  it('should show that the player could not be loaded when the landing fails', async () => {
    open(1);
    httpMock.expectOne(landingUrl + '1/landing').flush('Not found', {status: 404, statusText: 'Not Found'});
    await settle();
    expect(text('.player-error')).toBe('This player couldn\'t be loaded');
    expect(child('.player-container')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('should keep the header and bio when the stats fail', async () => {
    open(8477964);
    httpMock.expectOne(landingUrl + '8477964/landing').flush(mockPlayerLanding(8477964));
    await settle();
    httpMock.expectOne(statsUrl + '8477964?position=skater')
        .flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();

    expect(text('.player-name')).toBe('Ivan Barbashev');
    expect(child('app-player-bio')).not.toBeNull();
    expect(text('.stats-error')).toBe('Stats couldn\'t be loaded');
    expect(child('app-player-stats')).toBeNull();
    expect(child('app-recent-player-games')).toBeNull();
    expect(child('app-player-career')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('should load the next player when the route changes, and not show the previous one', async () => {
    open(8477964);
    await flushPlayerPage(8477964);
    expect(text('.player-name')).toBe('Ivan Barbashev');

    routeParams.next({id: '8476945'});
    fixture.detectChanges();
    expect(child('.player-container')).toBeNull();
    await flushPlayerPage(8476945, 'goalie');
    expect(text('.player-name')).toBe('Connor Hellebuyck');
    expect(child('app-player-career').seasons.length).toBe(11);
  });

  it('should ignore a late response for the player that was left', async () => {
    open(8477964);
    const firstLanding = httpMock.expectOne(landingUrl + '8477964/landing');
    routeParams.next({id: '8476945'});
    fixture.detectChanges();
    firstLanding.flush(mockPlayerLanding(8477964));
    await settle();

    expect(component.player).toBeUndefined();
    await flushPlayerPage(8476945, 'goalie');
    expect(text('.player-name')).toBe('Connor Hellebuyck');
  });
});
