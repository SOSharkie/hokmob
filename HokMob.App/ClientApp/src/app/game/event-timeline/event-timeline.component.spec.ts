import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayerClick, PlayerHighlight } from '@shared/models/player-highlight.model';
import { PlayByPlay } from '@shared/models/nhl-web-api/play-by-play.model';
import { derivedLivePlayByPlay, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { EventTimelineComponent } from './event-timeline.component';

describe('EventTimelineComponent', () => {
  let component: EventTimelineComponent;
  let fixture: ComponentFixture<EventTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ EventTimelineComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventTimelineComponent);
    component = fixture.componentInstance;
  });

  function show(playByPlay: PlayByPlay): void {
    fixture.componentRef.setInput('playByPlay', playByPlay);
    fixture.detectChanges();
  }

  /** Each period as [label, event IDs of its app-event elements]. */
  function periods(): [string, number[]][] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll('.period-events')).map(period => [
      period.querySelector('.period-label').textContent.trim(),
      Array.from(period.querySelectorAll('app-event')).map((event: any) => event.play.eventId)
    ]);
  }

  function hasEndLabel(): boolean {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll(':scope > div > .period-start-container .period-label'))
        .some(label => label.textContent.trim() === 'End');
  }

  it('should list the goals and penalties of a real regulation game by period', () => {
    show(mockGamePlayByPlay(2025021057));
    expect(periods()).toEqual([
      ['1st', [80, 92, 141, 314]],
      ['2nd', [654, 711]],
      ['3rd', [804, 892, 989]]
    ]);
    expect(hasEndLabel()).toBeTrue();
  });

  it('should pass the home team and roster spots to each event', () => {
    show(mockGamePlayByPlay(2025021057));
    const event = fixture.nativeElement.querySelector('app-event');
    expect(event.homeTeamId).toBe(52);
    expect(event.rosterSpots.size).toBe(40);
    expect(event.rosterSpots.get(8477938).lastName.default).toBe('Fleury');
  });

  it('should show the overtime but not the shootout of a real shootout game', () => {
    show(mockGamePlayByPlay(2025020952));
    expect(periods().map(([label]) => label)).toEqual(['1st', '2nd', '3rd', 'OT']);
    expect(periods()[3]).toEqual(['OT', [1291]]);
    expect(periods().flatMap(([, eventIds]) => eventIds)).not.toContain(121);
  });

  it('should show the periods played so far without an end in a live game', () => {
    show(derivedLivePlayByPlay());
    expect(periods()).toEqual([
      ['1st', [80, 92, 141, 314]],
      ['2nd', [654]]
    ]);
    expect(hasEndLabel()).toBeFalse();
  });

  it('should show nothing for a game without plays', () => {
    show(mockGamePlayByPlay(2026020056));
    expect(periods()).toEqual([]);
    expect(hasEndLabel()).toBeFalse();
    show(undefined);
    expect(periods()).toEqual([]);
  });

  it('should update when the play-by-play refreshes', () => {
    show(derivedLivePlayByPlay());
    show(mockGamePlayByPlay(2025021057));
    expect(periods().length).toBe(3);
    expect(hasEndLabel()).toBeTrue();
  });

  it('should emit the player clicked in an event', () => {
    const clicked: PlayerClick[] = [];
    component.playerClicked.subscribe(click => clicked.push(click));
    show(mockGamePlayByPlay(2025021057));
    fixture.debugElement.queryAll(By.css('app-event'))[2].triggerEventHandler('playerClicked', {playerId: 8476460, eventId: 141});
    expect(clicked).toEqual([{playerId: 8476460, eventId: 141}]);
  });

  it("should pass each goal's index among its scorer's goals to its event", () => {
    show(mockGamePlayByPlay(2025030414));
    const goalIndex = (eventId: number) => Array.from<any>(fixture.nativeElement.querySelectorAll('app-event'))
        .find(event => event.play.eventId === eventId).goalIndex;
    // Jordan Staal scored in the 1st (448) and the 3rd (212)
    expect(goalIndex(448)).toBe(0);
    expect(goalIndex(212)).toBe(1);
    expect(goalIndex(444)).toBeUndefined();
  });

  it('should emit the player hovered in an event', () => {
    const hovered: PlayerHighlight[] = [];
    component.playerHovered.subscribe(highlight => hovered.push(highlight));
    show(mockGamePlayByPlay(2025030414));
    const event = fixture.debugElement.query(By.css('app-event'));
    event.triggerEventHandler('playerHovered', {playerId: 8473533, goalIndex: 1});
    event.triggerEventHandler('playerHovered', null);
    expect(hovered).toEqual([{playerId: 8473533, goalIndex: 1}, null]);
  });
});
