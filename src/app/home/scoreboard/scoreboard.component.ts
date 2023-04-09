import {Component, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import {MatDatepicker} from "@angular/material/datepicker";
import {NhlGameService} from "@shared/services/nhl-game.service";
import * as dayjs from 'dayjs'
import {NhlGameDayModel} from "@shared/models/nhl-game-day.model";
import {NhlGameModel} from "@shared/models/nhl-game.model";
import {NhlLogoService} from "@shared/services/nhl-logo.service";
import {ImageUtils} from "@shared/utils/image-utils";

@Component({
  selector: 'app-scores',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ScoreboardComponent implements OnInit {

  /**
   * The date picker component.
   */
  @ViewChild('datePicker')
  public datePicker: MatDatepicker<any>;

  /**
   * The current selected day of the scoreboard.
   */
  public selectedDay: Date = new Date();

  /**
   * The string to display for the currently selected day.
   */
  public displayDayLabel: string = "Today";

  /**
   *
   */
  public currentDayGames: NhlGameModel[] = [];

  constructor(private nhlGameService: NhlGameService,
              private nhlLogoService: NhlLogoService) {
  }

  public ngOnInit() {
    this.retrieveNhlGames();
  }

  /**
   * Method which runs on click of the date select container.
   */
  public onClickDate(): void {
    this.datePicker.open();
  }

  /**
   * Method which runs when a new date is selected in the date picker.
   *
   * @param $event - Event containing info including the newly selected date value.
   */
  public onDateChange($event: any): void {
    this.selectedDay = dayjs($event.value).toDate();
    this.updateDisplayDayLabel();
    this.retrieveNhlGames();
  }

  /**
   * Shifts the current selected day left 1 day.
   */
  public shiftDateLeft(): void {
    this.selectedDay = dayjs(this.selectedDay).subtract(1, 'day').toDate();
    this.updateDisplayDayLabel();
    this.retrieveNhlGames();
  }

  /**
   * Shifts the current selected day right 1 day.
   */
  public shiftDateRight(): void {
    this.selectedDay = dayjs(this.selectedDay).add(1, 'day').toDate();
    this.updateDisplayDayLabel();
    this.retrieveNhlGames();
  }

  private retrieveNhlGames(): void {
    this.nhlGameService.getNhlGames(this.selectedDay).then(nhlGameDay => {
      console.log(nhlGameDay);
      if (nhlGameDay) {
        this.currentDayGames = nhlGameDay.games;
      } else {
        this.currentDayGames = [];
      }

    });
  }

  private updateDisplayDayLabel(): void {
    let today = dayjs();
    let selectedDate = dayjs(this.selectedDay)
    if (today.isSame(this.selectedDay, 'day')) {
      this.displayDayLabel = "Today"
    } else if (today.add(1, 'day').isSame(selectedDate, 'day')) {
      this.displayDayLabel = "Tomorrow"
    } else if (today.subtract(1, 'day').isSame(selectedDate, 'day')) {
      this.displayDayLabel = "Yesterday"
    } else {
      this.displayDayLabel = selectedDate.format('dddd, MMMM D');
    }
  }
}
