import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import {
  GoalieGameStats,
  SkaterGameStats
} from '@shared/models/nhl-stats-api/player-stats.model';
import { mockPlayerStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { RecentPlayerGamesComponent } from './recent-player-games.component';

describe('RecentPlayerGamesComponent', () => {
  let component: RecentPlayerGamesComponent;
  let fixture: ComponentFixture<RecentPlayerGamesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ RecentPlayerGamesComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecentPlayerGamesComponent);
    component = fixture.componentInstance;
    // The game dates below are months in the past, so they're never shown as "Today" or "Yesterday"
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 15));
  });

  afterEach(() => {
    fixture.destroy();
    jasmine.clock().uninstall();
  });

  function show(games: SkaterGameStats[] | GoalieGameStats[], isGoalie: boolean): void {
    fixture.componentRef.setInput('games', games);
    fixture.componentRef.setInput('isGoalie', isGoalie);
    fixture.componentRef.setInput('teamColor', '#B4975A');
    fixture.detectChanges();
  }

  function gameRows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.player-game-row'));
  }

  /** A game row as [date, opponent and score, time on ice, ...stats, rating]. */
  function row(index: number): string[] {
    const cells: HTMLElement[] = Array.from(gameRows()[index].querySelectorAll('td'));
    return cells.map(cell => cell.textContent.replace(/\s+/g, ' ').trim());
  }

  function opponentLogo(index: number): string {
    return gameRows()[index].querySelector('.opponent-logo').getAttribute('src');
  }

  it('should show the real last games of a skater, newest first, with ratings', () => {
    const games = mockPlayerStats(8477964).recentGames as SkaterGameStats[];
    show(games, false);
    expect(gameRows().length).toBe(10);
    // Stanley Cup Final game 6: VGK 0, CAR 3 at home, 11:48 played, 2 shots, 3 hits, -2
    expect(row(0)).toEqual(['Jun 14', 'CAR(0 - 3)', '11:48', '0', '0', '2', '3', '-2', '0', '5.2']);
    expect(opponentLogo(0)).toBe('assets/logos/carolina.png');
    // His best game of the run: 2 goals and an assist in a 3-1 win at COL
    expect(row(8)).toEqual(['May 22', 'COL(3 - 1)', '16:15', '2', '1', '3', '7', '3', '0', '9.4']);
    expect(opponentLogo(8)).toBe('assets/logos/colorado.png');
    // A game with a penalty
    expect(row(9)).toEqual(['May 20', 'COL(4 - 2)', '16:25', '0', '0', '2', '2', '-1', '2', '4.6']);
  });

  it('should scale the faceoff term of a center by the faceoffs taken in the game', () => {
    const games = mockPlayerStats(8477496).recentGames as SkaterGameStats[];
    // Lindholm, a center, won 4 of 12 faceoffs in game 3 against Buffalo. The same 33.3% on 3 faceoffs costs less, and
    // without a count he gets the full term, like with 12.
    const game = games[3];
    expect(game.totalFaceoffs).toBe(12);
    expect(game.faceoffWinPct).toBe(0.33333);
    show([game, {...game, totalFaceoffs: 3}, {...game, totalFaceoffs: undefined}], false);
    const ratings = component.rows.map(gameRow => gameRow.hokmobRating);
    expect(ratings[0]).toBe(ratings[2]);
    expect(ratings[1]).toBeGreaterThan(ratings[0]);
  });

  it('should link every row to its game', () => {
    const games = mockPlayerStats(8477964).recentGames as SkaterGameStats[];
    show(games, false);
    expect(component.rows[0].gameId).toBe(2025030416);
    const routerLink = fixture.debugElement.query(By.directive(RouterLink)).injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/game/2025030416');
  });

  it('should show the score with the away team of the player first', () => {
    const games = mockPlayerStats(8477964).recentGames as SkaterGameStats[];
    // Game 5 in Carolina, which VGK lost 2-4 on the road, so the score reads from Vegas' side
    expect(games[1].homeRoad).toBe('R');
    expect(games[1].homeScore).toBe(4);
    show(games, false);
    expect(component.rows[1].score).toBe('(2 - 4)');
  });

  it('should leave the score blank when the game report had none', () => {
    const games = mockPlayerStats(8477964).recentGames as SkaterGameStats[];
    games.forEach(game => {
      delete game.homeScore;
      delete game.visitingScore;
    });
    show(games, false);
    expect(component.rows[0].score).toBe('');
    expect(row(0)[1]).toBe('CAR');
  });

  it('should show the real last games of a goalie, with the GAA of each game', () => {
    const games = mockPlayerStats(8476945).recentGames as GoalieGameStats[];
    show(games, true);
    expect(gameRows().length).toBe(10);
    // A 6 goal loss in Vegas: 32 of 38 saved in a full game, so the GAA is 6.00
    expect(row(0)).toEqual(['Apr 13', 'VGK(2 - 6)', '60:00', '.842', '6.00', '38', '6', '4.6']);
    expect(opponentLogo(0)).toBe('assets/logos/vegas.png');
    // A game that went to overtime, so the GAA is below the goals against
    expect(games[6].timeOnIce).toBe(3633);
    expect(row(6)).toEqual(['Mar 31', 'CHI(4 - 3)', '60:33', '.857', '2.97', '21', '3', '5.1']);
  });

  it('should show no rows for a player without recent games', () => {
    show([], false);
    expect(gameRows().length).toBe(0);
  });
});
