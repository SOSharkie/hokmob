import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { ScoreGame } from '@shared/models/nhl-web-api/score.model';
import { NhlGameInfoUtils } from '@shared/utils/nhl-game-info-utils';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import {
  derivedLiveGame,
  mockClubScheduleSeason,
  mockPlayoffGame,
  mockShootoutFinal
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { TeamNextGameComponent } from './team-next-game.component';

describe('TeamNextGameComponent', () => {
  let component: TeamNextGameComponent;
  let fixture: ComponentFixture<TeamNextGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ TeamNextGameComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamNextGameComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** Boston's first game of 2026-27: WSH at BOS on 2026-09-20, as the team page converts it. */
  function nextGame(): ScoreGame {
    return NhlGameInfoUtils.toScoreGame(mockClubScheduleSeason('BOS', 20262027).games[0]);
  }

  function show(game: ScoreGame): void {
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  it('should show the day and start time of a real future game', () => {
    show(nextGame());
    expect(text('.team-next-game-header')).toBe('Next Game');
    expect(text('.home-team-header')).toBe('Bruins');
    expect(text('.away-team-header')).toBe('Capitals');
    expect(component.gameTime).toBe('2:00 PM');
    expect(text('.game-day-label')).toContain('September 20');
    expect(fixture.nativeElement.querySelector('.game-score')).toBeNull();
    expect(fixture.nativeElement.querySelector('.playoff-series-label')).toBeNull();
  });

  it('should link to the game page', () => {
    show(nextGame());
    const routerLink = fixture.debugElement.query(By.css('.score-container')).injector.get(RouterLink);
    expect(routerLink.urlTree.toString()).toBe('/game/2026010013');
  });

  it('should show both teams\' logos', () => {
    show(nextGame());
    expect(component.homeTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(6));
    expect(component.awayTeamLogo).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(15));
    expect(fixture.nativeElement.querySelector('.home-team-logo').getAttribute('src'))
        .toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(6));
  });

  it('should show the score and period of a live game', () => {
    show(derivedLiveGame());
    expect(text('.team-next-game-header')).toBe('Ongoing Game');
    expect(text('.game-score-label')).toBe('5 - 0');
    expect(text('.live-status-label')).toBe('2nd - 5:32');
    expect(fixture.nativeElement.querySelector('.future-game')).toBeNull();
  });

  it('should show the final score of a game that has ended', () => {
    show(mockShootoutFinal());
    expect(text('.team-next-game-header')).toBe('Latest Game');
    expect(text('.game-score-label')).toBe('3 - 2');
    expect(text('.completed-status-label')).toBe('SO');
  });

  it('should show the series status of a playoff game', () => {
    const playoffGame = mockPlayoffGame();
    show(playoffGame);
    expect(component.isPlayoffGame).toBeTrue();
    expect(text('.playoff-series-label')).toBe('Tied 2-2');
  });

  it('should show a playoff series that has not started as 0-0', () => {
    const playoffGame = mockPlayoffGame();
    playoffGame.seriesStatus.topSeedWins = 0;
    playoffGame.seriesStatus.bottomSeedWins = 0;
    show(playoffGame);
    expect(component.playoffSeriesDetails).toBe('Series (0-0)');
  });

  it('should show nothing without a game', () => {
    show(null);
    expect(fixture.nativeElement.querySelector('.team-next-game')).toBeNull();
  });

  it('should show N/A for a game without a score', () => {
    const game = nextGame();
    game.gameState = mockShootoutFinal().gameState;
    show(game);
    expect(text('.game-score-label')).toBe('N/A');
  });
});
