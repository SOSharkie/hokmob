import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppTestingModule } from '@shared/testing/app-testing.module';

import { RinkComponent } from './rink.component';

/** A card putting its players on the rink. */
@Component({
  template: '<app-rink><div class="team-players home-players">Home</div></app-rink>'
})
class RinkHostComponent {}

describe('RinkComponent', () => {
  let component: RinkComponent;
  let fixture: ComponentFixture<RinkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppTestingModule ],
      declarations: [ RinkComponent, RinkHostComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RinkComponent);
    component = fixture.componentInstance;
  });

  it('should draw a rink lying across the card and one standing up, each with its own markings', () => {
    fixture.detectChanges();
    const lying: SVGElement = fixture.nativeElement.querySelector('.rink-markings:not(.standing)');
    const standing: SVGElement = fixture.nativeElement.querySelector('.rink-markings.standing');
    expect(lying.getAttribute('viewBox')).toBe('0 0 200.13 78.74');
    expect(standing.getAttribute('viewBox')).toBe('0 0 157.47 98.42');
    for (const svg of [lying, standing]) {
      // Four end zone faceoff circles and the center circle, with a dot in each
      expect(svg.querySelectorAll('.thin circle').length).toBe(5);
      expect(svg.querySelectorAll('.dots circle').length).toBe(5);
      expect(svg.querySelectorAll('.blue-line').length).toBe(2);
      expect(svg.querySelectorAll('.crease').length).toBe(2);
      // Each viewBox is the shape its rink is drawn at, so this only takes up the rounding of the rink's border
      expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    }
  });

  it('should draw the standing rink shorter than a real one, keeping its markings round', () => {
    const [lying, standing] = component.rinkDrawings;
    // The viewBox is the shape the CSS gives the standing rink, so nothing in it is stretched
    expect(standing.length / standing.width).toBeCloseTo(RinkComponent.standingAspectRatio, 4);
    expect(standing.viewBox).toBe('0 0 157.47 98.42');

    // A real rink is drawn as it is, and everything along the shorter one moves in with it, keeping its place
    expect(lying.goalLineXs).toEqual([13.1, 187.03]);
    expect(lying.blueLineXs).toEqual([71.1, 129.03]);
    expect(lying.goalXs).toEqual([9.8, 187.03]);
    expect(standing.goalLineXs).toEqual([10.31, 147.16]);
    expect(standing.blueLineXs).toEqual([55.94, 101.53]);
    expect(standing.centerX).toBe(78.74);
    expect(standing.goalXs).toEqual([7.01, 147.16]);
    expect(standing.goalLineXs[0] / standing.length).toBeCloseTo(lying.goalLineXs[0] / lying.length, 4);
    expect(standing.blueLineXs[0] / standing.length).toBeCloseTo(lying.blueLineXs[0] / lying.length, 4);

    // Every round marking shrinks with the square root of the length the rink lost, so it covers the same ice as the
    // oval it stands in for instead of looking too big for the shorter rink
    expect(lying.circleRadius).toBe(14.75);
    expect(standing.circleRadius).toBe(13.08);
    expect(standing.circleRadius / lying.circleRadius).toBeCloseTo(Math.sqrt(standing.length / lying.length), 3);
    expect(lying.creasePaths[0]).toBe('M13.1 33.37 A6 6 0 0 1 13.1 45.37 Z');
    expect(lying.refereeCreasePath).toBe('M90.06 0 A10 10 0 0 0 110.06 0');
    expect(standing.creasePaths[0]).toBe('M10.31 43.89 A5.32 5.32 0 0 1 10.31 54.53 Z');
    expect(standing.creasePaths[1]).toBe('M147.16 43.89 A5.32 5.32 0 0 0 147.16 54.53 Z');
    expect(standing.refereeCreasePath).toBe('M69.87 0 A8.87 8.87 0 0 0 87.61 0');
  });

  it('should keep the faceoff dots 22ft from the middle of a full width rink, and closer on the narrower one', () => {
    const [lying, standing] = component.rinkDrawings;
    expect(standing.faceoffCircles.map(circle => [circle.x, circle.y]))
        .toEqual([[27.62, 27.21], [27.62, 71.21], [129.85, 27.21], [129.85, 71.21]]);
    // The hash marks sit on the circle, so they move in with its radius
    expect(standing.faceoffCircles[0].hashMarks).toBe('M26.12 14.13 v-2 M26.12 40.29 v2 M29.12 14.13 v-2 M29.12 40.29 v2');

    // 78.74ft is 80% of 98.42ft, so the dots are 17.6ft from the middle
    expect(lying.middle).toBe(39.37);
    expect(lying.faceoffCircles.slice(0, 2).map(circle => circle.y)).toEqual([21.77, 56.97]);
    expect(lying.goalY).toBe(36.37);
  });

  it("should show a card's players above the markings", () => {
    const host = TestBed.createComponent(RinkHostComponent);
    host.detectChanges();
    const rink: HTMLElement = host.nativeElement.querySelector('app-rink');
    expect(rink.lastElementChild.classList).toContain('home-players');
    expect(rink.firstElementChild.classList).toContain('rink-surface');
    host.destroy();
  });

  describe('placeLine', () => {
    it('should place each line at its distance from the end boards, in percent of the rink', () => {
      // 17ft, 52ft and 85.6ft along a 200.13ft rink
      expect(RinkComponent.placeLine('goalies', ['G'])[0].length.toFixed(1)).toBe('8.5');
      expect(RinkComponent.placeLine('defense', ['D'])[0].length.toFixed(1)).toBe('26.0');
      expect(RinkComponent.placeLine('forwards', ['F'])[0].length.toFixed(1)).toBe('42.8');
    });

    it('should spread a line across the rink by how many players it has, keeping their order', () => {
      expect(RinkComponent.placeLine('forwards', ['C', 'L', 'R']).map(spot => [spot.player, spot.across]))
          .toEqual([['C', 18], ['L', 50], ['R', 82]]);
      expect(RinkComponent.placeLine('forwards', ['C', 'L']).map(spot => spot.across)).toEqual([27.6, 72.4]);
      expect(RinkComponent.placeLine('defense', ['D', 'D']).map(spot => spot.across)).toEqual([27.6, 72.4]);
      expect(RinkComponent.placeLine('defense', ['D']).map(spot => spot.across)).toEqual([50]);
      expect(RinkComponent.placeLine('goalies', ['G']).map(spot => [spot.line, spot.across])).toEqual([['goalies', 50]]);
    });

    it('should place no one for an empty line', () => {
      expect(RinkComponent.placeLine('defense', [])).toEqual([]);
    });
  });

});
