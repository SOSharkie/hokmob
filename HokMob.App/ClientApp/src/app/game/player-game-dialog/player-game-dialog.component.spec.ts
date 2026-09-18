import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GamePlayer } from '@shared/models/nhl-web-api/boxscore.model';
import { StatsUtils } from '@shared/utils/stats-utils';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { mockGameBoxscore, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerGameDialogComponent } from './player-game-dialog.component';

describe('PlayerGameDialogComponent', () => {
  let component: PlayerGameDialogComponent;
  let fixture: ComponentFixture<PlayerGameDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerGameDialogComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();
  });

  /** A player of 2025021057 (STL @ WPG), as the game page builds it. */
  function gamePlayer(playerId: number): GamePlayer {
    const rosterSpots = PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025021057));
    return [true, false].flatMap(isHome => StatsUtils.getGamePlayers(mockGameBoxscore(2025021057), isHome, rosterSpots))
        .find(player => player.playerId === playerId);
  }

  function open(player: GamePlayer): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {useValue: {player}});
    fixture = TestBed.createComponent(PlayerGameDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it("should pass the player to the shared player game stats", () => {
    const player = gamePlayer(8476460);
    open(player);
    expect(fixture.nativeElement.querySelector('app-player-game-stats').player).toBe(player);
  });

  it('should close and open the player profile', fakeAsync(() => {
    open(gamePlayer(8476460));
    const close = spyOn(TestBed.inject(MatDialogRef), 'close');
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    spyOn(window, 'scrollTo');

    fixture.nativeElement.querySelector('.profile-container').click();
    expect(close).toHaveBeenCalled();
    tick(100);
    expect(navigate).toHaveBeenCalledWith(['/player', 8476460]);

    fixture.nativeElement.querySelector('.done-button').click();
    expect(close).toHaveBeenCalledTimes(2);
  }));

  it('should pass no player to the shared component without one', () => {
    open(undefined);
    expect(fixture.nativeElement.querySelector('app-player-game-stats').player).toBeUndefined();
  });
});
