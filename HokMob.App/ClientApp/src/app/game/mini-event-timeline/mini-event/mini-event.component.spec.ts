import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { PlayerClick, PlayerHighlight } from '@shared/models/player-highlight.model';
import { MockGamecenterGameId, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { MiniEventComponent } from './mini-event.component';

describe('MiniEventComponent', () => {
  let component: MiniEventComponent;
  let fixture: ComponentFixture<MiniEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ MiniEventComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MiniEventComponent);
    component = fixture.componentInstance;
  });

  /** Shows a real play of a captured game with that game's home team and roster. */
  function show(gameId: MockGamecenterGameId, eventId: number): void {
    const playByPlay = mockGamePlayByPlay(gameId);
    fixture.componentRef.setInput('play', playByPlay.plays.find(play => play.eventId === eventId));
    fixture.componentRef.setInput('homeTeamId', playByPlay.homeTeam.id);
    fixture.componentRef.setInput('rosterSpots', PlayByPlayUtils.getRosterSpotMap(playByPlay));
    fixture.detectChanges();
  }

  /** The normalized text of the first element matching the selector, or undefined if there is none. */
  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function texts(selector: string): string[] {
    return Array.from<Element>(fixture.nativeElement.querySelectorAll(selector)).map(element => element.textContent.trim());
  }

  it('should show a real home goal with the assists by last name', () => {
    // WPG (home) vs STL: Connor from Barron and Fleury at 11:53 of the 3rd, 3-1
    show(2025021057, 892);
    expect(fixture.nativeElement.querySelector('.goal-event.home-event')).not.toBeNull();
    expect(text('.period-time-container')).toBe('11:53');
    expect(text('.event-main-label')).toBe('Kyle Connor (3 - 1)');
    expect(texts('.assist-name')).toEqual(['Barron', 'Fleury']);
    expect(text('.event-details')).toContain('Assists: Barron, Fleury');
    expect(fixture.nativeElement.querySelector('.score-update .color-green').textContent).toBe('3');
  });

  it('should show a real away goal on the away side', () => {
    // STL (away): Holloway from Mailloux and Snuggerud at 19:09 of the 3rd, 3-2
    show(2025021057, 989);
    expect(fixture.nativeElement.querySelector('.goal-event.away-event')).not.toBeNull();
    expect(text('.period-time-container')).toBe('19:09');
    expect(text('.event-main-label')).toBe('Dylan Holloway (3 - 2)');
    expect(texts('.assist-name')).toEqual(['Mailloux', 'Snuggerud']);
    expect(fixture.nativeElement.querySelector('.score-update .color-green').textContent).toBe('2');
  });

  it('should show an unassisted goal', () => {
    show(2025030414, 215);
    expect(text('.event-details')).toContain('Unassisted');
    expect(texts('.assist-name')).toEqual([]);
  });

  it('should show a real penalty with the leading zero removed from its time', () => {
    // Holl (STL, away) tripping at 3:12 of the 1st
    show(2025021057, 92);
    expect(fixture.nativeElement.querySelector('.penalty-event.away-event')).not.toBeNull();
    expect(text('.period-time-container')).toBe('3:12');
    expect(text('.penalty')).toBe('Justin Holl');
    expect(text('.penalty-event .event-secondary-label')).toBe('Tripping');
    expect(fixture.nativeElement.querySelector('.goal-event')).toBeNull();
  });

  it('should show a bench minor', () => {
    show(2025030414, 444);
    expect(fixture.nativeElement.querySelector('.penalty-event.home-event')).not.toBeNull();
    expect(text('.penalty')).toBe('Ivan Barbashev (served)');
    expect(text('.penalty-event .event-secondary-label')).toBe('Too many men on the ice (bench minor)');
  });

  it("should emit the scorer with the goal's event ID, and the assist and penalized player without one, when clicked", () => {
    const clicked: PlayerClick[] = [];
    component.playerClicked.subscribe(click => clicked.push(click));
    show(2025021057, 892);
    fixture.nativeElement.querySelector('.event-main-label').click();
    fixture.nativeElement.querySelectorAll('.assist-name')[1].click();
    show(2025021057, 92);
    fixture.nativeElement.querySelector('.penalty').click();
    expect(clicked).toEqual([{playerId: 8478398, eventId: 892}, {playerId: 8477938}, {playerId: 8475718, eventId: undefined}]);
  });

  it('should not emit for a penalty without a player', () => {
    const clicked: PlayerClick[] = [];
    component.playerClicked.subscribe(click => clicked.push(click));
    const playByPlay = mockGamePlayByPlay(2025030414);
    const benchMinor = playByPlay.plays.find(play => play.eventId === 444);
    delete benchMinor.details.servedByPlayerId;
    fixture.componentRef.setInput('play', benchMinor);
    fixture.componentRef.setInput('homeTeamId', playByPlay.homeTeam.id);
    fixture.detectChanges();
    expect(text('.penalty')).toBe('Team penalty');
    fixture.nativeElement.querySelector('.penalty').click();
    expect(clicked).toEqual([]);
  });

  it('should emit the scorer with the goal index, and an assist without one, on hover, and null on leave', () => {
    const hovered: PlayerHighlight[] = [];
    component.playerHovered.subscribe(highlight => hovered.push(highlight));
    // Staal's second goal of the game, from Ehlers
    show(2025030414, 212);
    fixture.componentRef.setInput('goalIndex', 1);
    fixture.detectChanges();
    const mainLabel = fixture.nativeElement.querySelector('.event-main-label');
    mainLabel.dispatchEvent(new MouseEvent('mouseenter'));
    mainLabel.dispatchEvent(new MouseEvent('mouseleave'));
    const assist = fixture.nativeElement.querySelector('.assist-name');
    assist.dispatchEvent(new MouseEvent('mouseenter'));
    assist.dispatchEvent(new MouseEvent('mouseleave'));
    expect(hovered).toEqual([{playerId: 8473533, goalIndex: 1}, null, {playerId: 8477940}, null]);
  });

  it('should emit a penalized player without a goal index on hover', () => {
    const hovered: PlayerHighlight[] = [];
    component.playerHovered.subscribe(highlight => hovered.push(highlight));
    show(2025030414, 444);
    fixture.componentRef.setInput('goalIndex', 0);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.penalty').dispatchEvent(new MouseEvent('mouseenter'));
    expect(hovered).toEqual([{playerId: 8477964, goalIndex: undefined}]);
  });
});
