import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayByPlay } from '@shared/models/nhl-web-api/play-by-play.model';
import { GameLandingScoringPeriod } from '@shared/models/nhl-web-api/gamecenter-landing.model';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { ShotMapUtils } from '@shared/utils/shot-map-utils';
import { mockGameLanding, mockGamePlayByPlay } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { ShotMapComponent } from './shot-map.component';

describe('ShotMapComponent', () => {
  let component: ShotMapComponent;
  let fixture: ComponentFixture<ShotMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ ShotMapComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShotMapComponent);
    component = fixture.componentInstance;
  });

  /** Shows CAR 5 @ VGK 3, the 2026 Stanley Cup Final's 4th game, with its scoring summary. */
  function show(playByPlay: PlayByPlay = mockGamePlayByPlay(2025030414),
                scoring: GameLandingScoringPeriod[] = mockGameLanding(2025030414).summary.scoring): void {
    fixture.componentRef.setInput('playByPlay', playByPlay);
    fixture.componentRef.setInput('scoring', scoring);
    fixture.componentRef.setInput('homeTeamLogo', NhlTeamLogoUtils.getTeamPrimaryLogo(54));
    fixture.componentRef.setInput('awayTeamLogo', NhlTeamLogoUtils.getTeamPrimaryLogo(12));
    fixture.detectChanges();
  }

  const element = (selector: string): HTMLElement => fixture.nativeElement.querySelector(selector);
  const elements = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const text = (selector: string) => element(selector)?.textContent.trim();

  function click(selector: string): void {
    element(selector).click();
    fixture.detectChanges();
  }

  it("should show every shot on goal and goal, and each team's counts", () => {
    show();
    expect(elements('.shot-marker').length).toBe(49);
    expect(elements('.shot-marker.goal').length).toBe(8);
    expect(text('.home-shot-count')).toBe('21 shots · 3 goals');
    expect(text('.away-shot-count')).toBe('28 shots · 5 goals');
  });

  it("should color each team's shots, the away team in a color apart from the home team's", () => {
    show();
    const markers = component.markers;
    expect(markers.find(marker => marker.shot.isHomeTeam).color).toBe(NhlTeamColorUtils.getTeamPrimaryColor(54));
    expect(markers.find(marker => !marker.shot.isHomeTeam).color).toBe(NhlTeamColorUtils.getTeamSecondaryColor(54, 12));
  });

  it("should put home's shots at the left end and away's at the right end", () => {
    show();
    const homeAlongs = component.markers.filter(marker => marker.shot.isHomeTeam && marker.shot.x > 25)
        .map(marker => marker.along);
    const awayAlongs = component.markers.filter(marker => !marker.shot.isHomeTeam && marker.shot.x > 25)
        .map(marker => marker.along);
    expect(homeAlongs.length).toBeGreaterThan(0);
    expect(awayAlongs.length).toBeGreaterThan(0);
    expect(homeAlongs.every(along => along < 50)).toBeTrue();
    expect(awayAlongs.every(along => along > 50)).toBeTrue();
  });

  it("should line a shot up with the drawn rink's goal lines, middle and faceoff dots", () => {
    const position = (isHomeTeam: boolean, x: number, y: number) =>
        ShotMapComponent.getRinkPosition({isHomeTeam, x, y} as any);
    // RinkComponent's goal lines are 13.1ft and 187.03ft along its 200.13ft
    expect(position(false, 89, 0)).toEqual({along: 93.45, across: 50});
    expect(position(true, 89, 0)).toEqual({along: 6.55, across: 50});
    expect(position(false, 0, 0)).toEqual({along: 50, across: 50});
    // Its faceoff dots are 22ft out from the middle of its 98.42ft width
    expect(position(false, 69, 22).across).toBeCloseTo(50 - 22.35, 1);
    expect(position(true, 69, 22).across).toBeCloseTo(50 + 22.35, 1);
  });

  it('should keep a shot from behind the boards on the rink', () => {
    expect(ShotMapComponent.getRinkPosition({isHomeTeam: false, x: -110, y: 50} as any))
        .toEqual({along: 1, across: 2});
  });

  it('should select the last shot and show its shooter, time, shot type, result and goalie', () => {
    show();
    expect(text('.shooter-name')).toBe('Shea Theodore');
    expect(text('.shot-time')).toBe('3rd 19:07');
    expect(text('.shot-type')).toBe('Wrist');
    expect(text('.shot-result')).toBe('Saved');
    expect(text('.shot-goalie')).toBe('Brandon Bussi');
    expect(element('.shooter-team-logo')['src']).toBe(NhlTeamLogoUtils.getTeamPrimaryLogo(54));
    expect(elements('.shot-marker.selected').length).toBe(1);
    expect(element('.shot-line')).not.toBeNull();
    expect(element('.watch-goal-button')).toBeNull();
  });

  it('should select a shot clicked on the rink, and show its details', () => {
    show();
    elements('.shot-marker')[0].click();
    fixture.detectChanges();
    expect(component.selectedShot.eventId).toBe(component.markers[0].shot.eventId);
    expect(elements('.shot-marker')[0].classList).toContain('selected');
    expect(elements('.shot-marker')[0].getAttribute('aria-pressed')).toBe('true');
    expect(elements('.shot-marker.selected').length).toBe(1);
    expect(text('.shot-time')).toBe(ShotMapUtils.getTimeLabel(component.markers[0].shot));
  });

  describe('shot details row', () => {
    const facts = () => elements('.shot-facts dt').map(label => label.textContent.trim());
    const nextFrames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    function showAtWidth(width: number): void {
      fixture.nativeElement.style.width = width + 'px';
      show();
    }

    it('should show the time, shot type, result and goalie beside the shooter on a wide card', () => {
      showAtWidth(900);
      expect(facts()).toEqual(['Time', 'Shot type', 'Result', 'Goalie']);
      expect(component.showGoalie).toBeTrue();
      const shooter = element('.shooter').getBoundingClientRect();
      expect(element('.shot-facts').getBoundingClientRect().top).toBeLessThan(shooter.bottom);
    });

    it('should leave out the goalie on a narrow card instead of wrapping', () => {
      showAtWidth(420);
      expect(facts()).toEqual(['Time', 'Shot type', 'Result']);
      const details = element('.shot-details');
      expect(details.scrollWidth).toBeLessThanOrEqual(details.clientWidth);
      const shooter = element('.shooter').getBoundingClientRect();
      expect(element('.shot-facts').getBoundingClientRect().top).toBeLessThan(shooter.bottom);
    });

    it('should bring the goalie back or leave it out when the card changes width', async () => {
      showAtWidth(900);
      await nextFrames();
      fixture.nativeElement.style.width = '420px';
      await nextFrames();
      expect(facts()).toEqual(['Time', 'Shot type', 'Result']);

      fixture.nativeElement.style.width = '900px';
      await nextFrames();
      expect(facts()).toEqual(['Time', 'Shot type', 'Result', 'Goalie']);
    });

    it('should refit when another shot is selected', () => {
      showAtWidth(900);
      const fit = spyOn(component, 'fitShotDetails').and.callThrough();
      elements('.shot-marker')[0].click();
      expect(fit).toHaveBeenCalled();
      click('.goals-toggle');
      expect(fit).toHaveBeenCalledTimes(2);
    });
  });

  it('should show only the goals with the goals toggle, selecting the last one', () => {
    show();
    click('.goals-toggle');
    expect(element('.goals-toggle').getAttribute('aria-pressed')).toBe('true');
    expect(elements('.shot-marker').length).toBe(8);
    expect(elements('.shot-marker:not(.goal)').length).toBe(0);
    // Ehlers' empty net goal
    expect(text('.shooter-name')).toBe('Nikolaj Ehlers');
    expect(text('.shot-result')).toBe('Goal');
    expect(text('.shot-goalie')).toBe('Empty net');

    elements('.shot-marker')[6].click();
    fixture.detectChanges();
    expect(text('.shooter-name')).toBe('Jordan Staal');
    expect(text('.shot-time')).toBe('3rd 6:32');
    expect(text('.shot-goalie')).toBe('Carter Hart');

    click('.goals-toggle');
    expect(elements('.shot-marker').length).toBe(49);
    expect(text('.shooter-name')).toBe('Jordan Staal');
  });

  it("should open a goal's highlight from its watch button", () => {
    show();
    const goalClicked = spyOn(component.goalClicked, 'emit');
    click('.goals-toggle');
    click('.watch-goal-button');
    expect(goalClicked).toHaveBeenCalledWith({playerId: component.selectedShot.shooterId, eventId: 215});
  });

  it('should not offer to watch a goal without a highlight clip', () => {
    const scoring = mockGameLanding(2025030414).summary.scoring;
    scoring.flatMap(period => period.goals).forEach(goal => delete goal.highlightClip);
    show(undefined, scoring);
    click('.goals-toggle');
    expect(text('.shot-result')).toBe('Goal');
    expect(element('.watch-goal-button')).toBeNull();
  });

  it("should open the shooter's game stats", () => {
    show();
    const playerClicked = spyOn(component.playerClicked, 'emit');
    click('.shooter');
    expect(playerClicked).toHaveBeenCalledWith(component.selectedShot.shooterId);
  });

  it('should keep the selected shot when the play-by-play refreshes', () => {
    show();
    component.selectShot(component.markers[3]);
    show(mockGamePlayByPlay(2025030414));
    expect(component.selectedShot.eventId).toBe(component.markers[3].shot.eventId);
  });

  it('should show "Unknown" for a shooter or goalie without a roster spot', () => {
    const playByPlay = mockGamePlayByPlay(2025030414);
    playByPlay.rosterSpots = [];
    show(playByPlay);
    expect(text('.shooter-name')).toBe('Unknown');
    expect(text('.shot-goalie')).toBe('Unknown');
  });

  it('should show no shots or shot details without any shots', () => {
    show(mockGamePlayByPlay(2026020056), []);
    expect(elements('.shot-marker').length).toBe(0);
    expect(element('.shot-details')).toBeNull();
    expect(element('.shot-line')).toBeNull();
    expect(text('.home-shot-count')).toBe('0 shots · 0 goals');
  });
});
