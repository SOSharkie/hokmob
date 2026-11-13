import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';
import { PlayByPlay } from '@shared/models/nhl-web-api/play-by-play.model';
import { GameLandingScoringPeriod } from '@shared/models/nhl-web-api/gamecenter-landing.model';
import { NhlTeamColorUtils } from '@shared/utils/nhl-team-color-utils';
import { NhlTeamLogoUtils } from '@shared/utils/nhl-team-logo-utils';
import { ShotMapUtils } from '@shared/utils/shot-map-utils';
import {
  mockGameLanding,
  mockGamePlayByPlay,
  mockLiveNstGameStats,
  mockLiveNstPlayByPlay,
  mockNstGameStats
} from '@shared/testing/nhl-api-mocks/nhl-api-mocks';

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

  it("should show every shot on goal and goal to start with, and each team's counts", () => {
    show();
    expect(component.shotFilter).toBe('onTarget');
    expect(elements('.shot-marker').length).toBe(49);
    expect(elements('.shot-marker.goal').length).toBe(8);
    expect(elements('.shot-marker.missed').length).toBe(0);
    expect(text('.home-shot-count')).toBe('21 shots · 3 goals');
    expect(text('.away-shot-count')).toBe('28 shots · 5 goals');
  });

  describe('shot filter', () => {
    const options = () => elements('.shot-filter-option');
    const option = (label: string) => options().find(item => item.textContent.trim() === label);

    function pick(label: string): void {
      option(label).click();
      fixture.detectChanges();
    }

    it('should offer every shot, the shots on target and the goals, with the shots on target picked', () => {
      show();
      expect(element('.shot-filter').getAttribute('role')).toBe('group');
      expect(options().map(item => item.textContent.trim())).toEqual(['All', 'On target', 'Goals']);
      expect(options().map(item => item.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
      expect(elements('.shot-filter-option.selected')).toEqual([option('On target')]);
    });

    it("should add the missed shots, and each team's missed count, with every shot", () => {
      show();
      pick('All');
      expect(option('All').getAttribute('aria-pressed')).toBe('true');
      expect(elements('.shot-marker').length).toBe(76);
      expect(elements('.shot-marker.missed').length).toBe(27);
      expect(elements('.shot-marker.missed.goal').length).toBe(0);
      expect(text('.home-shot-count')).toBe('21 shots · 15 missed · 3 goals');
      expect(text('.away-shot-count')).toBe('28 shots · 12 missed · 5 goals');
      // The last shot is still Theodore's, a shot on goal
      expect(text('.shooter-name')).toBe('Shea Theodore');

      pick('On target');
      expect(elements('.shot-marker').length).toBe(49);
      expect(text('.home-shot-count')).toBe('21 shots · 3 goals');
    });

    it("should show a missed shot's reason as its result", () => {
      show();
      pick('All');
      // Howden off the post in the 1st
      component.selectShot(component.markers.find(marker => marker.shot.eventId === 499));
      fixture.detectChanges();
      expect(text('.shooter-name')).toBe('Brett Howden');
      expect(text('.shot-result')).toBe('Hit the post');
      expect(element('.shot-result').classList).toContain('missed');
      expect(element('.shot-marker.selected').classList).toContain('missed');
      expect(element('.shot-marker.selected').getAttribute('aria-label'))
          .toBe('Brett Howden, 1st 15:51, missed, hit the post');
      expect(element('.watch-goal-button')).toBeNull();
    });

    it("should draw a missed shot's line dashed, stopping at the crease on each way the rink is drawn", () => {
      show();
      pick('All');
      // Howden's shot off the post, from 15ft out
      const howden = component.markers.find(marker => marker.shot.eventId === 499);
      component.selectShot(howden);
      fixture.detectChanges();
      expect(elements('.shot-line.missed').length).toBe(2);
      expect(element('.lying-shot-line')).not.toBeNull();
      expect(element('.standing-shot-line')).not.toBeNull();
      const line = component.selectedShotLine;
      expect(line.missed).toBeTrue();
      expect([line.x1, line.y1]).toEqual([howden.along, howden.across]);

      // In the drawn rink's feet, each end is on its crease: 6ft from the net on the 200.13ft by 78.74ft lying rink,
      // and 5.32ft on the 157.47ft by 98.42ft standing one, whose round markings are drawn smaller
      const net = ShotMapComponent.getRinkPosition({...howden.shot, x: 89, y: 0});
      const feetFromNet = (end: {x: number, y: number}, length: number, width: number) =>
          Math.hypot((end.x - net.along) * length / 100, (end.y - net.across) * width / 100);
      expect(feetFromNet(line.lyingEnd, 200.13, 78.74)).toBeCloseTo(6, 1);
      expect(feetFromNet(line.standingEnd, 157.47, 98.42)).toBeCloseTo(5.32, 1);
      // On the way from the shot to the net: Vegas, at home, shoots at the left end
      expect(net.along).toBeLessThan(howden.along);
      [line.lyingEnd, line.standingEnd].forEach(end => {
        expect(end.x).toBeLessThan(howden.along);
        expect(end.x).toBeGreaterThan(net.along);
        const slope = (net.across - howden.across) / (net.along - howden.along);
        expect(end.y).toBeCloseTo(howden.across + (end.x - howden.along) * slope, 1);
      });
    });

    it("should draw a shot on goal's line solid, to the middle of the net", () => {
      show();
      pick('All');
      component.selectShot(component.markers.find(marker => marker.shot.eventId === 69));
      fixture.detectChanges();
      expect(elements('.shot-line').length).toBe(2);
      expect(elements('.shot-line.missed').length).toBe(0);
      const net = ShotMapComponent.getRinkPosition({...component.selectedShot, x: 89, y: 0});
      expect(component.selectedShotLine.lyingEnd).toEqual({x: net.along, y: net.across});
      expect(component.selectedShotLine.standingEnd).toEqual({x: net.along, y: net.across});
    });

    it('should draw no line for a missed shot from inside the crease', () => {
      const net = {along: 93.45, across: 50};
      const inside = {along: 92, across: 51} as any;
      expect(ShotMapComponent.getCreaseEnd(inside, net, false)).toBeNull();
      expect(ShotMapComponent.getCreaseEnd(inside, net, true)).toBeNull();
      expect(ShotMapComponent.getCreaseEnd(net as any, net, false)).toBeNull();
      // Straight out in front, 6ft along the lying rink is 3% of its length
      expect(ShotMapComponent.getCreaseEnd({along: 80, across: 50} as any, net, false)).toEqual({x: 90.45, y: 50});
    });

    it('should select the last shown shot when the selected missed shot is filtered out', () => {
      show();
      pick('All');
      component.selectShot(component.markers.find(marker => marker.shot.eventId === 499));
      pick('On target');
      expect(component.selectedShot.isMissed).toBeFalse();
      expect(text('.shooter-name')).toBe('Shea Theodore');
      // Picking every shot again brings the missed shot back
      pick('All');
      expect(text('.shooter-name')).toBe('Brett Howden');
    });

    it('should show only the goals, selecting the last one', () => {
      show();
      pick('Goals');
      expect(option('Goals').getAttribute('aria-pressed')).toBe('true');
      expect(elements('.shot-marker').length).toBe(8);
      expect(elements('.shot-marker:not(.goal)').length).toBe(0);
      // Ehlers' empty net goal
      expect(text('.shooter-name')).toBe('Nikolaj Ehlers');
      expect(text('.shot-result')).toBe('Goal');
      expect(text('.shot-goalie')).toBe('Empty net');
      expect(text('.home-shot-count')).toBe('21 shots · 3 goals');

      elements('.shot-marker')[6].click();
      fixture.detectChanges();
      expect(text('.shooter-name')).toBe('Jordan Staal');
      expect(text('.shot-time')).toBe('3rd 6:32');
      expect(text('.shot-goalie')).toBe('Carter Hart');

      pick('On target');
      expect(elements('.shot-marker').length).toBe(49);
      expect(text('.shooter-name')).toBe('Jordan Staal');
    });

    it("should give the missed shots NST's xG", () => {
      fixture.nativeElement.style.width = '1000px';
      fixture.componentRef.setInput('advancedStats', mockNstGameStats(2025030414));
      show();
      pick('All');
      // Staal's miss at 10:21 of the 2nd
      component.selectShot(component.markers.find(marker => marker.shot.eventId === 871));
      fixture.detectChanges();
      expect(text('.shot-result')).toBe('Over the net');
      expect(text('.shot-xg')).toBe('0.08');
    });
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
    const first = component.shownMarkers[0].shot;
    expect(component.selectedShot.eventId).toBe(first.eventId);
    expect(elements('.shot-marker')[0].classList).toContain('selected');
    expect(elements('.shot-marker')[0].getAttribute('aria-pressed')).toBe('true');
    expect(elements('.shot-marker.selected').length).toBe(1);
    expect(text('.shot-time')).toBe(ShotMapUtils.getTimeLabel(first));
  });

  describe("Natural Stat Trick's xG", () => {
    const facts = () => elements('.shot-facts dt').map(label => label.textContent.trim());

    /** Shows a game on a wide card, with NST's stats when given. */
    function showWithStats(gameId: 2025030414 | 2026020010, withStats: boolean = true): void {
      fixture.nativeElement.style.width = '1000px';
      fixture.componentRef.setInput('advancedStats', withStats ? mockNstGameStats(gameId) : undefined);
      show(mockGamePlayByPlay(gameId), mockGameLanding(gameId).summary.scoring);
    }

    it("should show the selected shot's xG between its result and the goalie", () => {
      showWithStats(2025030414);
      expect(facts()).toEqual(['Time', 'Shot type', 'Result', 'xG', 'Goalie']);
      // Theodore's shot from 101ft at the end of the game
      expect(text('.shot-xg')).toBe('0.00');
      component.selectShot(component.markers.find(marker => marker.shot.eventId === 69));
      fixture.detectChanges();
      expect(text('.shooter-name')).toBe('Logan Stankoven');
      expect(text('.shot-xg')).toBe('0.09');
    });

    it('should credit Natural Stat Trick with a link to its game page', () => {
      showWithStats(2025030414);
      const link = element('.shots-source') as HTMLAnchorElement;
      expect(link.textContent.trim()).toBe('Expected goals from Natural Stat Trick');
      expect(link.getAttribute('href')).toBe('https://www.naturalstattrick.com/game.php?season=20252026&game=30414');
      expect(link.getAttribute('target')).toBe('_blank');
    });

    it("should show \"-\" for a shot NST doesn't list", () => {
      showWithStats(2026020010);
      // Guentzel's shot from behind the net
      component.selectShot(component.markers.find(marker => marker.shot.eventId === 334));
      fixture.detectChanges();
      expect(text('.shooter-name')).toBe('Jake Guentzel');
      expect(text('.shot-xg')).toBe('-');
    });

    it("should show a live game's shot NST hasn't got to yet as pending", () => {
      fixture.nativeElement.style.width = '1000px';
      fixture.componentRef.setInput('advancedStats', mockLiveNstGameStats());
      show(mockLiveNstPlayByPlay(), []);
      // The last shot, at 1:56 of the 2nd, with NST at 0:12
      expect(component.selectedShot.eventId).toBe(522);
      expect(text('.shot-xg')).toBe('Pending');
      expect(element('.shot-xg').getAttribute('title')).toContain('a few minutes behind');
      component.selectShot(component.markers.find(marker => marker.shot.eventId === 88));
      fixture.detectChanges();
      expect(text('.shot-xg')).toBe('0.04');
      expect(element('.shot-xg').getAttribute('title')).toBeNull();
    });

    it('should show no xG or credit without NST stats, or when they have no shots', () => {
      showWithStats(2025030414, false);
      expect(facts()).toEqual(['Time', 'Shot type', 'Result', 'Goalie']);
      expect(element('.shots-source')).toBeNull();

      const stats = mockNstGameStats(2025030414);
      delete stats.shots;
      fixture.componentRef.setInput('advancedStats', stats);
      fixture.detectChanges();
      expect(element('.shot-xg')).toBeNull();
      expect(element('.shots-source')).toBeNull();
    });

    it('should add the xG once the stats load', () => {
      showWithStats(2025030414, false);
      fixture.componentRef.setInput('advancedStats', mockNstGameStats(2025030414));
      fixture.detectChanges();
      expect(text('.shot-xg')).toBe('0.00');
    });

    it('should leave out the goalie, then the shot type, but keep the xG on a narrow card', () => {
      showWithStats(2025030414);
      fixture.nativeElement.style.width = '420px';
      component.fitShotDetails();
      expect(facts()).not.toContain('Goalie');
      expect(facts()).toEqual(jasmine.arrayContaining(['Time', 'Result', 'xG']));
      const details = element('.shot-details');
      expect(details.scrollWidth).toBeLessThanOrEqual(details.clientWidth);

      // Too narrow for both: the shot type goes as well
      fixture.nativeElement.style.width = '300px';
      component.fitShotDetails();
      expect(facts()).toEqual(['Time', 'Result', 'xG']);
      expect(component.droppedFacts).toBe(2);
    });
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
      expect(component.droppedFacts).toBe(0);
      const shooter = element('.shooter').getBoundingClientRect();
      expect(element('.shot-facts').getBoundingClientRect().top).toBeLessThan(shooter.bottom);
    });

    it('should leave out the goalie on a narrow card instead of wrapping', () => {
      showAtWidth(420);
      expect(facts()).not.toContain('Goalie');
      expect(facts()).toEqual(jasmine.arrayContaining(['Time', 'Result']));
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
      expect(facts()).not.toContain('Goalie');

      fixture.nativeElement.style.width = '900px';
      await nextFrames();
      expect(facts()).toEqual(['Time', 'Shot type', 'Result', 'Goalie']);
    });

    it('should refit when another shot is selected', () => {
      showAtWidth(900);
      const fit = spyOn(component, 'fitShotDetails').and.callThrough();
      elements('.shot-marker')[0].click();
      expect(fit).toHaveBeenCalled();
      elements('.shot-filter-option')[2].click();
      expect(fit).toHaveBeenCalledTimes(2);
    });
  });

  it("should open a goal's highlight from its watch button", () => {
    show();
    const goalClicked = spyOn(component.goalClicked, 'emit');
    component.selectShotFilter('goals');
    fixture.detectChanges();
    click('.watch-goal-button');
    expect(goalClicked).toHaveBeenCalledWith({playerId: component.selectedShot.shooterId, eventId: 215});
  });

  it('should not offer to watch a goal without a highlight clip', () => {
    const scoring = mockGameLanding(2025030414).summary.scoring;
    scoring.flatMap(period => period.goals).forEach(goal => delete goal.highlightClip);
    show(undefined, scoring);
    component.selectShotFilter('goals');
    fixture.detectChanges();
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
    component.selectShot(component.shownMarkers[3]);
    show(mockGamePlayByPlay(2025030414));
    expect(component.selectedShot.eventId).toBe(component.shownMarkers[3].shot.eventId);
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
