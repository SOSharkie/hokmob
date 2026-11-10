import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { RouterExtensionService } from '@shared/services/router-extension.service';
import { By, DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { registerLucideIcons } from '@shared/icons/lucide-icons';
import { BehaviorSubject } from 'rxjs';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { SkaterSeasonStats } from '@shared/models/nhl-stats-api/player-stats.model';
import {
  mockPlayerLanding,
  mockPlayerStats,
  mockSeasonHistory
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerComponent } from './player.component';

describe('PlayerComponent', () => {
  let component: PlayerComponent;
  let fixture: ComponentFixture<PlayerComponent>;
  let httpMock: HttpTestingController;
  let routeParams: BehaviorSubject<Params>;

  const landingUrl = '/api/nhl/player/';
  const statsUrl = '/api/nhl-stats/player/';
  const historyUrl = 'assets/history/20252026-2.json';

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
    registerLucideIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
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

  /**
   * Answers the landing and stats requests of a player page with their real responses, and the featured season's
   * history file with the 7 game fixture. The file is kept for the session, so a second player doesn't ask again.
   */
  async function flushPlayerPage(playerId: 8476945 | 8477964, position: string = 'skater'): Promise<void> {
    httpMock.expectOne(landingUrl + playerId + '/landing').flush(mockPlayerLanding(playerId));
    await settle();
    httpMock.expectOne(statsUrl + playerId + '?position=' + position).flush(mockPlayerStats(playerId));
    httpMock.match(historyUrl).forEach(request => request.flush(mockSeasonHistory()));
    await settle();
  }

  /** The regular season card. */
  function seasonCard(): any {
    return child('.regular-season-stats app-player-stats');
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
    // A real link to the team's page
    expect(child('a.player-team').getAttribute('href')).toBe('/team/54');
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
    // His featured season, 2022-23, has no history file
    httpMock.expectNone(request => request.url.startsWith('assets/history/'));
    expect(component.seasonRatingPending).toBeFalse();
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
    httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
    await settle();

    expect(text('.player-name')).toBe('Ivan Barbashev');
    expect(child('app-player-bio')).not.toBeNull();
    expect(text('.stats-error')).toBe('Stats couldn\'t be loaded');
    expect(child('app-player-stats')).toBeNull();
    expect(child('app-recent-player-games')).toBeNull();
    expect(child('app-player-career')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('should go back in the browser history, labeled with the previous page', async () => {
    spyOn(TestBed.inject(RouterExtensionService), 'getPreviousUrl').and.returnValue('/team/28');
    const back = spyOn(TestBed.inject(Location), 'back');
    open(8477964);
    await flushPlayerPage(8477964);
    expect(text('.games-back-button .games-label')).toBe('Team');
    // Both copies, the phone one in the team color stripe too, are buttons
    expect(Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.games-back-button, .games-back-button-mobile'))
        .map(button => button.tagName)).toEqual(['BUTTON', 'BUTTON']);
    child('.games-back-button').click();
    expect(back).toHaveBeenCalled();
  });

  it('should go to the stats page without a previous page', async () => {
    const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    open(8477964);
    await flushPlayerPage(8477964);
    expect(text('.games-back-button .games-label')).toBe('Stats');
    component.backToPrevious();
    expect(navigateByUrl).toHaveBeenCalledWith('/stats');
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

  describe('season rating', () => {
    it('should give the regular season card a skater\'s rated season from its history file', async () => {
      open(8477964);
      await flushPlayerPage(8477964);
      // Ivan Barbashev's one game in the fixture, 2025021290, has 11 shot attempts for and 5 against
      expect(seasonCard().seasonRating.gamesRated).toBe(1);
      expect(seasonCard().seasonRating.corsiForPct).toBeCloseTo(11 / 16, 10);
      expect(seasonCard().ratingPending).toBeFalse();
      // Only the regular season has a file
      expect(child('.playoff-stats app-player-stats').seasonRating).toBeUndefined();
      expect(child('.playoff-stats app-player-stats').ratingPending).toBeFalsy();
    });

    it('should give the season card more width than the bio when it has the rating column', async () => {
      // Hellebuyck has no 2025-26 playoffs card, Barbashev has one
      open(8476945);
      await flushPlayerPage(8476945, 'goalie');
      expect(child('.player-cards').classList).toContain('season-rating-cards');
      expect(child('.player-cards').classList).not.toContain('with-playoff-stats');

      routeParams.next({id: '8477964'});
      fixture.detectChanges();
      await flushPlayerPage(8477964);
      expect(child('.player-cards').classList).toContain('season-rating-cards');
      expect(child('.player-cards').classList).toContain('with-playoff-stats');
    });

    it('should keep the cards even without the rating column', async () => {
      open(8477964);
      httpMock.expectOne(landingUrl + '8477964/landing').flush(mockPlayerLanding(8477964));
      await settle();
      httpMock.expectOne(statsUrl + '8477964?position=skater').flush(mockPlayerStats(8477964));
      httpMock.expectOne(historyUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
      await settle();
      expect(child('.player-cards').classList).not.toContain('season-rating-cards');
    });

    it('should give a goalie his goals saved above average', async () => {
      open(8476945);
      await flushPlayerPage(8476945, 'goalie');
      expect(seasonCard().seasonRating.gamesRated).toBe(1);
      expect(seasonCard().seasonRating.goalsSavedAboveAverage).toBeLessThan(0);
      expect(seasonCard().seasonRating.corsiForPct).toBeUndefined();
    });

    it('should keep the column\'s place while the file loads', async () => {
      open(8477964);
      httpMock.expectOne(landingUrl + '8477964/landing').flush(mockPlayerLanding(8477964));
      await settle();
      httpMock.expectOne(statsUrl + '8477964?position=skater').flush(mockPlayerStats(8477964));
      await settle();
      expect(seasonCard().ratingPending).toBeTrue();
      expect(seasonCard().seasonRating).toBeUndefined();

      httpMock.expectOne(historyUrl).flush(mockSeasonHistory());
      await settle();
      expect(seasonCard().ratingPending).toBeFalse();
      expect(seasonCard().seasonRating.gamesRated).toBe(1);
    });

    it('should leave the column out for a player who is not in the file', async () => {
      open(8477964);
      httpMock.expectOne(landingUrl + '8477964/landing').flush(mockPlayerLanding(8477964));
      await settle();
      httpMock.expectOne(statsUrl + '8477964?position=skater').flush(mockPlayerStats(8477964));
      const history = mockSeasonHistory();
      history.players.id[history.players.id.indexOf(8477964)] = 1;
      httpMock.expectOne(historyUrl).flush(history);
      await settle();
      expect(seasonCard().seasonRating).toBeUndefined();
      expect(seasonCard().ratingPending).toBeFalse();
    });

    it('should leave the column out, and keep the stats, when the file fails', async () => {
      open(8477964);
      httpMock.expectOne(landingUrl + '8477964/landing').flush(mockPlayerLanding(8477964));
      await settle();
      httpMock.expectOne(statsUrl + '8477964?position=skater').flush(mockPlayerStats(8477964));
      httpMock.expectOne(historyUrl).flush('Not found', {status: 404, statusText: 'Not Found'});
      await settle();
      expect(seasonCard().seasonRating).toBeUndefined();
      expect(seasonCard().ratingPending).toBeFalse();
      expect((seasonCard().stats as SkaterSeasonStats).points).toBe(61);
      expect(console.error).toHaveBeenCalled();
    });

    it('should not give the next player the rating of the one before', async () => {
      open(8477964);
      await flushPlayerPage(8477964);
      routeParams.next({id: '8476945'});
      fixture.detectChanges();
      expect(component.seasonRating).toBeUndefined();
      await flushPlayerPage(8476945, 'goalie');
      expect(seasonCard().seasonRating.goalsSavedAboveAverage).toBeDefined();
    });
  });
});
