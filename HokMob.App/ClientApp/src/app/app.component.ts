import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from "@angular/router";
import {Subject, takeUntil} from "rxjs";
import {RouterExtensionService} from "@shared/services/router-extension.service";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  clientHeight: number;
  title = 'hokmob';
  ngUnsubscribe = new Subject<void>();

  constructor(private route: ActivatedRoute,
              private router: Router,
              private routerExtensionService: RouterExtensionService) {
    this.clientHeight = window.innerHeight;
  }

  public ngOnInit(): void {
    this.router.events.pipe(takeUntil(this.ngUnsubscribe)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.onMenuItemClick(event.url);
      }
      window.scrollTo(0, 0);
    });
  }

  public ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  public onMenuItemClick(item: string): void {
    switch (item) {
      case '/games':
        document.getElementById("games-item").classList.add("selected");
        document.getElementById("playoffs-item").classList.remove("selected");
        document.getElementById("stats-item").classList.remove("selected");

        break;
      case '/playoffs':
        document.getElementById("games-item").classList.remove("selected");
        document.getElementById("playoffs-item").classList.add("selected");
        document.getElementById("stats-item").classList.remove("selected");

        break;
      case '/stats':
        document.getElementById("games-item").classList.remove("selected");
        document.getElementById("playoffs-item").classList.remove("selected");
        document.getElementById("stats-item").classList.add("selected");
        break;
    }
  }
}
