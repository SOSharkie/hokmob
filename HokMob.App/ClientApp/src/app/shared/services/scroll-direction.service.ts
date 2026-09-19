import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, distinctUntilChanged, Observable} from "rxjs";

/**
 * The page's scroll position and direction, from a single passive window listener throttled to one frame. Everything
 * that reacts to scrolling (the mobile menu at the bottom of the app, the game page's drop-down header) shares it,
 * instead of adding a listener each.
 */
@Injectable({providedIn: 'root'})
export class ScrollDirectionService implements OnDestroy {

  /**
   * How far the page has to scroll before the direction flips, so a jittery touch scroll doesn't make the mobile menu
   * flicker.
   */
  public static readonly directionThreshold = 8;

  /**
   * How close to the top or the bottom of the page counts as being at that end, where everything is shown again.
   */
  public static readonly edgeThreshold = 10;

  private readonly scrollingUpSubject = new BehaviorSubject<boolean>(true);

  private readonly scrollYSubject = new BehaviorSubject<number>(0);

  /**
   * The position the direction was last decided at. It only moves once the page has scrolled past the threshold.
   */
  private lastDirectionScrollY = 0;

  private frameId: number = null;

  private readonly scrollListener = () => this.requestUpdate();

  constructor() {
    window.addEventListener("scroll", this.scrollListener, {passive: true});
    this.update();
  }

  /**
   * Whether the page is scrolling up, which is also true at the top and at the bottom of the page. A bar that hides
   * itself while the page scrolls down is visible whenever this is true.
   */
  public get scrollingUp$(): Observable<boolean> {
    return this.scrollingUpSubject.pipe(distinctUntilChanged());
  }

  /**
   * The page's scroll position, emitted at most once per frame.
   */
  public get scrollY$(): Observable<number> {
    return this.scrollYSubject.pipe(distinctUntilChanged());
  }

  public ngOnDestroy(): void {
    window.removeEventListener("scroll", this.scrollListener);
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.scrollingUpSubject.complete();
    this.scrollYSubject.complete();
  }

  /**
   * Reads the scroll position on the next frame. Scrolls that arrive before it are dropped, so a long touch scroll
   * costs one read per frame.
   */
  private requestUpdate(): void {
    if (this.frameId !== null) {
      return;
    }
    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null;
      this.update();
    });
  }

  private update(): void {
    const scrollY = Math.max(window.scrollY ?? 0, 0);
    this.scrollYSubject.next(scrollY);
    if (this.isAtEdge(scrollY)) {
      this.lastDirectionScrollY = scrollY;
      this.scrollingUpSubject.next(true);
      return;
    }
    const delta = scrollY - this.lastDirectionScrollY;
    if (Math.abs(delta) < ScrollDirectionService.directionThreshold) {
      return;
    }
    this.lastDirectionScrollY = scrollY;
    this.scrollingUpSubject.next(delta < 0);
  }

  /**
   * Whether the page is at its top or bottom, where a hidden bar comes back however the page got there. A page too
   * short to scroll is at both ends.
   */
  private isAtEdge(scrollY: number): boolean {
    if (scrollY <= ScrollDirectionService.edgeThreshold) {
      return true;
    }
    const pageHeight = document.documentElement?.scrollHeight ?? 0;
    return scrollY + window.innerHeight >= pageHeight - ScrollDirectionService.edgeThreshold;
  }

}
