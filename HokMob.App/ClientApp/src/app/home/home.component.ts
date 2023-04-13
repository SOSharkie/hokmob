import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import * as dayjs from "dayjs";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  public selectedDayString: string;

  constructor(private route: ActivatedRoute,
              private router: Router){}

  public ngOnInit(): void {
    this.route.queryParamMap.subscribe((params: ParamMap) => {
      if (params.has("date") && params.get("date").length === 8) {
        this.selectedDayString = params.get("date");
      } else {
        this.selectedDayString = dayjs().format("YYYYMMDD");
      }
    });
  }

  public onSelectedDayChange(date: Date): void {
    this.selectedDayString = dayjs(date).format("YYYYMMDD");
    const dateParam = {date: this.selectedDayString};
    this.router.navigate([],
        {
          relativeTo: this.route,
          queryParams: dateParam,
          queryParamsHandling: "merge"
        }
    );
  }
}
