import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatIcon } from '@angular/material/icon';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayByPlayUtils } from '@shared/utils/play-by-play-utils';
import { MockGamecenterGameId, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { EventComponent } from './event.component';

describe('EventComponent', () => {
  let component: EventComponent;
  let fixture: ComponentFixture<EventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ EventComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventComponent);
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

  it('should show a real home goal with its score and assists', () => {
    // WPG (home) vs STL: Fleury from Lambert and Barron at 2:31 of the 1st
    show(2025021057, 80);
    expect(text('.home-event .event-main-label')).toBe('Haydn Fleury (1 - 0)');
    expect(texts('.home-event .assist-name')).toEqual(['Brad Lambert', 'Morgan Barron']);
    expect(text('.home-event .goal-event')).toContain('Assists: Brad Lambert, Morgan Barron');
    expect(text('.event-time')).toBe('2:31');
    expect(fixture.nativeElement.querySelector('.home-event .puck-icon')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.away-event .event-text')).toBeNull();
  });

  it('should show a real away goal with one assist', () => {
    // VGK (home) vs CAR: Staal from Ehlers at 6:32 of the 3rd, CAR leads 4-3
    show(2025030414, 212);
    expect(text('.away-event .event-main-label')).toBe('Jordan Staal (3 - 4)');
    expect(texts('.away-event .assist-name')).toEqual(['Nikolaj Ehlers']);
    expect(text('.event-time')).toBe('6:32');
    expect(fixture.nativeElement.querySelector('.home-event .event-text')).toBeNull();
  });

  it('should show an unassisted goal', () => {
    // Ehlers' empty net goal
    show(2025030414, 215);
    expect(text('.away-event .goal-event')).toContain('Unassisted');
    expect(texts('.assist-name')).toEqual([]);
  });

  it('should show a real penalty with the penalized player and the penalty type', () => {
    // Theodore (VGK, home) tripping at 1:24 of the 1st
    show(2025030414, 78);
    expect(text('.home-event .penalty')).toBe('Shea Theodore');
    expect(text('.home-event .penalty-event .event-secondary-label')).toBe('Tripping');
    expect(text('.event-time')).toBe('1:24');
    expect(fixture.debugElement.query(By.css('.home-event .event-icon')).injector.get(MatIcon).fontIcon).toBe('front_hand');
  });

  it('should humanize the penalty type of an away penalty', () => {
    // Blake (CAR, away) goalkeeper interference at 18:30 of the 2nd
    show(2025030414, 984);
    expect(text('.away-event .penalty')).toBe('Jackson Blake');
    expect(text('.away-event .penalty-event .event-secondary-label')).toBe('Goalkeeper interference');
  });

  it('should show who served a bench minor', () => {
    // VGK too many men on the ice, served by Barbashev, with no committedByPlayerId
    show(2025030414, 444);
    expect(text('.home-event .penalty')).toBe('Ivan Barbashev (served)');
    expect(text('.home-event .penalty-event .event-secondary-label')).toBe('Too many men on the ice (bench minor)');
  });

  it('should emit the scorer and assist IDs when clicked', () => {
    const clickedIds: number[] = [];
    component.playerClicked.subscribe(playerId => clickedIds.push(playerId));
    show(2025021057, 80);
    fixture.nativeElement.querySelector('.home-event .event-main-label').click();
    fixture.nativeElement.querySelectorAll('.home-event .assist-name').forEach((assist: HTMLElement) => assist.click());
    expect(clickedIds).toEqual([8477938, 8483471, 8480289]);
  });

  it('should emit the player who served a bench minor when clicked', () => {
    const clickedIds: number[] = [];
    component.playerClicked.subscribe(playerId => clickedIds.push(playerId));
    show(2025030414, 444);
    fixture.nativeElement.querySelector('.penalty').click();
    expect(clickedIds).toEqual([8477964]);
  });

  it('should show the score without roster spots', () => {
    show(2025021057, 80);
    fixture.componentRef.setInput('rosterSpots', undefined);
    fixture.detectChanges();
    expect(text('.home-event .event-main-label')).toBe('(1 - 0)');
    expect(texts('.home-event .assist-name')).toEqual(['', '']);
  });
});
