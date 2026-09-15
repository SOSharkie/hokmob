import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import * as dayjs from "dayjs";
import {DateTimeUtils} from "@shared/utils/date-time-utils";
import {NhlGameService} from "@shared/services/nhl-game.service";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  public selectedDayString: string;

  public isPlayoffs: boolean = false;

  constructor(private activatedRoute: ActivatedRoute,
              private router: Router,
              private nhlGameService: NhlGameService){}

  public ngOnInit(): void {
    this.nhlGameService.testNewNhlApi();
    this.isPlayoffs = DateTimeUtils.isPlayoffMode();
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
