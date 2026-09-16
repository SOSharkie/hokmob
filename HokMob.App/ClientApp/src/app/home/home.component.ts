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
    this.activatedRoute.queryParamMap.subscribe((params: ParamMap) => {
      if (params.has("date") && params.get("date").length === 8) {
        this.selectedDayString = params.get("date");
      } else {
        this.selectedDayString = dayjs().format("YYYYMMDD");
      }
    });
  }

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
