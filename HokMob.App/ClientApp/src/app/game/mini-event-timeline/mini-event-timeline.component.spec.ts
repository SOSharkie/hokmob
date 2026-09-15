import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayByPlay } from '@shared/models/nhl-web-api/play-by-play.model';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { derivedLivePlayByPlay, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { MiniEventTimelineComponent } from './mini-event-timeline.component';

describe('MiniEventTimelineComponent', () => {
  let component: MiniEventTimelineComponent;
  let fixture: ComponentFixture<MiniEventTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ MiniEventTimelineComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MiniEventTimelineComponent);
    component = fixture.componentInstance;
  });

  function show(playByPlay: PlayByPlay): void {
    fixture.componentRef.setInput('playByPlay', playByPlay);
    fixture.detectChanges();
  }

  /** Each period as [label, event IDs of its app-mini-event elements]. */
  function periods(): [string, number[]][] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.period-events')).map(period => [
      period.querySelector('.period-label').textContent.trim(),
      Array.from(period.querySelectorAll('app-mini-event')).map((event: any) => event.play.eventId)
    ]);
  }

  function hasEndLabel(): boolean {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.mini-event-timeline-container > .period-start-container'))
        .some(label => label.textContent.trim() === 'End');
  }

  it('should list the goals and penalties of a real playoff game by period', () => {
    show(mockGamePlayByPlay(2025030414));
    expect(periods()).toEqual([
      ['1st', [69, 78, 99, 150, 444, 448, 526]],
      ['2nd', [783, 896, 931, 957, 981, 984]],
      ['3rd', [1037, 212, 215]]
    ]);
    expect(hasEndLabel()).toBeTrue();
    const event = fixture.nativeElement.querySelector('app-mini-event');
    expect(event.homeTeamId).toBe(54);
    expect(event.rosterSpots.get(8482702).lastName.default).toBe('Stankoven');
  });

  it('should show the team logos in the header', () => {
    fixture.componentRef.setInput('homeTeamLogo', NhlTeamLogoUtils.getTeamPrimaryLogo(54));
    fixture.componentRef.setInput('awayTeamLogo', NhlTeamLogoUtils.getTeamPrimaryLogo(12));
    show(mockGamePlayByPlay(2025030414));
    const logos = fixture.nativeElement.querySelectorAll('.team-logo');
    expect(logos.length).toBe(2);
    expect(logos[0].getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(54));
    expect(logos[1].getAttribute('src')).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(12));
  });

  it('should show the overtime but not the shootout of a real shootout game', () => {
    show(mockGamePlayByPlay(2025020952));
    expect(periods().map(([label]) => label)).toEqual(['1st', '2nd', '3rd', 'OT']);
    expect(periods().flatMap(([, eventIds]) => eventIds)).not.toContain(408);
  });

  it('should show the periods played so far without an end in a live game', () => {
    show(derivedLivePlayByPlay());
    expect(periods()).toEqual([
      ['1st', [80, 92, 141, 314]],
      ['2nd', [654]]
    ]);
    expect(hasEndLabel()).toBeFalse();
  });

  it('should show only the header for a game without plays', () => {
    show(mockGamePlayByPlay(2026020056));
    expect(periods()).toEqual([]);
    expect(hasEndLabel()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Event Timeline');
    show(undefined);
    expect(periods()).toEqual([]);
  });

  it('should emit the player clicked in an event', () => {
    const clickedIds: number[] = [];
    component.playerClicked.subscribe(playerId => clickedIds.push(playerId));
    show(mockGamePlayByPlay(2025030414));
    fixture.debugElement.query(By.css('app-mini-event')).triggerEventHandler('playerClicked', 8482702);
    expect(clickedIds).toEqual([8482702]);
  });
});
