import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import * as dayjs from "dayjs";
import {NhlStatsApiService} from "@shared/services/nhl-stats-api.service";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  public selectedDayString: string;

  /** Whether to show the playoff summary instead of the standings summary. Undefined until the season dates load. */
  public isPlayoffs: boolean;

  constructor(private activatedRoute: ActivatedRoute,
              private router: Router,
              private nhlStatsApiService: NhlStatsApiService){}

  public ngOnInit(): void {
    this.nhlStatsApiService.getCurrentSeason().then(currentSeason => {
      this.isPlayoffs = currentSeason.isPlayoffMode;
    }).catch(() => {
      // The service logs the error. Show the standings summary
      this.isPlayoffs = false;
    });
    // Also runs for the browser's back and forward buttons, which the scoreboard follows through selectedDayString
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      const date = params.get("date");
      if (/^\d{8}$/.test(date ?? "") && dayjs(date, "YYYYMMDD").isValid()) {
        this.selectedDayString = date;
      } else {
        this.selectedDayString = dayjs().format("YYYYMMDD");
      }
    });
  }

  /**
   * Puts the day the user picked in the URL (without a date for today), as a new history entry, so the back button of
   * a game opened from it returns to that day.
   */
  public onSelectedDayChange(date: Date): void {
    let currentDay = dayjs().format("YYYYMMDD");
    this.selectedDayString = dayjs(date).format("YYYYMMDD");
    let dateParam;
    if (currentDay !== this.selectedDayString) {
      dateParam = {date: this.selectedDayString};
    } else {
      dateParam = {};
    }
    this.router.navigate([],
        {
          relativeTo: this.activatedRoute,
          queryParams: dateParam,
        }
    );
  }
}
