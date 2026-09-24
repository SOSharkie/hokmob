import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ClubScheduleGame } from '@shared/models/nhl-web-api/club-schedule.model';
import { mockClubScheduleSeason } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PreviousGameComponent } from './previous-game.component';

describe('PreviousGameComponent', () => {
  let fixture: ComponentFixture<PreviousGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PreviousGameComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviousGameComponent);
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** A finished game from the real BOS 2025-26 schedule. */
  function bostonGame(gameId: number): ClubScheduleGame {
    return mockClubScheduleSeason('BOS', 20252026).games.find(game => game.id === gameId);
  }

  function show(game: ClubScheduleGame, teamId: number, isLast = false): void {
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('teamId', teamId);
    fixture.componentRef.setInput('isLast', isLast);
    fixture.detectChanges();
  }

  function element(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  function text(selector: string): string {
    return element(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  /** The team each app-team-logo was given. It isn't declared here, so its inputs are read off the element. */
  function logoTeamIds(): number[] {
    return Array.from<HTMLElement & {teamId: number}>(fixture.nativeElement.querySelectorAll('app-team-logo'))
        .map(logo => logo.teamId);
  }

  function scoreClasses(): string[] {
    return Array.from(element('.score-container').classList).filter(name => name === 'green' || name === 'red');
  }

  it('should show a real home win with both teams, the score and a link to the game', () => {
    // NJD 0 @ BOS 4
    show(bostonGame(2025021292), 6);
    expect(text('.home.team-name')).toBe('Bruins');
    expect(text('.away.team-name')).toBe('Devils');
    expect(text('.home.team-abbrev')).toBe('BOS');
    expect(text('.away.team-abbrev')).toBe('NJD');
    expect(text('.score-container')).toBe('4 - 0');
    expect(scoreClasses()).toEqual(['green']);
    expect(logoTeamIds()).toEqual([6, 1]);
    const routerLink = fixture.debugElement.query(By.directive(RouterLink)).injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/game/2025021292');
    expect(element('.previous-game-container').classList).not.toContain('last-previous-game');
  });

  it('should color the result for the team whose form it is', () => {
    // BOS 3 @ BUF 4
    show(bostonGame(2025030111), 6);
    expect(text('.home.team-name')).toBe('Sabres');
    expect(text('.away.team-name')).toBe('Bruins');
    expect(text('.score-container')).toBe('4 - 3');
    expect(scoreClasses()).toEqual(['red']);

    show(bostonGame(2025030111), 7);
    expect(scoreClasses()).toEqual(['green']);
  });

  it('should show an overtime win as a win', () => {
    // BOS 2 @ BUF 1 in overtime
    show(bostonGame(2025030115), 6);
    expect(text('.score-container')).toBe('1 - 2');
    expect(scoreClasses()).toEqual(['green']);
  });

  it('should mark the last game of the form', () => {
    show(bostonGame(2025030116), 6, true);
    expect(element('.previous-game-container').classList).toContain('last-previous-game');
  });

  it('should not color a game without a score, or a game of another team', () => {
    const futureGame = mockClubScheduleSeason('BOS', 20262027).games.find(game => game.id === 2026020056);
    show(futureGame, 6);
    expect(text('.score-container')).toBe('N/A');
    expect(scoreClasses()).toEqual([]);

    show(bostonGame(2025021292), 10);
    expect(text('.score-container')).toBe('4 - 0');
    expect(scoreClasses()).toEqual([]);
  });

  it('should mark a real preseason and playoff game, but not a regular season one', () => {
    // WSH 5 @ BOS 2, a preseason game
    show(bostonGame(2025010013), 6);
    expect(text('.score-container')).toBe('2 - 5');
    expect(text('.game-type-label')).toBe('PRE');

    // BOS 3 @ BUF 4, a playoff game
    show(bostonGame(2025030111), 6);
    expect(text('.game-type-label')).toBe('PLAYOFFS');

    show(bostonGame(2025021292), 6);
    expect(element('.game-type-label')).toBeNull();
  });

  it('should fall back to the team utils for a missing name and an unknown team', () => {
    const game = bostonGame(2025021292);
    delete game.homeTeam.commonName;
    delete game.homeTeam.abbrev;
    game.awayTeam.id = 999;
    show(game, 6);
    expect(text('.home.team-name')).toBe('Bruins');
    expect(text('.home.team-abbrev')).toBe('BOS');
    expect(text('.away.team-name')).toBe('Devils');
    expect(text('.away.team-abbrev')).toBe('NJD');
    // The unknown ID is passed straight through; app-team-logo falls back to the placeholder, see its own spec
    expect(logoTeamIds()[1]).toBe(999);
  });

  it('should render nothing without a game', () => {
    fixture.detectChanges();
    expect(element('.previous-game-container')).toBeNull();
  });
});
