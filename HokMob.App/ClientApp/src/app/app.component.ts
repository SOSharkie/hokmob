import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router} from "@angular/router";
import {Subject, takeUntil} from "rxjs";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import {MatIconRegistry} from "@angular/material/icon";
import {DomSanitizer} from "@angular/platform-browser";
import {registerLucideIcons} from "@shared/icons/lucide-icons";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  public clientHeight: number;

  public title = 'hokmob';

  public ngUnsubscribe = new Subject<void>();

  public menuUrl: string = '';

  public get isGamesSelected(): boolean {
    return this.menuUrl === '/' || this.menuUrl.startsWith('/?date=')
  }

  /**
   *
   * @param router - The angular router.
   * @param routerExtensionService - Router extension service used for storing previous URL, needs to be defined here
   * in the app component even though it is not used.
   * @param iconRegistry - Angular Material's icon registry, where the Lucide SVG icons are registered.
   * @param sanitizer - Marks the bundled icon SVGs as trusted.
   */
  constructor(private router: Router,
              private routerExtensionService: RouterExtensionService,
              iconRegistry: MatIconRegistry,
              sanitizer: DomSanitizer) {
    this.clientHeight = window.innerHeight;
    registerLucideIcons(iconRegistry, sanitizer);
  }

  public ngOnInit(): void {
    this.router.events.pipe(takeUntil(this.ngUnsubscribe)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.menuUrl = event.url;
      }
      window.scrollTo(0, 0);
    });
  }

  public ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
