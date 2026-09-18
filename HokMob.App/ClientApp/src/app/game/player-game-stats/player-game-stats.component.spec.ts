import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GamePlayer } from '@shared/models/nhl-web-api/boxscore.model';
import { StatsUtils } from '@shared/utils/stats-utils';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { mockGameBoxscore, mockGamePlayByPlay, mockPlayerLanding } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerGameStatsComponent } from './player-game-stats.component';

describe('PlayerGameStatsComponent', () => {
  let component: PlayerGameStatsComponent;
  let fixture: ComponentFixture<PlayerGameStatsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerGameStatsComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();
    spyOn(console, 'error');
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlayerGameStatsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** A player of 2025021057 (STL @ WPG), as the game page builds it. */
  function gamePlayer(playerId: number): GamePlayer {
    const rosterSpots = PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025021057));
    return [true, false].flatMap(isHome => StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), isHome, rosterSpots))
        .find(player => player.playerId === playerId);
  }

  function show(player: GamePlayer): void {
    fixture.componentRef.setInput('player', player);
    fixture.detectChanges();
  }

  /** Waits for pending promise callbacks without timers, so it also works with a mocked clock. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  /** The stats list as [label, value]. */
  function stats(): string[][] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.game-stat-item')).map(item => [
      item.querySelector('.game-stat-label').textContent.trim(),
      item.querySelector('span:last-child').textContent.trim()
    ]);
  }

  it('should show a real skater with his game stats and bio', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 15));
    try {
      show(gamePlayer(8476460));
      expect(text('.player-name')).toBe('Mark Scheifele');
      expect(text('.position-info span:last-child')).toBe('C');
      expect(text('.country-container span')).toBe('-');
      expect(text('.age-info span:last-child')).toBe('-');

      httpMock.expectOne('/api/nhl/player/8476460/landing').flush(mockPlayerLanding(8476460));
      await settle();
      expect(text('.country-container span')).toBe('CAN');
      expect(fixture.nativeElement.querySelector('.country-flag').getAttribute('src')).toBe('assets/flags/CAN.png');
      // Born 1993-03-15
      expect(text('.age-info span:last-child')).toBe('33');
      expect(component.weight).toBe('207 lb');
    } finally {
      jasmine.clock().uninstall();
    }

    expect(stats()).toEqual([
      ['HokMob Rating', '7'],
      ['Time On Ice', '22:12'],
      ['Goals', '1'],
      ['Assists', '0'],
      ['Shots', '4'],
      ['Hits', '0'],
      ['Blocks', '0'],
      ['Faceoff %', '70.6%'],
      ['Plus/Minus', '0'],
      ['Penalty Minutes', '0'],
      ['Takeaways', '1'],
      ['Giveaways', '2']
    ]);
  });

  it('should show the team logo and headshot of the game, not the current team', async () => {
    // Comrie played for WPG in this game, but his player landing is now SJS
    show(gamePlayer(8477480));
    httpMock.expectOne('/api/nhl/player/8477480/landing').flush(mockPlayerLanding(8477480));
    await settle();
    expect(fixture.nativeElement.querySelector('.team-logo').getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(52));
    expect(fixture.nativeElement.querySelector('.player-headshot').getAttribute('src'))
        .toBe('https://assets.nhle.com/mugs/nhl/20252026/WPG/8477480.png');
  });

  it('should show a real goalie with his save percentage', async () => {
    show(gamePlayer(8477480));
    httpMock.expectOne('/api/nhl/player/8477480/landing').flush(mockPlayerLanding(8477480));
    await settle();
    expect(component.isGoalie).toBeTrue();
    expect(stats()).toEqual([
      ['HokMob Rating', '7.9'],
      ['Time On Ice', '59:52'],
      ['Save %', '.935'],
      ['Saves', '29'],
      ['Shots Against', '31'],
      ['Penalty Minutes', '0']
    ]);
  });

  it('should show N/A for a goalie who faced no shots', async () => {
    show(gamePlayer(8476945));
    httpMock.expectOne('/api/nhl/player/8476945/landing').flush(mockPlayerLanding(8477480));
    await settle();
    expect(stats()[2]).toEqual(['Save %', 'N/A']);
    expect(stats()[0]).toEqual(['HokMob Rating', '0']);
  });

  it('should hide the faceoffs of a winger who won none, and show the ones of a winger who did', () => {
    show(gamePlayer(8478398));
    httpMock.expectOne('/api/nhl/player/8478398/landing');
    expect(stats().map(stat => stat[0])).not.toContain('Faceoff %');
    // Holloway (L) won 20% of his faceoffs
    show(gamePlayer(8482077));
    httpMock.expectOne('/api/nhl/player/8482077/landing');
    expect(stats()).toContain(['Faceoff %', '20.0%']);
  });

  it('should keep the game stats and show dashes when the player landing fails', async () => {
    show(gamePlayer(8476460));
    httpMock.expectOne('/api/nhl/player/8476460/landing').flush('Bad gateway', {status: 502, statusText: 'Bad Gateway'});
    await settle();
    expect(component.playerLanding).toBeUndefined();
    expect(text('.country-container span')).toBe('-');
    expect(fixture.nativeElement.querySelector('.country-flag')).toBeNull();
    expect(text('.age-info span:last-child')).toBe('-');
    expect(component.weight).toBe('-');
    expect(stats()[2]).toEqual(['Goals', '1']);
  });

  it('should show the blank headshot when the headshot fails to load', () => {
    show(gamePlayer(8476460));
    httpMock.expectOne('/api/nhl/player/8476460/landing');
    const headshot: HTMLImageElement = fixture.nativeElement.querySelector('.player-headshot');
    headshot.dispatchEvent(new Event('error'));
    expect(headshot.src).toMatch(/assets\/blank_headshot\.png$/);
  });

  it('should only mark the wrapper compact when asked to, keeping the same stats either way', () => {
    show(gamePlayer(8476460));
    httpMock.expectOne('/api/nhl/player/8476460/landing');
    expect(fixture.nativeElement.querySelector('.player-game-stats-wrapper').classList).not.toContain('compact');

    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.player-game-stats-wrapper').classList).toContain('compact');
    expect(stats()[1]).toEqual(['Time On Ice', '22:12']);
  });

  it('should not load anything without a player', () => {
    show(undefined);
    httpMock.expectNone(() => true);
    expect(text('.player-name')).toBe('');
    expect(stats()).toEqual([]);
  });
});
