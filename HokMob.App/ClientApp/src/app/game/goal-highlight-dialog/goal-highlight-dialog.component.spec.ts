import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { NhlVideoUtils } from '@shared/utils/nhl-video-utils';
import { GamePlayer } from '@shared/models/nhl-web-api/boxscore.model';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { StatsUtils } from '@shared/utils/stats-utils';
import { mockGameBoxscore, mockGameLanding, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { GoalHighlightDialogComponent, GoalHighlightDialogData } from './goal-highlight-dialog.component';

describe('GoalHighlightDialogComponent', () => {
  let component: GoalHighlightDialogComponent;
  let fixture: ComponentFixture<GoalHighlightDialogComponent>;
  let close: jasmine.Spy;

  beforeEach(async () => {
    close = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ GoalHighlightDialogComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();
    TestBed.overrideProvider(MatDialogRef, {useValue: {close}});
  });

  function show(data: GoalHighlightDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {useValue: data});
    fixture = TestBed.createComponent(GoalHighlightDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function element(selector: string): any {
    return fixture.nativeElement.querySelector(selector);
  }

  /** Ehlers, from game 2025030414 (CAR @ VGK), whose empty net goal (eventId 215) has a real highlight clip. */
  function ehlers(): GamePlayer {
    const rosterSpots = PlayByPlayUtils.getRosterSpotMap(mockGamePlayByPlay(2025030414));
    return [true, false].flatMap(isHome => StatsUtils.getGamePlayers(mockGameBoxscore(2025030414), isHome, rosterSpots))
        .find(player => player.playerId === 8477940);
  }

  function ehlersGoalVideo() {
    const goal = mockGameLanding(2025030414).summary.scoring.flatMap(period => period.goals).find(item => item.eventId === 215);
    return NhlVideoUtils.getGoalHighlightVideo(goal);
  }

  it("should play the goal's highlight video and show the scorer's stats", () => {
    const player = ehlers();
    show({player, video: ehlersGoalVideo()});
    expect(element('app-player-game-stats').player).toBe(player);
    expect(element('.video-frame').getAttribute('src')).toBe(
        'https://players.brightcove.net/6415718365001/D3UCGynRWU_default/index.html?videoId=6398033953112&autoplay=true');
    expect(element('.nhl-link').getAttribute('href'))
        .toBe('https://nhl.com/video/car-vgk-ehlers-scores-empty-net-goal-6398033953112');
  });

  it("should lay the scorer's stats out compactly, so the video fits below them", () => {
    show({player: ehlers(), video: ehlersGoalVideo()});
    expect(element('app-player-game-stats').compact).toBeTrue();
  });

  it('should show no video player without a video', () => {
    show({player: ehlers(), video: undefined});
    expect(element('.video-frame')).toBeNull();
    expect(element('.nhl-link')).toBeNull();
  });

  it('should close when the close button is clicked', () => {
    show({player: ehlers(), video: ehlersGoalVideo()});
    element('.dialog-close-button').click();
    expect(close).toHaveBeenCalled();
  });
});
