import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router} from "@angular/router";
import {Subject, takeUntil} from "rxjs";

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

  constructor(private router: Router) {
    this.clientHeight = window.innerHeight;
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
