import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { GameShot } from '@shared/models/game-shot.model';
import { ShotMapUtils } from '@shared/utils/shot-map-utils';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { mockGameBoxscore, mockGamePlayByPlay, mockNstGameStats } from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

import { PlayerShotMapComponent } from './player-shot-map.component';

describe('PlayerShotMapComponent', () => {
  let component: PlayerShotMapComponent;
  let fixture: ComponentFixture<PlayerShotMapComponent>;

  /** CAR 5 @ VGK 3, the 2026 Stanley Cup Final's 4th game: Jordan Staal (CAR) and Carter Hart (VGK). */
  const staalId = 8473533;
  const hartId = 8479394;
  const playerShots = (playerId: number, isGoalie: boolean) =>
      ShotMapUtils.getPlayerShots(ShotMapUtils.getShots(mockGamePlayByPlay(2025030414)), playerId, isGoalie);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ PlayerShotMapComponent ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerShotMapComponent);
    component = fixture.componentInstance;
  });

  function show(shots: GameShot[], isGoalie: boolean = false): void {
    fixture.componentRef.setInput('shots', shots);
    fixture.componentRef.setInput('isGoalie', isGoalie);
    fixture.detectChanges();
  }

  const element = (selector: string): Element => fixture.nativeElement.querySelector(selector);
  const elements = (selector: string): Element[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const text = (selector: string) => element(selector)?.textContent.trim();

  it("should show only a skater's shooting percentage above the map", () => {
    show(playerShots(staalId, false));
    expect(elements('.shot-stats dt').map(label => label.textContent.trim())).toEqual(['Shooting %']);
    expect(text('.shot-accuracy')).toBe('2/4 (50%)');
  });

  it('should draw each shot with a line to the net, the goals with a puck', () => {
    show(playerShots(staalId, false));
    expect(elements('.shot-marker').length).toBe(4);
    expect(elements('.shot-marker.goal image').length).toBe(2);
    const lines = elements('.shot-line');
    expect(lines.length).toBe(4);
    lines.forEach(line => {
      expect(line.getAttribute('x2')).toBe(String(component.netX));
      expect(line.getAttribute('y2')).toBe(String(component.netY));
    });
    expect(component.markers[0].color).toBe(NhlTeamColorUtils.getTeamPrimaryColor(12));
  });

  it('should put the net at the bottom, the shooter attacking down the half rink', () => {
    show(playerShots(staalId, false));
    // The 3rd period goal (80, -8): 9ft above the goal line, 8ft right of the middle from the top
    const goal = component.markers.find(marker => marker.timeLabel === '3rd 6:32');
    expect(goal.y).toBe(component.netY - 9);
    expect(goal.x).toBe(42.5 - 8);
    expect(component.netY).toBe(89 - component.topX);
    expect(component.rinkHeight).toBe(100 - component.topX);
  });

  describe('shot tooltip', () => {
    /** Staal's shots with Natural Stat Trick's xG. */
    const staalShotsWithXg = () => ShotMapUtils.getPlayerShots(
        ShotMapUtils.getShots(mockGamePlayByPlay(2025030414), mockNstGameStats(2025030414).shots), staalId, false);
    const tooltipText = () => text('.shot-tooltip')?.replace(/\s+/g, ' ');

    function hover(selector: string, index: number, event: 'mouseenter' | 'mouseleave'): void {
      elements(selector)[index].dispatchEvent(new MouseEvent(event));
      fixture.detectChanges();
    }

    it("should show a selected shot's result, time, shot type and xG, without the goalie", () => {
      show(staalShotsWithXg());
      expect(element('.shot-tooltip')).toBeNull();
      (elements('.shot-chip')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(text('.tooltip-result')).toBe('Goal');
      expect(text('.tooltip-time')).toBe('1st 12:48');
      expect(text('.tooltip-shot-type')).toBe('Wrist');
      expect(text('.tooltip-xg')).toBe('0.33');
      expect(tooltipText()).not.toContain('Goalie');
      expect(tooltipText()).not.toContain('Carter Hart');
      expect(element('.tooltip-shooter')).toBeNull();
    });

    it('should leave the xG out without Natural Stat Trick stats', () => {
      show(playerShots(staalId, false));
      component.toggleShot(component.markers[0]);
      fixture.detectChanges();
      expect(text('.tooltip-result')).toBe('Saved');
      expect(element('.tooltip-xg')).toBeNull();
    });

    it('should name the shooter of a shot a goalie faced', () => {
      show(playerShots(hartId, true), true);
      // Stankoven's goal at 1:06 of the 1st
      component.toggleShot(component.markers.find(marker => marker.shot.eventId === 69));
      fixture.detectChanges();
      expect(text('.tooltip-shooter')).toBe('Logan Stankoven');
      expect(text('.tooltip-result')).toBe('Goal');
    });

    it('should show while a shot or its chip is hovered, and go back to the selected shot after', () => {
      show(staalShotsWithXg());
      hover('.shot-marker', 3, 'mouseenter');
      expect(text('.tooltip-time')).toBe('3rd 6:32');
      hover('.shot-marker', 3, 'mouseleave');
      expect(element('.shot-tooltip')).toBeNull();

      elements('.shot-marker')[0].dispatchEvent(new MouseEvent('click'));
      fixture.detectChanges();
      expect(elements('.shot-marker.selected').length).toBe(1);
      hover('.shot-chip', 2, 'mouseenter');
      expect(text('.tooltip-time')).toBe('2nd 10:28');
      hover('.shot-chip', 2, 'mouseleave');
      expect(text('.tooltip-time')).toBe('1st 7:05');
    });

    it('should point at the shot from above, or from below near the top, staying over the rink', () => {
      const shots = staalShotsWithXg();
      // Pull the first shot out to the top of the zone and against the boards
      shots[0] = {...shots[0], x: 30, y: -41};
      show(shots);
      component.toggleShot(component.markers[1]);
      fixture.detectChanges();
      expect(element('.shot-tooltip').classList).not.toContain('below');
      expect(component.tooltipPosition.anchor).toBe(component.tooltipPosition.left);

      component.toggleShot(component.markers[0]);
      fixture.detectChanges();
      expect(element('.shot-tooltip').classList).toContain('below');
      // 1.5ft from the left boards: the arrow moves to the tooltip's side
      expect(component.tooltipPosition.left).toBeCloseTo(1.8, 1);
      expect(component.tooltipPosition.anchor).toBe(10);
    });
  });

  it('should label a chip per shot, and highlight the shot of a selected chip', () => {
    show(playerShots(staalId, false));
    const chips = elements('.shot-chip') as HTMLButtonElement[];
    expect(chips.map(chip => chip.textContent.trim())).toEqual(['1st 7:05', '1st 12:48', '2nd 10:28', '3rd 6:32']);
    expect(elements('.shot-chip.goal').length).toBe(2);

    chips[1].click();
    fixture.detectChanges();
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
    expect(elements('.shot-marker.selected').length).toBe(1);
    expect(elements('.shot-line.selected').length).toBe(1);

    chips[1].click();
    fixture.detectChanges();
    expect(elements('.shot-marker.selected').length).toBe(0);
  });

  it('should show the shots a goalie faced, and his saves', () => {
    const shots = playerShots(hartId, true);
    show(shots, true);
    const hart = mockGameBoxscore(2025030414).playerByGameStats.homeTeam.goalies.find(goalie => goalie.playerId === hartId);
    expect(elements('.shot-stats dt').map(label => label.textContent.trim())).toEqual(['Save %']);
    expect(text('.shot-accuracy')).toBe(hart.saves + '/' + hart.shotsAgainst + ' (.852)');
    expect(elements('.shot-marker').length).toBe(27);
  });

  it('should draw the offensive zone, or down to the center line for a shot from the neutral zone', () => {
    show(playerShots(staalId, false));
    expect(component.topX).toBe(21);
    expect(element('.center-line')).toBeNull();

    const shots = playerShots(staalId, false);
    shots[0] = {...shots[0], x: 10};
    shots[1] = {...shots[1], x: -40};
    show(shots);
    expect(component.topX).toBe(-2);
    expect(element('.center-line')).not.toBeNull();
    // A shot from the shooter's own half is drawn at the top edge
    expect(component.markers[1].y).toBe(0);
  });

  it('should show a goalie a perfect save percentage, and clear a selected shot that is gone', () => {
    const saves = playerShots(hartId, true).filter(shot => !shot.isGoal).slice(0, 3);
    show(saves, true);
    expect(text('.shot-accuracy')).toBe('3/3 (1.000)');
    component.toggleShot(component.markers[2]);

    show(saves.slice(0, 2), true);
    expect(component.selectedEventId).toBeUndefined();
  });

  it('should show zeros without shots', () => {
    show([]);
    expect(text('.shot-accuracy')).toBe('0/0 (0%)');
    expect(elements('.shot-marker').length).toBe(0);
  });
});
