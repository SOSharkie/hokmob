import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router} from "@angular/router";
import {Subject, takeUntil} from "rxjs";
import {RouterExtensionService} from "@shared/services/router-extension.service";
import { ThemeService } from '@shared/services/theme/theme.service';
import { ThemeEnum } from '@shared/enums/theme.enum';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  clientHeight: number;
  title = 'hokmob';
  ngUnsubscribe = new Subject<void>();
  menuUrl: string = '';

  /**
   *
   * @param router - The angular router.
   * @param routerExtensionService - Router extension service used for storing previous URL, needs to be defined here
   * in the app component even though it is not used.
   */
  constructor(private router: Router,
              private routerExtensionService: RouterExtensionService,
              private themeService: ThemeService) {
    this.clientHeight = window.innerHeight;
  }

  public ngOnInit(): void {
    this.router.events.pipe(takeUntil(this.ngUnsubscribe)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.menuUrl = event.url;
      }
      window.scrollTo(0, 0);
    });
    this.themeService.initTheme();
  }

  public ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
