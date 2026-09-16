import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';

/**
 * Tracks the app's browser history, so a page's back button can go back like the browser's back button instead of
 * pushing the previous URL as a new history entry (which made back buttons ping-pong between two pages, and made the
 * browser's back button return to the page just left).
 *
 * Each history entry has the router's page ID (`ɵrouterPageId` in `history.state`, set because the router uses
 * `canceledNavigationResolution: 'computed'`). The page before the current one has the current page ID minus 1, so
 * the previous URL is only known when that entry was visited since the app loaded. After a reload, it isn't.
 */
@Injectable()
export class RouterExtensionService {

  private readonly urlsByPageId = new Map<number, string>();

  private currentPageId: number;

  constructor(private router: Router,
              private location: Location) {
    router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // The router updates the browser URL and state before NavigationEnd
        this.currentPageId = this.readPageId();
        this.urlsByPageId.set(this.currentPageId, event.urlAfterRedirects);
      }
    });
  }

  /**
   * Gets the URL of the history entry before the current one, or undefined when it isn't an entry of this app visit
   * (the page was opened directly, reloaded, or is the first one).
   */
  public getPreviousUrl(): string {
    if (this.currentPageId === undefined) {
      return undefined;
    }
    return this.urlsByPageId.get(this.currentPageId - 1);
  }

  /**
   * Goes back one history entry when it's a page of this app visit. Otherwise navigates to the fallback URL, which
   * adds a history entry.
   *
   * @param fallbackUrl - The URL to open without a previous page, like "/?date=20260315".
   */
  public back(fallbackUrl: string): void {
    if (this.getPreviousUrl() !== undefined) {
      this.location.back();
    } else {
      this.router.navigateByUrl(fallbackUrl);
    }
  }

  /**
   * Gets the back button label for a URL of the app, like "Games" for "/?date=20260315" or "Team" for "/team/28".
   *
   * @param url - The URL the back button goes to, or undefined.
   * @param fallbackLabel - The label when the URL is undefined or unknown.
   */
  public static getBackLabel(url: string, fallbackLabel: string): string {
    const path = (url ?? "").split(/[?#]/)[0];
    const firstSegment = path.split("/").filter(segment => segment)[0];
    if (url !== undefined && url !== null && firstSegment === undefined) {
      return "Games";
    }
    const labels: {[segment: string]: string} = {
      game: "Game",
      team: "Team",
      player: "Player",
      stats: "Stats",
      standings: "Standings",
      playoffs: "Playoffs",
      draft: "Draft",
      about: "About"
    };
    return labels[firstSegment] ?? fallbackLabel;
  }

  private readPageId(): number {
    const state = this.location.getState() as {ɵrouterPageId?: number};
    return state?.ɵrouterPageId ?? 0;
  }
}
