import { TestBed } from '@angular/core/testing';

import { ScrollDirectionService } from './scroll-direction.service';

describe('ScrollDirectionService', () => {
  let service: ScrollDirectionService;
  let scrollY: number;
  let pageHeight: number;
  let frameCallbacks: FrameRequestCallback[];

  /** A page taller than the window, so the middle of it is neither end. */
  const windowHeight = 800;

  beforeEach(() => {
    scrollY = 0;
    pageHeight = 5000;
    frameCallbacks = [];
    spyOnProperty(window, 'scrollY', 'get').and.callFake(() => scrollY);
    spyOnProperty(window, 'innerHeight', 'get').and.callFake(() => windowHeight);
    spyOnProperty(document.documentElement, 'scrollHeight', 'get').and.callFake(() => pageHeight);
    spyOn(window, 'requestAnimationFrame').and.callFake(callback => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScrollDirectionService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  /** Scrolls the page to the given position and lets the service read it on the next frame. */
  function scrollTo(position: number): void {
    scrollY = position;
    window.dispatchEvent(new Event('scroll'));
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    callbacks.forEach(callback => callback(0));
  }

  /** The service's latest scrolling up value. */
  function isScrollingUp(): boolean {
    let scrollingUp: boolean;
    service.scrollingUp$.subscribe(value => scrollingUp = value).unsubscribe();
    return scrollingUp;
  }

  it('should start scrolling up at the top of the page', () => {
    expect(isScrollingUp()).toBeTrue();
  });

  it('should stop scrolling up once the page scrolls down past the threshold', () => {
    scrollTo(500);

    expect(isScrollingUp()).toBeFalse();
  });

  it('should scroll up again when the page scrolls back up past the threshold', () => {
    scrollTo(500);
    scrollTo(500 - ScrollDirectionService.directionThreshold);

    expect(isScrollingUp()).toBeTrue();
  });

  it('should ignore a scroll shorter than the threshold', () => {
    scrollTo(500);
    scrollTo(500 - ScrollDirectionService.directionThreshold + 1);

    expect(isScrollingUp()).toBeFalse();
  });

  it('should add up small scrolls in the same direction until they pass the threshold', () => {
    scrollTo(500);
    for (let position = 499; position > 500 - ScrollDirectionService.directionThreshold; position--) {
      scrollTo(position);
      expect(isScrollingUp()).withContext('at ' + position).toBeFalse();
    }
    scrollTo(500 - ScrollDirectionService.directionThreshold);

    expect(isScrollingUp()).toBeTrue();
  });

  it('should scroll up at the top of the page, however it got there', () => {
    scrollTo(500);
    scrollTo(0);

    expect(isScrollingUp()).toBeTrue();
  });

  it('should scroll up at the bottom of the page, where there is nothing left to scroll down to', () => {
    scrollTo(500);
    scrollTo(pageHeight - windowHeight);

    expect(isScrollingUp()).toBeTrue();
  });

  it('should stop scrolling up again after leaving the top of the page', () => {
    scrollTo(500);
    scrollTo(0);
    scrollTo(500);

    expect(isScrollingUp()).toBeFalse();
  });

  it('should report the scroll position', () => {
    const positions: number[] = [];
    const subscription = service.scrollY$.subscribe(position => positions.push(position));

    scrollTo(300);
    scrollTo(600);
    subscription.unsubscribe();

    expect(positions).toEqual([0, 300, 600]);
  });

  it('should read the scroll position once per frame, however many scrolls arrive', () => {
    scrollY = 100;
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));

    expect(frameCallbacks.length).toBe(1);
  });

  it('should stop listening when it is destroyed', () => {
    service.ngOnDestroy();
    scrollY = 900;
    window.dispatchEvent(new Event('scroll'));

    expect(frameCallbacks.length).toBe(0);
  });
});
